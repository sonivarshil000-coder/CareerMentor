import "server-only";
import { z } from "zod";

const databaseUrl = z.url().parse(
  process.env.DATABASE_URL ??
    "postgresql://applydesk:applydesk_dev@localhost:5432/applydesk?schema=public",
);

export const env = {
  databaseUrl,
  authSecret: process.env.AUTH_SECRET,
  googleClientId: process.env.AUTH_GOOGLE_ID,
  googleClientSecret: process.env.AUTH_GOOGLE_SECRET,
  emailServer: process.env.EMAIL_SERVER,
  emailFrom: process.env.EMAIL_FROM,
};
