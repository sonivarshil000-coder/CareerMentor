import { randomInt } from "node:crypto";
import { db } from "./db";
import { fetchBoardJobs } from "@/lib/ats/adapters";
import { fetchGenericJobs } from "@/lib/ats/generic";
import type { SupportedAts } from "@/lib/ats/detect";
import { refreshCompanyMatches } from "./matching";

const RESCAN_INTERVAL_MS = 12 * 60 * 60 * 1_000;
const RETRY_INTERVAL_MS = 2 * 60 * 60 * 1_000;
const MAX_BOARD_JOBS = 1_000;

export async function scanCompany(companyId: string) {
  const company = await db.company.findFirst({ where: { id: companyId, discoveryEnabled: true } });
  if (!company || company.atsPlatform === "UNSUPPORTED") {
    return { skipped: true };
  }

  const detection = new URL(company.careersUrl);
  const board = detection.pathname.split("/").filter(Boolean)[0];
  if (company.atsPlatform !== "GENERIC" && (!board || !["GREENHOUSE", "LEVER", "ASHBY", "WORKABLE"].includes(company.atsPlatform))) {
    await db.company.update({
      where: { id: company.id },
      data: { lastScanError: "This public job board isn’t supported for automatic scanning yet.", nextScanAt: null },
    });
    return { skipped: true };
  }

  await new Promise((resolve) => setTimeout(resolve, randomInt(400, 1_501)));
  const scanStartedAt = new Date();
  try {
    const jobs = company.atsPlatform === "GENERIC"
      ? await fetchGenericJobs(company.careersUrl)
      : await fetchBoardJobs({
        platform: company.atsPlatform as SupportedAts,
        board: decodeURIComponent(board!),
        eu: company.atsPlatform === "LEVER" && detection.hostname === "jobs.eu.lever.co",
      });
    if (jobs.length > MAX_BOARD_JOBS) throw new Error("This job board has too many listings for one scan.");

    for (const job of jobs) {
      await db.job.upsert({
        where: {
          companyId_source_sourceId: {
            companyId: company.id,
            source: company.atsPlatform,
            sourceId: job.sourceId,
          },
        },
        create: {
          companyId: company.id,
          source: company.atsPlatform,
          sourceId: job.sourceId,
          title: job.title,
          location: job.location,
          employment: job.employment,
          url: job.url,
          description: job.description,
          descriptionText: job.descriptionText,
          firstSeenAt: scanStartedAt,
          lastSeenAt: scanStartedAt,
          closedAt: null,
        },
        update: {
          title: job.title,
          location: job.location,
          employment: job.employment,
          url: job.url,
          description: job.description,
          descriptionText: job.descriptionText,
          lastSeenAt: scanStartedAt,
          closedAt: null,
        },
      });
    }

    await db.$transaction([
      db.job.updateMany({
        where: {
          companyId: company.id,
          source: company.atsPlatform,
          closedAt: null,
          lastSeenAt: { lt: scanStartedAt },
        },
        data: { closedAt: scanStartedAt },
      }),
      db.company.update({
        where: { id: company.id },
        data: {
          lastScannedAt: scanStartedAt,
          nextScanAt: new Date(scanStartedAt.getTime() + RESCAN_INTERVAL_MS),
          lastScanError: null,
        },
      }),
    ]);
    await refreshCompanyMatches(company.id);
    return { scanned: jobs.length };
  } catch (error) {
    const safeError = error instanceof Error && /^The public job board returned HTTP \d+\.$/.test(error.message)
      ? error.message
      : error instanceof Error && error.message.startsWith("This job board has too many")
        ? error.message
        : "The public job board couldn’t be reached or returned unreadable data. Try again later.";
    await db.company.update({
      where: { id: company.id },
      data: { lastScanError: safeError.slice(0, 400), nextScanAt: new Date(Date.now() + RETRY_INTERVAL_MS) },
    });
    throw new Error(safeError);
  }
}
