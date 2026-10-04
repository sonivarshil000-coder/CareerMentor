import { describe, expect, it } from "vitest";
import {
  CURRENT_CONSENT_VERSION,
  isPendingConsentValid,
  type PendingConsent,
} from "@/lib/auth/consent";

const now = new Date("2026-10-04T12:00:00.000Z");

function pendingConsent(overrides: Partial<PendingConsent> = {}): PendingConsent {
  return {
    consentedAt: new Date(now.getTime() - 1_000),
    consentVersion: CURRENT_CONSENT_VERSION,
    expiresAt: new Date(now.getTime() + 60_000),
    consumedAt: null,
    ...overrides,
  };
}

describe("signup consent", () => {
  it("accepts an unexpired, unused acceptance of the current notice", () => {
    expect(isPendingConsentValid(pendingConsent(), now)).toBe(true);
  });

  it("rejects missing, expired, consumed, future-dated, or stale consent", () => {
    expect(isPendingConsentValid(null, now)).toBe(false);
    expect(
      isPendingConsentValid(
        pendingConsent({ expiresAt: new Date(now.getTime() - 1) }),
        now,
      ),
    ).toBe(false);
    expect(
      isPendingConsentValid(
        pendingConsent({ consumedAt: new Date(now.getTime() - 1) }),
        now,
      ),
    ).toBe(false);
    expect(
      isPendingConsentValid(
        pendingConsent({ consentedAt: new Date(now.getTime() + 1) }),
        now,
      ),
    ).toBe(false);
    expect(
      isPendingConsentValid(pendingConsent({ consentVersion: "old" }), now),
    ).toBe(false);
  });
});
