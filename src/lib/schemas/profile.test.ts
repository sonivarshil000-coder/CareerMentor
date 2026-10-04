import { describe, expect, it } from "vitest";
import { parseAnswerForm, parseProfileForm } from "@/lib/schemas/profile";

describe("profile and saved-answer validation", () => {
  it("accepts a complete profile and parses links one per line", () => {
    const form = new FormData();
    form.set("fullName", "Jordan Lee");
    form.set("email", "jordan@example.com");
    form.set("phone", "+91 99999 00000");
    form.set("city", "Surat");
    form.set("links", "https://example.com/profile\nhttps://github.com/jordan");
    form.set("noticePeriod", "Immediate");
    form.set("expectedSalary", "Optional");
    form.set("workAuthorization", "India");
    form.set("needsVisaSponsorship", "no");

    const result = parseProfileForm(form);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.links).toHaveLength(2);
  });

  it("rejects malformed links and missing visa-sponsorship facts", () => {
    const form = new FormData();
    form.set("fullName", "Jordan Lee");
    form.set("email", "jordan@example.com");
    form.set("links", "not-a-link");
    form.set("needsVisaSponsorship", "");
    expect(parseProfileForm(form).success).toBe(false);
  });

  it("normalizes answer tags without dropping the user's wording", () => {
    const form = new FormData();
    form.set("question", "Why are you applying?");
    form.set("answer", "I want to grow in data analysis.");
    form.set("tags", "career goals,  entry level, career goals");
    const result = parseAnswerForm(form);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.tags).toEqual(["career goals", "entry level", "career goals"]);
  });
});
