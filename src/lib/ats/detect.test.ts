import { describe, expect, it } from "vitest";
import { detectAts } from "./detect";

describe("detectAts", () => {
  it("recognizes supported public board URLs and normalizes tracking fragments", () => {
    expect(detectAts("https://boards.greenhouse.io/acme?source=home#jobs")).toMatchObject({
      normalizedUrl: "https://boards.greenhouse.io/acme",
      platform: "GREENHOUSE",
      board: "acme",
    });
    expect(detectAts("https://jobs.eu.lever.co/acme/role-id")).toMatchObject({ platform: "LEVER", board: "acme" });
    expect(detectAts("https://jobs.ashbyhq.com/acme")).toMatchObject({ platform: "ASHBY", board: "acme" });
    expect(detectAts("https://apply.workable.com/acme")).toMatchObject({ platform: "WORKABLE", board: "acme" });
    expect(detectAts("https://apply.workable.com/j/ABCD123")).toMatchObject({ platform: "GENERIC", board: null });
  });

  it("routes public company career pages to the generic public crawler", () => {
    expect(detectAts("careers.example.com/jobs")).toMatchObject({ platform: "GENERIC", board: null });
    expect(detectAts("https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1002/jobs"))
      .toMatchObject({ platform: "GENERIC", board: null });
  });

  it("rejects insecure, credentialed, and job-aggregator URLs", () => {
    expect(() => detectAts("http://boards.greenhouse.io/acme")).toThrow(/HTTPS/);
    expect(() => detectAts("https://person:secret@boards.greenhouse.io/acme")).toThrow(/credentials/);
    expect(() => detectAts("https://jobs.indeed.com/acme")).toThrow(/LinkedIn, Indeed, and Naukri/);
  });
});
