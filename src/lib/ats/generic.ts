import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest, type RequestOptions } from "node:https";
import { htmlToText } from "./html";
import { normalizeJob, type NormalizedJob } from "./adapters";

const USER_AGENT = "CareerMentor/1.0 (+public careers-page discovery)";
const MAX_RESPONSE_BYTES = 2_000_000;
const MAX_ROBOTS_BYTES = 512_000;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_LISTING_PAGES = 24;
const MIN_EMBEDDED_JOBS_FOR_DIRECT_RETURN = 10;
const MAX_EIGHTFOLD_JOBS = 20;
const MIN_REQUEST_GAP_MS = 1_000;
const JOB_PATH = /(?:job|career|opening|position|opportunit|vacanc|requisition|employment|role|posting|listing|details?)/i;
const blockedHosts = ["linkedin.com", "indeed.com", "naukri.com"];

type RobotsRule = { allow: boolean; path: string };
type RobotsGroup = { agents: string[]; rules: RobotsRule[]; crawlDelayMs: number };
type RobotsPolicy = { groups: RobotsGroup[]; sitemaps: string[]; inaccessible: boolean };
type TextResponse = { status: number; headers: Record<string, string | string[] | undefined>; body: string };

const robotsCache = new Map<string, { expiresAt: number; policy: RobotsPolicy }>();

export async function fetchGenericJobs(input: string): Promise<NormalizedJob[]> {
  const start = validatePublicHttpsUrl(input);
  if (isOracleCandidateExperience(start)) return fetchOracleJobs(start);
  const visited = new Set<string>();
  const jobs = new Map<string, NormalizedJob>();
  const startResponse = await fetchPageRespectingRobots(start);
  visited.add(startResponse.url.toString());
  const startEightfoldDomain = detectEightfoldDomain(startResponse.body);
  if (startEightfoldDomain) return fetchEightfoldJobs(startResponse.url, startEightfoldDomain);
  collectJsonLdJobs(startResponse.body, startResponse.url, jobs);
  collectEmbeddedJobData(startResponse.body, startResponse.url, jobs);
  if (jobs.size >= MIN_EMBEDDED_JOBS_FOR_DIRECT_RETURN) return [...jobs.values()].slice(0, 1_000);

  const candidates = new Set<string>(extractJobLinks(startResponse.body, startResponse.url));
  for (const portalLink of extractRelatedCareerLinks(startResponse.body, startResponse.url)) candidates.add(portalLink);
  const startCareerDomain = careerDomainKey(startResponse.url.hostname);
  const startPolicy = await getRobotsPolicy(startResponse.url.origin);
  const sitemapUrls = startPolicy.sitemaps.length > 0
    ? startPolicy.sitemaps
    : [`${startResponse.url.origin}/sitemap.xml`];

  for (const sitemapUrl of sitemapUrls.slice(0, 5)) {
    try {
      const sitemap = validatePublicHttpsUrl(sitemapUrl);
      if (sitemap.origin !== startResponse.url.origin) continue;
      const response = await fetchPageRespectingRobots(sitemap, "xml,text/plain");
      for (const pageUrl of extractSitemapJobUrls(response.body, response.url)) {
        if (candidates.size >= MAX_LISTING_PAGES * 3) break;
        candidates.add(pageUrl);
      }
    } catch {
      // Sitemaps are an optional discovery source; the careers page can still be scanned.
    }
  }

  let lastRequestAt = Date.now();
  let pageCount = 0;
  for (const candidate of candidates) {
    if (pageCount >= MAX_LISTING_PAGES || jobs.size >= 1_000) break;
    const url = validatePublicHttpsUrl(candidate);
    if (careerDomainKey(url.hostname) !== startCareerDomain || visited.has(url.toString())) continue;
    const policy = await getRobotsPolicy(url.origin);
    if (!isAllowedByRobots(url, policy)) continue;

    const gap = Date.now() - lastRequestAt;
    const requiredGap = Math.max(MIN_REQUEST_GAP_MS, policyDelayMs(policy));
    if (gap < requiredGap) await delay(requiredGap - gap);
    lastRequestAt = Date.now();

    try {
      const response = await fetchPageRespectingRobots(url, "text/html,application/xhtml+xml");
      visited.add(response.url.toString());
      const eightfoldDomain = detectEightfoldDomain(response.body);
      if (eightfoldDomain) return fetchEightfoldJobs(response.url, eightfoldDomain);
      collectJsonLdJobs(response.body, response.url, jobs);
      collectEmbeddedJobData(response.body, response.url, jobs);
      if (jobs.size === 0) {
        const fallback = makeJobFromDetailPage(response.body, response.url);
        if (fallback) jobs.set(fallback.sourceId, fallback);
      }
      pageCount += 1;
    } catch {
      // One broken job page should not hide other public postings on the same site.
    }
  }

  if (jobs.size === 0) {
    throw new Error("No readable public job listings were found. The page may need JavaScript, block crawlers, or use an unsupported format.");
  }
  return [...jobs.values()].slice(0, 1_000);
}

