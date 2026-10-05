export type SupportedAts = "GREENHOUSE" | "LEVER" | "ASHBY" | "WORKABLE";
export type AtsPlatform = SupportedAts | "GENERIC" | "UNSUPPORTED";

export type AtsDetection = {
  normalizedUrl: string;
  platform: AtsPlatform;
  board: string | null;
  reason: string | null;
};

const blockedHosts = ["linkedin.com", "indeed.com", "naukri.com"];
const boardPattern = /^[a-z0-9][a-z0-9._-]{0,99}$/i;

export function detectAts(input: string): AtsDetection {
  const candidate = input.trim();
  const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
  if (url.protocol !== "https:") throw new Error("Use a secure HTTPS careers page URL.");
  if (url.username || url.password || url.port) throw new Error("Enter a public careers page URL without credentials or a custom port.");

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (blockedHosts.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
    throw new Error("Add the company’s own careers page. LinkedIn, Indeed, and Naukri links aren’t supported.");
  }

  const parts = url.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  let platform: AtsPlatform = "GENERIC";
  let board: string | null = null;

  if (["boards.greenhouse.io", "job-boards.greenhouse.io"].includes(host)) {
    platform = "GREENHOUSE";
    board = parts[0] ?? null;
  } else if (host === "jobs.lever.co" || host === "jobs.eu.lever.co") {
    platform = "LEVER";
    board = parts[0] ?? null;
  } else if (host === "jobs.ashbyhq.com") {
    platform = "ASHBY";
    board = parts[0] ?? null;
  } else if (host === "apply.workable.com") {
    if (parts[0] !== "j") {
      platform = "WORKABLE";
      board = parts[0] ?? null;
    }
  }

  if (board && !boardPattern.test(board)) {
    platform = "GENERIC";
    board = null;
  }

  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";

  return {
    normalizedUrl: url.toString().replace(/\/$/, ""),
    platform,
    board,
    reason: null,
  };
}
