import { describe, expect, it } from "vitest";
import { isEntryLevelJob, scoreResumeMatch } from "./score";

describe("job matching", () => {
  it("finds entry-level jobs without treating senior internships as entry-level", () => {
    expect(isEntryLevelJob({ title: "Data Analyst Intern", location: null, employment: "Intern", descriptionText: "" })).toBe(true);
    expect(isEntryLevelJob({ title: "Senior Engineer", location: null, employment: "Intern", descriptionText: "Entry-level responsibilities" })).toBe(false);
    expect(isEntryLevelJob({ title: "Software Engineer", location: null, employment: null, descriptionText: "Suitable for recent graduates." })).toBe(true);
  });

  it("scores role, verified resume skills, location, and experience fit with a plain explanation", () => {
    const result = scoreResumeMatch(
      { title: "Junior Data Analyst", location: "Remote", employment: "Full-time", descriptionText: "Use SQL, Excel, and Tableau to build reports." },
      { targetRole: "Data Analyst", skills: ["SQL", "Excel"], experienceLevel: "entry" },
      ["Data Analyst"],
      ["Remote"],
    );
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.matchedSkills).toEqual(["SQL", "Excel"]);
    expect(result.skillGaps).toEqual(["Tableau"]);
    expect(result.explanation).toContain("2 of 3 listed skills");
  });

  it("does not fabricate matched skills when the posting has none from its known catalog", () => {
    const result = scoreResumeMatch(
      { title: "Operations Intern", location: "Pune", employment: "Intern", descriptionText: "Help the team coordinate daily operations." },
      { targetRole: "Operations", skills: ["SQL"], experienceLevel: "student" },
    );
    expect(result.matchedSkills).toEqual([]);
    expect(result.skillGaps).toEqual([]);
    expect(result.explanation).toContain("does not list skills");
  });
});