function isOracleCandidateExperience(url: URL): boolean {
  return url.hostname.toLowerCase().endsWith(".oraclecloud.com")
    && /\/hcmUI\/CandidateExperience\/[^/]+\/sites\/[^/]+/i.test(url.pathname);
}

async function fetchOracleJobs(careerUrl: URL): Promise<NormalizedJob[]> {
  const route = careerUrl.pathname.match(/^(.*\/hcmUI\/CandidateExperience\/[^/]+\/sites\/([^/]+))/i);
  if (!route?.[1] || !route[2]) throw new Error("The Oracle careers URL does not include a public site number.");
  const siteNumber = route[2];
  const apiUrl = new URL("/hcmRestApi/resources/latest/recruitingCEJobRequisitions", careerUrl.origin);
  const policy = await getRobotsPolicy(apiUrl.origin);
  apiUrl.searchParams.set("expand", "requisitionList");
  apiUrl.searchParams.set("onlyData", "true");
  apiUrl.searchParams.set("limit", "100");

  const jobs = new Map<string, NormalizedJob>();
  let offset = 0;
  let lastRequestAt = 0;
  for (let page = 0; page < 10; page += 1) {
    const endpoint = new URL(apiUrl);
    endpoint.searchParams.set("finder", "findReqs;siteNumber=" + siteNumber + ",limit=100,offset=" + offset);
    if (!isAllowedByRobots(endpoint, policy)) {
      throw new Error("The Oracle public careers API disallows automated access.");
    }
    const gap = Date.now() - lastRequestAt;
    const requiredGap = Math.max(MIN_REQUEST_GAP_MS, policyDelayMs(policy));
    if (lastRequestAt && gap < requiredGap) await delay(requiredGap - gap);
    lastRequestAt = Date.now();

    const response = await requestPublicText(endpoint, "application/json", MAX_RESPONSE_BYTES);
    if (response.status >= 400) throw new Error("The Oracle public careers API returned HTTP " + response.status + ".");
    const pageJobs = parseOracleRecruitingResponse(response.body, careerUrl.toString());
    for (const job of pageJobs) jobs.set(job.sourceId, job);
    if (pageJobs.length < 100) break;
    offset += pageJobs.length;
  }
  if (jobs.size === 0) {
    throw new Error("No public Oracle job listings were readable from this career site.");
  }
  return [...jobs.values()].slice(0, 1_000);
}

export function parseOracleRecruitingResponse(body: string, careerUrl: string): NormalizedJob[] {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error("The Oracle public careers API returned invalid JSON.");
  }
  const start = new URL(careerUrl);
  const route = start.pathname.match(/^(.*\/hcmUI\/CandidateExperience\/[^/]+\/sites\/([^/]+))/i);
  if (!route?.[1] || !route[2]) throw new Error("The Oracle careers URL does not include a public site number.");
  const basePath = route[1];
  const jobs = new Map<string, NormalizedJob>();
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
      return;
    }
    if (typeof value !== "object" || value === null) return;
    const record = value as Record<string, unknown>;
    const title = oracleString(record, ["Title", "title", "JobTitle"]);
    const id = oracleString(record, ["Id", "id", "RequisitionId", "requisitionId"]);
    const location = oracleString(record, ["PrimaryLocation", "Location", "location"]);
    const description = oracleString(record, ["ExternalDescriptionStr", "Description", "ShortDescriptionStr", "description"]);
    if (title && id && (location || description || oracleString(record, ["ExternalUrl", "ExternalUrlSeo"]))) {
      const defaultUrl = new URL(basePath + "/job/" + encodeURIComponent(id), start.origin);
      const rawUrl = oracleString(record, ["ExternalUrlSeo", "ExternalUrl", "Url", "url"]);
      let jobUrl = defaultUrl;
      if (rawUrl) {
        try {
          const candidate = new URL(rawUrl, start);
          if (candidate.origin === start.origin && candidate.pathname.includes("/CandidateExperience/")) jobUrl = candidate;
        } catch {
          // Use Oracle's public job route when a listing has a malformed URL.
        }
      }
      const employment = oracleString(record, ["WorkerType", "ContractType", "JobType"]);
      try {
        const job = normalizeJob({
          sourceId: id,
          title,
          location,
          employment,
          url: jobUrl.toString(),
          description,
          descriptionText: description,
        });
        jobs.set(job.sourceId, job);
      } catch {
        // Ignore incomplete Oracle records while keeping other public listings.
      }
    }
    for (const child of Object.values(record)) {
      if (typeof child === "object" && child !== null) visit(child);
    }
  };
  visit(payload);
  return [...jobs.values()];
}

