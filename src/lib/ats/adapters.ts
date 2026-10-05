import { createHash } from "node:crypto";
import { z } from "zod";
import type { SupportedAts } from "./detect";
import { htmlToText } from "./html";

const jobSchema = z.object({
  sourceId: z.string().min(1).max(240),
  title: z.string().trim().min(1).max(300),
  location: z.string().trim().max(250).nullable(),
  employment: z.string().trim().max(120).nullable(),
  url: z.string().url().refine((value) => new URL(value).protocol === "https:"),
  description: z.string().max(250_000),
  descriptionText: z.string().max(60_000),
});

export type NormalizedJob = z.infer<typeof jobSchema>;
export type BoardTarget = { platform: SupportedAts; board: string; eu?: boolean };

const MAX_RESPONSE_BYTES = 5_000_000;
const REQUEST_TIMEOUT_MS = 15_000;

export async function fetchBoardJobs(target: BoardTarget, fetcher = fetchJson): Promise<NormalizedJob[]> {
  if (!/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(target.board)) throw new Error("Invalid public job board identifier.");

  switch (target.platform) {
    case "GREENHOUSE": {
      const data = asRecord(await fetcher(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(target.board)}/jobs?content=true`));
      return mapItems(data.jobs, (item) => {
        const location = asRecord(item.location);
        return normalizeJob({
          sourceId: item.id,
          title: item.title,
          location: location.name,
          employment: null,
          url: item.absolute_url,
          description: item.content,
        });
      });
    }
    case "LEVER": {
      const host = target.eu ? "api.eu.lever.co" : "api.lever.co";
      const data = await fetcher(`https://${host}/v0/postings/${encodeURIComponent(target.board)}?mode=json`);
      return mapItems(data, (item) => {
        const categories = asRecord(item.categories);
        return normalizeJob({
          sourceId: item.id,
          title: item.text,
          location: categories.location,
          employment: categories.commitment,
          url: item.hostedUrl,
          description: item.description,
          descriptionText: item.descriptionPlain,
        });
      });
    }
    case "ASHBY": {
      const data = asRecord(await fetcher(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(target.board)}`));
      const listedJobs = Array.isArray(data.jobs)
        ? data.jobs.filter((job) => asRecord(job).isListed !== false)
        : data.jobs;
      return mapItems(listedJobs, (item) => {
        const url = safeHttpsUrl(item.jobUrl) ?? safeHttpsUrl(item.applyUrl);
        const stableId = item.id ?? (url ? new URL(url).pathname : null);
        return normalizeJob({
          sourceId: stableId,
          title: item.title,
          location: item.location,
          employment: item.employmentType,
          url,
          description: item.descriptionHtml,
          descriptionText: item.descriptionPlain,
        });
      }).filter((job, index, all) => all.findIndex((candidate) => candidate.sourceId === job.sourceId) === index);
    }
    case "WORKABLE": {
      const data = asRecord(await fetcher(`https://www.workable.com/api/accounts/${encodeURIComponent(target.board)}?details=true`));
      return mapItems(data.jobs, (item) => {
        const location = asRecord(item.location);
        return normalizeJob({
          sourceId: item.id ?? item.shortcode ?? item.short_code,
          title: item.title,
          location: location.location_str ?? item.location,
          employment: item.employmentType ?? item.employment_type ?? item.type,
          url: item.url ?? item.shortlink,
          description: item.description ?? item.description_html,
          descriptionText: item.descriptionPlain ?? item.description_text,
        });
      });
    }
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json", "user-agent": "CareerMentor/1.0 public-job-board-sync" },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`The public job board returned HTTP ${response.status}.`);
  const sizeHeader = Number(response.headers.get("content-length") ?? 0);
  if (sizeHeader > MAX_RESPONSE_BYTES) throw new Error("The public job board response was too large to process.");

  const reader = response.body?.getReader();
  if (!reader) return response.json();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("The public job board response was too large to process.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

function mapItems(input: unknown, mapper: (item: Record<string, unknown>) => NormalizedJob): NormalizedJob[] {
  if (!Array.isArray(input)) throw new Error("The public job board returned an unexpected response.");
  const jobs: NormalizedJob[] = [];
  for (const value of input) {
    try {
      jobs.push(mapper(asRecord(value)));
    } catch (error) {
      throw new Error("The public job board returned a malformed listing; no listings were updated.", { cause: error });
    }
  }
  return jobs;
}

export function normalizeJob(input: Record<string, unknown>): NormalizedJob {
  const url = safeHttpsUrl(input.url);
  const sourceId = stringValue(input.sourceId, 240) || (url ? createHash("sha256").update(url).digest("hex") : "");
  const description = stringValue(input.description, 250_000);
  const plain = htmlToText(stringValue(input.descriptionText, 60_000)) || htmlToText(description);
  return jobSchema.parse({
    sourceId,
    title: stringValue(input.title, 300),
    location: stringValue(input.location, 250) || null,
    employment: stringValue(input.employment, 120) || null,
    url,
    description,
    descriptionText: plain,
  });
}

function asRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return {};
  return input as Record<string, unknown>;
}

function stringValue(input: unknown, max: number) {
  return typeof input === "string" || typeof input === "number" ? String(input).trim().slice(0, max) : "";
}

function safeHttpsUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  try {
    const url = new URL(input);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
