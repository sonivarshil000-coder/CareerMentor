import { describe, expect, it } from "vitest";
import { extractJobLinks, extractRelatedCareerLinks, isAllowedByRobots, parseEightfoldJobDescription, parseEightfoldSearchResponse, parseGenericCareerHtml, parseOracleRecruitingResponse, parseRobots } from "./generic";

describe("generic public career pages", () => {
  it("reads schema.org JobPosting data and converts HTML descriptions to text", () => {
    const posting = {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Graduate Data Analyst",
      identifier: { value: "req-42" },
      employmentType: ["FULL_TIME", "INTERN"],
      jobLocation: { address: { addressLocality: "Mumbai", addressCountry: "India" } },
      description: '<div class="content-intro"><p>Work with <strong>data</strong> and teams.</p></div>',
      url: "https://careers.example.com/jobs/req-42",
    };
    const html = `<script type="application/ld+json">${JSON.stringify(posting)}</script>`;

    expect(parseGenericCareerHtml(html, "https://careers.example.com/jobs")).toMatchObject([{
      sourceId: "req-42",
      title: "Graduate Data Analyst",
      location: "Mumbai, India",
      employment: "FULL_TIME, INTERN",
      descriptionText: "Work with data and teams.",
    }]);
  });

  it("keeps discovered job links on the supplied careers host", () => {
    const links = extractJobLinks(`
      <a href="/careers/jobs/123">Graduate Engineer</a>
      <a href="/en-us/details/123/locationPicker">Where we are hiring</a>
      <a href="https://other.example/jobs/456">External job</a>
      <a href="/about">About</a>
    `, new URL("https://careers.example.com/careers"));
    expect(links).toEqual(["https://careers.example.com/careers/jobs/123"]);
  });

  it("discovers and reads career pages that use generic details routes", () => {
    const pageUrl = new URL("https://jobs.example.com/en-us/search");
    const links = extractJobLinks('<a href="/en-us/details/123/data-engineer">Data Engineer</a>', pageUrl);
    expect(links).toEqual(["https://jobs.example.com/en-us/details/123/data-engineer"]);
    expect(parseGenericCareerHtml(`
      <meta property="og:title" content="Data Engineer - Example Corp">
      <meta name="description" content="Build data systems and collaborate with product teams. This is a full-time role.">
    `, links[0]!)).toMatchObject([{
      title: "Data Engineer - Example Corp",
      url: "https://jobs.example.com/en-us/details/123/data-engineer",
      descriptionText: "Build data systems and collaborate with product teams. This is a full-time role.",
    }]);
  });

  it("extracts full listings from JSON embedded in career page scripts", () => {
    const payload = {
      loaderData: {
        root: {
          jobDetails: {
            jobsData: {
              jobNumber: "PIPE-200313970",
              postingTitle: "Business Expert",
              jobSummary: "Help business customers find the right products and services.",
              description: "Build long-term relationships with local business customers and mentor the team.",
            },
          },
        },
      },
    };
    const html = `<a href="/en-us/details/200313970/business-expert">Business Expert</a><script>window.__staticRouterHydrationData = JSON.parse(${JSON.stringify(JSON.stringify(payload))});</script>`;

    expect(parseGenericCareerHtml(html, "https://jobs.example.com/en-us/details/200313970/business-expert")).toMatchObject([{
      sourceId: "PIPE-200313970",
      title: "Business Expert",
      url: "https://jobs.example.com/en-us/details/200313970/business-expert",
      descriptionText: "Help business customers find the right products and services.\nBuild long-term relationships with local business customers and mentor the team.",
    }]);
  });

  it("follows same-company career portals and parses public Eightfold listings", () => {
    const portals = extractRelatedCareerLinks(
      '<a href="https://apply.hp.com/careers/join?domain=hp.com">Join Talent Network</a><a href="https://apply.hp.com/careers?domain=hp.com">Career categories</a><a href="https://apply.hp.com/careers/search">Search Jobs</a><a href="https://unrelated.example/jobs">Jobs</a>',
      new URL("https://jobs.hp.com"),
    );
    expect(portals).toEqual(["https://apply.hp.com/careers/search", "https://apply.hp.com/careers?domain=hp.com"]);

    const response = JSON.stringify({
      data: {
        count: 1,
        positions: [{
          id: 44602389,
          atsJobId: "3168930",
          name: "HP Industry Solutions Business Operations",
          locations: ["Spring, Texas, United States of America"],
          positionUrl: "/careers/job/44602389",
        }],
      },
    });
    expect(parseEightfoldSearchResponse(response, "https://apply.hp.com/careers")).toMatchObject([{
      sourceId: "44602389",
      title: "HP Industry Solutions Business Operations",
      location: "Spring, Texas, United States of America",
      url: "https://apply.hp.com/careers/job/44602389",
    }]);
    expect(parseEightfoldJobDescription(JSON.stringify({ data: { jobDescription: "<p>Manage complex sales operations.</p>" } })))
      .toBe("<p>Manage complex sales operations.</p>");
  });

  it("reads nested Oracle Candidate Experience job listings", () => {
    const body = JSON.stringify({
      items: [{
        SearchId: 1,
        requisitionList: [{
          Id: "210590075",
          Title: "Software Engineer",
          PrimaryLocation: "Bengaluru, India",
          WorkerType: "Regular",
          ShortDescriptionStr: "<p>Build reliable software.</p>",
        }],
      }],
    });
    expect(parseOracleRecruitingResponse(body, "https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs"))
      .toMatchObject([{
        sourceId: "210590075",
        title: "Software Engineer",
        location: "Bengaluru, India",
        employment: "Regular",
        url: "https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/210590075",
        descriptionText: "Build reliable software.",
      }]);
  });
  it("honors robots.txt disallow and most-specific allow rules", () => {
    const policy = parseRobots("User-agent: *\nDisallow: /jobs\nAllow: /jobs/public\nCrawl-delay: 2");
    expect(isAllowedByRobots(new URL("https://careers.example.com/jobs/private"), policy)).toBe(false);
    expect(isAllowedByRobots(new URL("https://careers.example.com/jobs/public/opening"), policy)).toBe(true);
  });
});
