CREATE TABLE "SignupConsent" (
    "email" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consentVersion" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "SignupConsent_pkey" PRIMARY KEY ("email")
);

CREATE INDEX "SignupConsent_expiresAt_consumedAt_idx"
ON "SignupConsent"("expiresAt", "consumedAt");