function oracleString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") return String(value).trim();
    if (typeof value === "object" && value !== null) {
      const nested = value as Record<string, unknown>;
      for (const nestedKey of ["Name", "LocationName", "name", "value"]) {
        if (typeof nested[nestedKey] === "string") return nested[nestedKey].trim();
      }
    }
  }
  return "";
}
export function parseGenericCareerHtml(html: string, pageUrl: string): NormalizedJob[] {
  const url = new URL(pageUrl);
  const jobs = new Map<string, NormalizedJob>();
  collectJsonLdJobs(html, url, jobs);
  collectEmbeddedJobData(html, url, jobs);
  if (jobs.size === 0) {
    const fallback = makeJobFromDetailPage(html, url);
    if (fallback) jobs.set(fallback.sourceId, fallback);
  }
  return [...jobs.values()];
}

export function extractJobLinks(html: string, pageUrl: URL): string[] {
  const links = new Set<string>();
  const anchor = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  for (const match of html.matchAll(anchor)) {
    const attributes = match[1] ?? "";
    const href = attributes.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if (!href) continue;
    const rawHref = href[1] ?? href[2] ?? href[3] ?? "";
    const linkText = htmlToText(match[2] ?? "");
    if (!JOB_PATH.test(`${rawHref} ${linkText}`)) continue;

    try {
      const candidate = new URL(rawHref, pageUrl);
      if (candidate.protocol !== "https:" || candidate.origin !== pageUrl.origin) continue;
      if (/\/locationpicker(?:\/|$)/i.test(candidate.pathname)) continue;
      if (/\.(?:pdf|docx?|xlsx?|png|jpe?g|svg|zip)(?:$|\?)/i.test(candidate.pathname)) continue;
      candidate.hash = "";
      candidate.searchParams.delete("utm_source");
      candidate.searchParams.delete("utm_medium");
      candidate.searchParams.delete("utm_campaign");
      candidate.searchParams.delete("source");
      if (candidate.toString() !== pageUrl.toString()) links.add(candidate.toString());
      if (links.size >= MAX_LISTING_PAGES * 3) break;
    } catch {
      // Ignore malformed or non-URL anchors.
    }
  }
  return [...links];
}

export function extractRelatedCareerLinks(html: string, pageUrl: URL): string[] {
  const links = new Map<string, number>();
  const anchor = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  for (const match of html.matchAll(anchor)) {
    const attributes = match[1] ?? "";
    const href = attributes.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if (!href) continue;
    const rawHref = href[1] ?? href[2] ?? href[3] ?? "";
    const linkText = htmlToText(match[2] ?? "");
    if (!/(?:search\s*jobs?|jobs?\s*search|careers?|job\s*openings?|open\s*positions?|vacanc|opportunit)/i.test(`${rawHref} ${linkText}`)) continue;

    try {
      const candidate = validatePublicHttpsUrl(new URL(rawHref, pageUrl).toString());
      if (candidate.origin === pageUrl.origin || careerDomainKey(candidate.hostname) !== careerDomainKey(pageUrl.hostname)) continue;
      if (/\/join(?:\/|$)/i.test(candidate.pathname)) continue;
      candidate.hash = "";
      if (candidate.toString() !== pageUrl.toString()) {
        const priority = /(?:search\s*jobs?|jobs?\s*search)/i.test(linkText) ? 2 : 1;
        const existing = links.get(candidate.toString()) ?? 0;
        if (priority > existing) links.set(candidate.toString(), priority);
      }
    } catch {
      // Ignore unrelated or malformed external links.
    }
  }
  return [...links.entries()].sort((left, right) => right[1] - left[1]).slice(0, 3).map(([link]) => link);
}

