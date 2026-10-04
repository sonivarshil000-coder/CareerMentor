export const CURRENT_CONSENT_VERSION = "2026-10-04-v1";
export const CONSENT_WINDOW_MS = 30 * 60 * 1000;

export type PendingConsent = {
  consentedAt: Date;
  consentVersion: string;
  expiresAt: Date;
  consumedAt: Date | null;
};

export function isPendingConsentValid(
  consent: PendingConsent | null | undefined,
  now = new Date(),
): consent is PendingConsent {
  return Boolean(
    consent &&
      consent.consumedAt === null &&
      consent.expiresAt.getTime() > now.getTime() &&
      consent.consentedAt.getTime() <= now.getTime() &&
      consent.consentVersion === CURRENT_CONSENT_VERSION,
  );
}
