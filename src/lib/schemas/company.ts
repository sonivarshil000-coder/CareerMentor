import { z } from "zod";

const splitList = (value: string, maxItems: number, maxLength: number) =>
  value.split(/[\n,;]/).map((entry) => entry.trim()).filter(Boolean).slice(0, maxItems).map((entry) => entry.slice(0, maxLength));

export const companyFormSchema = z.object({
  name: z.string().trim().min(1).max(100),
  careersUrl: z.string().trim().min(4).max(2_048),
  roleKeywords: z.string().max(1_000).transform((value) => splitList(value, 12, 80)),
  locations: z.string().max(1_000).transform((value) => splitList(value, 12, 100)),
});
