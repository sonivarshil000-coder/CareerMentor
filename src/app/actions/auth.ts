"use server";

import { z } from "zod";
import { signIn } from "@/auth";
import { db } from "@/lib/db";
import {
  CONSENT_WINDOW_MS,
  CURRENT_CONSENT_VERSION,
} from "@/lib/auth/consent";

const authRequestSchema = z.object({
  provider: z.enum(["nodemailer", "google"]),
  email: z.email().max(254),
  consent: z.literal(true),
});

export async function startAuthentication(formData: FormData) {
  const input = authRequestSchema.safeParse({
    provider: formData.get("provider"),
    email: formData.get("email"),
    consent: formData.get("consent") === "on",
  });

  if (!input.success) {
    throw new Error("Enter a valid email and accept the privacy notice to continue.");
  }

  const email = input.data.email.trim().toLowerCase();
  const now = new Date();
  await db.signupConsent.upsert({
    where: { email },
    create: {
      email,
      consentedAt: now,
      consentVersion: CURRENT_CONSENT_VERSION,
      expiresAt: new Date(now.getTime() + CONSENT_WINDOW_MS),
    },
    update: {
      consentedAt: now,
      consentVersion: CURRENT_CONSENT_VERSION,
      expiresAt: new Date(now.getTime() + CONSENT_WINDOW_MS),
      consumedAt: null,
    },
  });

  await signIn(input.data.provider, {
    email,
    redirectTo: "/dashboard",
  });
}