function careerDomainKey(hostname: string): string {
  const labels = hostname.toLowerCase().replace(/\.$/, "").split(".");
  const careerSubdomains = new Set(["www", "job", "jobs", "career", "careers", "apply", "work", "talent", "recruit", "recruiting", "employment", "opportunities"]);
  while (labels.length > 2 && careerSubdomains.has(labels[0]!)) labels.shift();
  return labels.join(".");
}

function detectEightfoldDomain(html: string): string | null {
  if (!/(?:pcsxConfig|\/api\/pcsx\/search|static\.vscdn\.net\/images\/careers)/i.test(html)) return null;
  const decoded = html.replace(/&#34;|&quot;/gi, '"');
  const domain = decoded.match(/"domain"\s*:\s*"([a-z0-9.-]+)"/i)?.[1]?.toLowerCase();
  return domain && !domain.startsWith(".") && !domain.endsWith(".") && !domain.includes("..") ? domain : null;
}

async function fetchEightfoldJobs(careersUrl: URL, tenantDomain: string): Promise<NormalizedJob[]> {
  const jobs = new Map<string, NormalizedJob>();
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  let lastRequestAt = 0;

  const requestJson = async (url: URL): Promise<unknown> => {
    const policy = await getRobotsPolicy(url.origin);
    if (!isAllowedByRobots(url, policy)) throw new Error("The public careers API disallows automated access.");
    const gap = Date.now() - lastRequestAt;
    const requiredGap = Math.max(MIN_REQUEST_GAP_MS, policyDelayMs(policy));
    if (lastRequestAt && gap < requiredGap) await delay(requiredGap - gap);
    lastRequestAt = Date.now();
    const response = await requestPublicText(url, "application/json", MAX_RESPONSE_BYTES);
    if (response.status >= 400) throw new Error(`The public careers API returned HTTP ${response.status}.`);
    try {
      return JSON.parse(response.body) as unknown;
    } catch {
      throw new Error("The public careers API returned invalid JSON.");
    }
  };

  while (offset < total && jobs.size < MAX_EIGHTFOLD_JOBS) {
    const searchUrl = new URL("/api/pcsx/search", careersUrl.origin);
    searchUrl.searchParams.set("domain", tenantDomain);
    searchUrl.searchParams.set("query", "");
    searchUrl.searchParams.set("location", "");
    searchUrl.searchParams.set("start", String(offset));
    const payload = asRecord(await requestJson(searchUrl));
    const data = asRecord(payload.data);
    const positions = Array.isArray(data.positions) ? data.positions : [];
    if (positions.length === 0) break;
    const reportedTotal = Number(data.count);
    if (Number.isFinite(reportedTotal) && reportedTotal >= 0) total = reportedTotal;

    for (const value of positions) {
      try {
        const job = mapEightfoldPosition(asRecord(value), careersUrl);
        if (job) jobs.set(job.sourceId, job);
      } catch {
        // Ignore an incomplete position while retaining the rest of the page.
      }
      if (jobs.size >= MAX_EIGHTFOLD_JOBS) break;
    }
    offset += positions.length;
  }

  for (const [sourceId, job] of jobs) {
    const detailsUrl = new URL("/api/pcsx/position_details", careersUrl.origin);
    detailsUrl.searchParams.set("position_id", sourceId);
    detailsUrl.searchParams.set("domain", tenantDomain);
    detailsUrl.searchParams.set("hl", "en");
    try {
      const payload = await requestJson(detailsUrl);
      const description = parseEightfoldJobDescription(JSON.stringify(payload));
      if (description) {
        jobs.set(sourceId, normalizeJob({ ...job, description, descriptionText: description }));
      }
    } catch {
      // Keep the public listing even if its individual description endpoint is unavailable.
    }
  }

  if (jobs.size === 0) throw new Error("No public jobs were returned by the Eightfold careers site.");
  return [...jobs.values()];
}

function mapEightfoldPosition(position: Record<string, unknown>, careersUrl: URL): NormalizedJob | null {
  const sourceId = stringValue(position.id) || stringValue(position.atsJobId);
  const title = stringValue(position.name) || stringValue(position.title);
  if (!sourceId || !title) return null;
  const locations = Array.isArray(position.locations)
    ? position.locations.map(stringValue).filter(Boolean).join(", ")
    : stringValue(position.location);
  let jobUrl = new URL(`/careers/job/${encodeURIComponent(sourceId)}`, careersUrl.origin).toString();
  const positionUrl = stringValue(position.positionUrl);
  if (positionUrl) {
    try {
      const candidate = new URL(positionUrl, careersUrl);
      if (candidate.origin === careersUrl.origin && candidate.protocol === "https:") jobUrl = candidate.toString();
    } catch {
      // Use the standard Eightfold job route for malformed position URLs.
    }
  }
  return normalizeJob({
    sourceId,
    title,
    location: locations,
    employment: stringValue(position.employmentType) || stringValue(position.workerType),
    url: jobUrl,
    description: stringValue(position.jobDescription) || stringValue(position.description),
  });
}

export function parseEightfoldSearchResponse(body: string, careersUrl: string): NormalizedJob[] {
  let payload: unknown;
  try {
    payload = JSON.parse(body) as unknown;
  } catch {
    throw new Error("The Eightfold public job search returned invalid JSON.");
  }
  const data = asRecord(asRecord(payload).data);
  if (!Array.isArray(data.positions)) throw new Error("The Eightfold public job search returned an unexpected response.");
  const baseUrl = new URL(careersUrl);
  return data.positions.flatMap((value) => {
    try {
      const job = mapEightfoldPosition(asRecord(value), baseUrl);
      return job ? [job] : [];
    } catch {
      return [];
    }
  });
}

export function parseEightfoldJobDescription(body: string): string {
  try {
    const payload = asRecord(JSON.parse(body) as unknown);
    const data = asRecord(payload.data);
    return stringValue(data.jobDescription) || stringValue(data.description);
  } catch {
    return "";
  }
}

function extractSitemapJobUrls(xml: string, sitemapUrl: URL): string[] {
  const urls: string[] = [];
  for (const match of xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc\s*>/gi)) {
    const raw = decodeXml(match[1] ?? "").trim();
    try {
      const url = new URL(raw, sitemapUrl);
      if (url.origin === sitemapUrl.origin && url.protocol === "https:" && JOB_PATH.test(url.pathname)) {
        url.hash = "";
        urls.push(url.toString());
      }
    } catch {
      // Ignore malformed sitemap locations.
    }
    if (urls.length >= MAX_LISTING_PAGES * 3) break;
  }
  return urls;
}

