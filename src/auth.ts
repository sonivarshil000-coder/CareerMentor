import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import type { Provider } from "next-auth/providers";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  CURRENT_CONSENT_VERSION,
  isPendingConsentValid,
} from "@/lib/auth/consent";

const providers: Provider[] = [];

if (env.googleClientId && env.googleClientSecret) {
  providers.push(
    Google({
      clientId: env.googleClientId,
      clientSecret: env.googleClientSecret,
    }),
  );
}

if (env.emailServer && env.emailFrom) {
  providers.push(
    Nodemailer({
      server: env.emailServer,
      from: env.emailFrom,
      maxAge: 30 * 60,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers,
  secret: env.authSecret,
  trustHost: true,
  session: { strategy: "database" },
  pages: {
    signIn: "/login",
    verifyRequest: "/login?sent=1",
    error: "/login?error=auth",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      const email = user.email.trim().toLowerCase();
      const existing = await db.user.findUnique({
        where: { email },
        select: { id: true, consentedAt: true, deletedAt: true },
      });

      if (existing?.deletedAt) return false;
      if (existing?.consentedAt) return true;

      const consent = await db.signupConsent.findUnique({ where: { email } });
      if (!isPendingConsentValid(consent)) return false;

      if (existing) {
        await db.$transaction([
          db.user.update({
            where: { id: existing.id },
            data: {
              consentedAt: consent.consentedAt,
              consentVersion: CURRENT_CONSENT_VERSION,
            },
          }),
          db.signupConsent.update({
            where: { email },
            data: { consumedAt: new Date() },
          }),
        ]);
      }

      return true;
    },
    async session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.email || !user.id) {
        throw new Error("A verified email address is required.");
      }

      const email = user.email.trim().toLowerCase();
      const userId = user.id;
      const consent = await db.signupConsent.findUnique({ where: { email } });
      if (!isPendingConsentValid(consent)) {
        throw new Error("Valid signup consent is required before creating an account.");
      }

      await db.$transaction([
        db.user.update({
          where: { id: userId },
          data: {
            consentedAt: consent.consentedAt,
            consentVersion: CURRENT_CONSENT_VERSION,
          },
        }),
        db.signupConsent.update({
          where: { email },
          data: { consumedAt: new Date() },
        }),
        db.profile.upsert({
          where: { userId },
          create: { userId, email, fullName: user.name },
          update: { email, fullName: user.name ?? undefined },
        }),
        db.subscription.upsert({
          where: { userId },
          create: { userId, plan: "FREE" },
          update: {},
        }),
      ]);
    },
  },
});
