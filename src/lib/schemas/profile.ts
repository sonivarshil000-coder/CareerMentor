import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const profileSchema = z.object({
  fullName: z.string().trim().min(1).max(100),
  email: z.email().max(254),
  phone: optionalText(40),
  city: optionalText(100),
  links: z.array(z.url()).max(8),
  noticePeriod: optionalText(120),
  expectedSalary: optionalText(120),
  workAuthorization: optionalText(160),
  needsVisaSponsorship: z.enum(["yes", "no", "unknown"]),
});

export const answerSchema = z.object({
  id: z.string().cuid().optional().or(z.literal("")),
  question: z.string().trim().min(3).max(300),
  answer: z.string().trim().min(1).max(5000),
  tags: z.array(z.string().trim().min(1).max(40)).max(12),
});

export function parseProfileForm(formData: FormData) {
  const rawLinks = String(formData.get("links") ?? "")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);

  return profileSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    city: formData.get("city"),
    links: rawLinks,
    noticePeriod: formData.get("noticePeriod"),
    expectedSalary: formData.get("expectedSalary"),
    workAuthorization: formData.get("workAuthorization"),
    needsVisaSponsorship: formData.get("needsVisaSponsorship"),
  });
}

export function parseAnswerForm(formData: FormData) {
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return answerSchema.safeParse({
    id: formData.get("id") ?? "",
    question: formData.get("question"),
    answer: formData.get("answer"),
    tags,
  });
}
