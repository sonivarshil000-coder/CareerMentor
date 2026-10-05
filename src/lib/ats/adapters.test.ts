import { describe, expect, it } from "vitest";
import { fetchBoardJobs } from "./adapters";

describe("public ATS adapters", () => {
  it("normalizes Greenhouse HTML and calls the fixed Greenhouse API host", async () => {
    let requested = "";
    const jobs = await fetchBoardJobs({ platform: "GREENHOUSE", board: "sample" }, async (url) => {
      requested = url;
      return {
        jobs: [{ id: 42, title: "Junior Analyst", location: { name: "Remote" }, absolute_url: "https://boards.greenhouse.io/sample/jobs/42", content: "<p>Analyze <b>data &amp; trends</b></p><script>ignore()</script>" }],
      };
    });
    expect(requested).toBe("https://boards-api.greenhouse.io/v1/boards/sample/jobs?content=true");
    expect(jobs[0]).toMatchObject({ sourceId: "42", title: "Junior Analyst", location: "Remote", descriptionText: "Analyze data & trends" });
  });

  it("normalizes Lever listings and uses its EU API host when requested", async () => {
    let requested = "";
    const jobs = await fetchBoardJobs({ platform: "LEVER", board: "sample", eu: true }, async (url) => {
      requested = url;
      return [{ id: "abc", text: "Graduate Engineer", categories: { location: "Berlin", commitment: "Full-time" }, hostedUrl: "https://jobs.eu.lever.co/sample/abc", description: "<p>Build things</p>", descriptionPlain: "Build things" }];
    });
    expect(requested).toContain("https://api.eu.lever.co/");
    expect(jobs[0]).toMatchObject({ sourceId: "abc", employment: "Full-time", descriptionText: "Build things" });
  });

  it("uses Ashby public job URLs as stable IDs and hides unlisted postings", async () => {
    const jobs = await fetchBoardJobs({ platform: "ASHBY", board: "sample" }, async () => ({
      jobs: [
        { title: "Product Intern", location: "New York", employmentType: "Intern", isListed: true, descriptionHtml: "<p>Learn</p>", descriptionPlain: "Learn", jobUrl: "https://jobs.ashbyhq.com/sample/role-123" },
        { title: "Unlisted", isListed: false, jobUrl: "https://jobs.ashbyhq.com/sample/hidden" },
      ],
    }));
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ sourceId: "/sample/role-123", title: "Product Intern", employment: "Intern" });
  });

  it("normalizes Workable's public job feed and hosted description", async () => {
    let requested = "";
    const jobs = await fetchBoardJobs({ platform: "WORKABLE", board: "sample" }, async (url) => {
      requested = url;
      return { jobs: [{ id: "job-1", title: "Graduate Engineer", location: { location_str: "Pune, India" }, employmentType: "Full-time", url: "https://apply.workable.com/sample/j/ABCD123", description: "<p>Build software with Java</p>" }] };
    });
    expect(requested).toBe("https://www.workable.com/api/accounts/sample?details=true");
    expect(jobs[0]).toMatchObject({ sourceId: "job-1", location: "Pune, India", descriptionText: "Build software with Java" });
  });

  it("fails closed when a board response is malformed", async () => {
    await expect(fetchBoardJobs({ platform: "GREENHOUSE", board: "sample" }, async () => ({ jobs: [{ title: "Broken" }] })))
      .rejects.toThrow(/malformed listing/);
  });
});
