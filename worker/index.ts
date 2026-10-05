import "dotenv/config";
import IORedis from "ioredis";
import { Queue, Worker } from "bullmq";
import { db } from "./db";
import { decryptResumeBytes, decodeFileEncryptionKey } from "@/lib/files/encryption";
import { getPrivateObject } from "./storage";
import { extractResumeText, parseResumeText } from "./resume-parser";
import { scanCompany } from "./discovery";
import { refreshUserMatches } from "./matching";

type ResumeJob = { userId: string; resumeId: string };

const connection = new IORedis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  { maxRetriesPerRequest: null, enableReadyCheck: true },
);

const worker = new Worker<ResumeJob>(
  "resume-processing",
  async (job) => {
    const { userId, resumeId } = job.data;
    const resume = await db.resume.findFirst({ where: { id: resumeId, userId } });
    if (!resume) return { skipped: true };

    await db.resume.updateMany({
      where: { id: resumeId, userId },
      data: { parseStatus: "PROCESSING", parseError: null },
    });

    try {
      const encrypted = await getPrivateObject(resume.objectKey);
      const key = decodeFileEncryptionKey(process.env.FILE_ENCRYPTION_KEY ?? "");
      const bytes = decryptResumeBytes(encrypted, key);
      const text = await extractResumeText(bytes, resume.mimeType);
      const parsedData = await parseResumeText(text, userId);
      await db.resume.updateMany({
        where: { id: resumeId, userId },
        data: { parsedData, parseStatus: "READY", parseError: null },
      });
      await refreshUserMatches(userId);
      return { skillCount: parsedData.skills.length };
    } catch (error) {
      const safeMessage = error instanceof Error && error.message === "Unsupported resume format."
        ? error.message
        : "We could not read this file. Try a text-based PDF or DOCX resume.";
      await db.resume.updateMany({
        where: { id: resumeId, userId },
        data: { parseStatus: "FAILED", parseError: safeMessage },
      });
      throw error;
    }
  },
  { connection, concurrency: 2 },
);

type DiscoveryJob = { companyId: string };
const discoveryQueue = new Queue<DiscoveryJob>("company-discovery", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: { count: 1_000 },
    removeOnFail: { count: 1_000 },
  },
});
const sweepQueue = new Queue("company-discovery-scheduler", { connection });

const discoveryWorker = new Worker<DiscoveryJob>(
  "company-discovery",
  async (job) => scanCompany(job.data.companyId),
  { connection, concurrency: 1, lockDuration: 120_000 },
);
const sweepWorker = new Worker(
  "company-discovery-scheduler",
  async () => {
    const due = await db.company.findMany({
      where: {
        discoveryEnabled: true,
        atsPlatform: { in: ["GREENHOUSE", "LEVER", "ASHBY", "WORKABLE", "GENERIC"] },
        OR: [{ nextScanAt: null }, { nextScanAt: { lte: new Date() } }],
      },
      select: { id: true, nextScanAt: true, createdAt: true },
      orderBy: { nextScanAt: "asc" },
      take: 100,
    });
    await Promise.all(due.map((company) => discoveryQueue.add(
      "scan-company",
      { companyId: company.id },
      { jobId: `${company.id}-${(company.nextScanAt ?? company.createdAt).getTime()}` },
    )));
    return { enqueued: due.length };
  },
  { connection, concurrency: 1, lockDuration: 120_000 },
);

void sweepQueue.upsertJobScheduler("sweep-due-companies", { every: 60_000 }, {
  name: "sweep-due-companies",
  data: {},
  opts: { removeOnComplete: true },
}).catch((error: unknown) => {
  console.error(`Discovery scheduler could not start: ${error instanceof Error ? error.message : "unknown error"}`);
});

worker.on("completed", (job) => {
  console.info(`Resume job ${job.id} completed.`);
});
worker.on("failed", (job, error) => {
  console.error(`Resume job ${job?.id ?? "unknown"} failed: ${error.message}`);
});
worker.on("error", (error) => {
  console.error(`Worker error: ${error.message}`);
});
discoveryWorker.on("completed", (job) => {
  console.info(`Company scan ${job.id} completed.`);
});
discoveryWorker.on("failed", (job, error) => {
  console.error(`Company scan ${job?.id ?? "unknown"} failed: ${error.message}`);
});
discoveryWorker.on("error", (error) => {
  console.error(`Discovery worker error: ${error.message}`);
});
sweepWorker.on("error", (error) => {
  console.error(`Discovery scheduler error: ${error.message}`);
});

async function shutdown() {
  await Promise.all([worker.close(), discoveryWorker.close(), sweepWorker.close(), discoveryQueue.close(), sweepQueue.close()]);
  await connection.quit();
  await db.$disconnect();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