function collectJsonLdJobs(html: string, pageUrl: URL, jobs: Map<string, NormalizedJob>) {
  const scripts = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  for (const match of html.matchAll(scripts)) {
    if (!/\btype\s*=\s*["']?application\/ld\+json/i.test(match[1] ?? "")) continue;
    try {
      const data: unknown = JSON.parse((match[2] ?? "").trim().replace(/^<!--|-->$/g, ""));
      for (const node of walkJson(data)) {
        const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
        if (!types.some((type) => typeof type === "string" && type.toLowerCase() === "jobposting")) continue;
        const mapped = mapJobPosting(node, pageUrl);
        if (mapped) jobs.set(mapped.sourceId, mapped);
      }
    } catch {
      // Malformed JSON-LD does not make the rest of the public page unusable.
    }
  }
}

function collectEmbeddedJobData(html: string, pageUrl: URL, jobs: Map<string, NormalizedJob>) {
  const scripts = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  const jobLinks = extractJobLinks(html, pageUrl);
  for (const match of html.matchAll(scripts)) {
    const body = (match[2] ?? "").trim();
    let payload: unknown;
    try {
      const jsonParseArgument = body.match(/\bJSON\.parse\(\s*("(?:\\.|[^"\\])*")\s*\)/);
      if (jsonParseArgument?.[1]) {
        const decoded = JSON.parse(jsonParseArgument[1]) as unknown;
        payload = typeof decoded === "string" ? JSON.parse(decoded) as unknown : decoded;
      } else if (/\btype\s*=\s*["']?application\/(?:json|ld\+json)/i.test(match[1] ?? "")) {
        payload = JSON.parse(body) as unknown;
      }
    } catch {
      continue;
    }
    if (payload === undefined) continue;

    for (const record of walkJson(payload)) {
      const mapped = mapEmbeddedJobRecord(record, pageUrl, jobLinks);
      if (mapped) jobs.set(mapped.sourceId, mapped);
    }
  }
}

function mapEmbeddedJobRecord(record: Record<string, unknown>, pageUrl: URL, jobLinks: string[]): NormalizedJob | null {
  const title = embeddedString(record, ["postingTitle", "jobTitle", "positionTitle", "title", "Title"]);
  const description = [
    embeddedString(record, ["jobSummary", "summary", "shortDescription", "ShortDescription"]),
    embeddedString(record, ["description", "jobDescription", "descriptionHtml", "externalDescription"]),
  ].filter(Boolean).join("\n\n");
  const sourceId = embeddedString(record, ["jobNumber", "requisitionId", "requisitionNumber", "reqId", "jobId", "postingId"]);
  if (!title || !sourceId || description.length < 30) return null;

  const embeddedUrl = embeddedString(record, ["absoluteUrl", "jobUrl", "postingUrl", "url"]);
  const linkedUrl = jobLinks.find((link) => {
    try {
      const sourceIdLower = sourceId.toLowerCase();
      return new URL(link).pathname.split("/").some((part) => {
        const pathPart = decodeURIComponent(part).toLowerCase();
        return pathPart === sourceIdLower || sourceIdLower.endsWith(`-${pathPart}`) || sourceIdLower.endsWith(`_${pathPart}`);
      });
    } catch {
      return false;
    }
  });
  const rawUrl = embeddedUrl || linkedUrl;
  const rawLocation = embeddedString(record, ["primaryLocation", "primaryLocationName", "locationName", "location", "locations", "jobLocations", "jobLocation", "postingLocation"]);
  const employment = embeddedString(record, ["employmentType", "workerType", "jobType", "employment"]);
  try {
    return normalizeJob({
      sourceId,
      title,
      location: rawLocation,
      employment,
      url: rawUrl || pageUrl.toString(),
      description,
      descriptionText: description,
    });
  } catch {
    return null;
  }
}

function embeddedString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") return String(value).trim();
    if (Array.isArray(value)) {
      const parts = value.map((item) => typeof item === "string" || typeof item === "number"
        ? String(item).trim()
        : embeddedString(asRecord(item), ["name", "displayName", "label", "value", "city", "country"]))
        .filter(Boolean);
      if (parts.length > 0) return parts.join(", ");
    }
    if (typeof value === "object" && value !== null) {
      const nested = embeddedString(asRecord(value), ["name", "displayName", "label", "value", "city", "country"]);
      if (nested) return nested;
    }
  }
  return "";
}

function* walkJson(value: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(value)) {
    for (const item of value) yield* walkJson(item);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const record = value as Record<string, unknown>;
  yield record;
  for (const [key, child] of Object.entries(record)) {
    if (key === "@context") continue;
    if (typeof child === "object" && child !== null) yield* walkJson(child);
  }
}

function mapJobPosting(posting: Record<string, unknown>, pageUrl: URL): NormalizedJob | null {
  const title = stringValue(posting.title);
  if (!title) return null;
  const rawUrl = stringValue(posting.url) || pageUrl.toString();
  let jobUrl: string;
  try {
    const parsed = new URL(rawUrl, pageUrl);
    if (parsed.protocol !== "https:") return null;
    jobUrl = parsed.toString();
  } catch {
    return null;
  }

  const locations = Array.isArray(posting.jobLocation) ? posting.jobLocation : [posting.jobLocation];
  const locationParts: string[] = [];
  for (const value of locations) {
    const jobLocation = asRecord(value);
    const address = asRecord(jobLocation.address);
    for (const field of ["addressLocality", "addressRegion", "addressCountry"]) {
      const part = address[field];
      const text = typeof part === "object" && part !== null ? stringValue(asRecord(part).name) : stringValue(part);
      if (text && !locationParts.includes(text)) locationParts.push(text);
    }
  }
  const employment = Array.isArray(posting.employmentType)
    ? posting.employmentType.map(stringValue).filter(Boolean).join(", ")
    : stringValue(posting.employmentType);
  const identifier = posting.identifier;
  const sourceId = typeof identifier === "string"
    ? identifier
    : stringValue(asRecord(identifier).value) || jobUrl;

  try {
    return normalizeJob({
      sourceId,
      title,
      location: locationParts.join(", "),
      employment,
      url: jobUrl,
      description: stringValue(posting.description),
      descriptionText: stringValue(posting.description),
    });
  } catch {
    return null;
  }
}

function makeJobFromDetailPage(html: string, pageUrl: URL): NormalizedJob | null {
  if (!JOB_PATH.test(pageUrl.pathname)) return null;
  const title = htmlAttribute(html, "property", "og:title")
    || htmlTagText(html, "h1")
    || htmlTagText(html, "title");
  if (!title) return null;
  const description = htmlAttribute(html, "name", "description")
    || htmlToText(html.match(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/i)?.[1] ?? "");
  if (description.length < 40) return null;
  try {
    return normalizeJob({
      sourceId: pageUrl.toString(),
      title,
      location: "",
      employment: "",
      url: pageUrl.toString(),
      description,
      descriptionText: description,
    });
  } catch {
    return null;
  }
}

function htmlAttribute(html: string, attribute: string, value: string): string {
  const meta = /<meta\b([^>]*)>/gi;
  for (const match of html.matchAll(meta)) {
    const attributes = match[1] ?? "";
    const key = attributes.match(new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
    if (key?.toLowerCase() !== value.toLowerCase()) continue;
    const content = attributes.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1];
    if (content) return htmlToText(content);
  }
  return "";
}

function htmlTagText(html: string, tag: string): string {
  return htmlToText(html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>`, "i"))?.[1] ?? "").slice(0, 300);
}

async function fetchPageRespectingRobots(input: URL, accept = "text/html,application/xhtml+xml") {
  let current = new URL(input);
  for (let redirects = 0; redirects <= 4; redirects += 1) {
    const policy = await getRobotsPolicy(current.origin);
    if (!isAllowedByRobots(current, policy)) throw new Error("The site disallows automated access to this careers page.");
    const response = await requestPublicText(current, accept, MAX_RESPONSE_BYTES);
    const location = firstHeader(response.headers.location);
    if (response.status >= 300 && response.status < 400 && location) {
      const next = new URL(location, current);
      if (next.origin !== current.origin || next.protocol !== "https:") {
        throw new Error("The careers page redirects to a different site. Add its public careers URL directly.");
      }
      current = next;
      continue;
    }
    if (response.status >= 400) throw new Error(`The public careers page returned HTTP ${response.status}.`);
    const contentType = firstHeader(response.headers["content-type"])?.toLowerCase() ?? "";
    if (!/(?:text\/html|application\/xhtml\+xml|application\/xml|text\/xml|text\/plain)/.test(contentType)) {
      throw new Error("The careers page did not return readable public text.");
    }
    return { url: current, body: response.body };
  }
  throw new Error("The careers page redirected too many times.");
}

async function getRobotsPolicy(origin: string): Promise<RobotsPolicy> {
  const cached = robotsCache.get(origin);
  if (cached && cached.expiresAt > Date.now()) return cached.policy;
  let url = new URL("/robots.txt", origin);
  let policy: RobotsPolicy;
  try {
    let response: TextResponse | null = null;
    for (let redirects = 0; redirects <= 5; redirects += 1) {
      response = await requestPublicText(url, "text/plain", MAX_ROBOTS_BYTES);
      const location = firstHeader(response.headers.location);
      if (response.status < 300 || response.status >= 400 || !location) break;
      if (redirects === 5) {
        response = null;
        break;
      }
      url = validatePublicHttpsUrl(new URL(location, url).toString());
    }

    if (!response) {
      policy = { groups: [], sitemaps: [], inaccessible: true };
    } else if (response.status === 404 || response.status === 410) {
      policy = { groups: [], sitemaps: [], inaccessible: false };
    } else if (response.status >= 200 && response.status < 300) {
      policy = parseRobots(response.body);
    } else {
      policy = { groups: [], sitemaps: [], inaccessible: true };
    }
  } catch {
    policy = { groups: [], sitemaps: [], inaccessible: true };
  }
  robotsCache.set(origin, { expiresAt: Date.now() + 10 * 60_000, policy });
  return policy;
}

export function parseRobots(text: string): RobotsPolicy {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let sawRule = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split("#", 1)[0]?.trim() ?? "";
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === "sitemap") {
      if (/^https:\/\//i.test(value)) sitemaps.push(value);
      continue;
    }
    if (key === "user-agent") {
      if (!current || sawRule) {
        current = { agents: [], rules: [], crawlDelayMs: 0 };
        groups.push(current);
        sawRule = false;
      }
      current.agents.push(value.toLowerCase());
      continue;
    }
    if (!current) continue;
    if (key === "allow" || key === "disallow") {
      if (value) current.rules.push({ allow: key === "allow", path: value });
      sawRule = true;
    } else if (key === "crawl-delay") {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0) current.crawlDelayMs = seconds * 1_000;
      sawRule = true;
    }
  }
  return { groups, sitemaps: [...new Set(sitemaps)], inaccessible: false };
}

export function isAllowedByRobots(url: URL, policy: RobotsPolicy): boolean {
  if (policy.inaccessible) return false;
  const named = policy.groups.filter((group) => group.agents.some((agent) => agent !== "*" && "careermentor".startsWith(agent)));
  const selected = named.length > 0 ? named : policy.groups.filter((group) => group.agents.includes("*"));
  const rules = selected.flatMap((group) => group.rules);
  const path = `${url.pathname}${url.search}`;
  const matching = rules
    .filter((rule) => robotsPathMatches(rule.path, path))
    .sort((a, b) => specificity(b.path) - specificity(a.path));
  if (matching.length === 0) return true;
  const longest = specificity(matching[0]!.path);
  return matching.find((rule) => specificity(rule.path) === longest)!.allow;
}

function policyDelayMs(policy: RobotsPolicy): number {
  const groups = policy.groups.filter((group) => group.agents.includes("*") || group.agents.some((agent) => "careermentor".startsWith(agent)));
  return Math.max(0, ...groups.map((group) => group.crawlDelayMs));
}

function robotsPathMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const source = pattern.replace(/\$$/, "").split("*").map(escapeRegex).join(".*");
  return new RegExp(`^${source}${anchored ? "$" : ""}`).test(path);
}

function specificity(pattern: string): number {
  return pattern.replace(/[\*$]/g, "").length;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function requestPublicText(url: URL, accept: string, maxBytes: number): Promise<TextResponse> {
  validatePublicHttpsUrl(url.toString());
  const host = url.hostname.toLowerCase();
  if (blockedHosts.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
    throw new Error("This public job source is not supported.");
  }
  const addresses = await dnsLookup(host, { all: true, family: 4, verbatim: true });
  if (addresses.length === 0 || addresses.some((entry) => isPrivateIpv4(entry.address))) {
    throw new Error("The careers host does not resolve to a public server.");
  }
  const address = addresses[0]!.address;
  return new Promise((resolve, reject) => {
    const lookupPinned = ((_hostname: string, _options: unknown, callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void) => {
      callback(null, address, 4);
    }) as NonNullable<RequestOptions["lookup"]>;
    const request = httpsRequest(url, {
      method: "GET",
      family: 4,
      lookup: lookupPinned,
      headers: { "user-agent": USER_AGENT, accept, "accept-encoding": "identity" },
      timeout: REQUEST_TIMEOUT_MS,
    }, (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.byteLength;
        if (size > maxBytes) {
          response.destroy(new Error("The public careers page response was too large."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({
        status: response.statusCode ?? 0,
        headers: response.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
      response.on("error", reject);
    });
    request.on("timeout", () => request.destroy(new Error("The public careers page timed out.")));
    request.on("error", reject);
    request.end();
  });
}

function validatePublicHttpsUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid public careers page URL.");
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error("Only public HTTPS careers pages without credentials or custom ports can be scanned.");
  }
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || isIP(hostname)) {
    throw new Error("Private or local hosts cannot be scanned.");
  }
  return url;
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = parts as [number, number, number, number];
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 168 || (b === 0 && c === 0) || (b === 0 && c === 2)))
    || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
    || (a === 203 && b === 0 && c === 113);
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function stringValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function decodeXml(value: string): string {
  return value.replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&apos;|&#39;/gi, "'");
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
