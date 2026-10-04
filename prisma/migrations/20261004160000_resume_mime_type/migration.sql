ALTER TABLE "Resume"
ADD COLUMN "mimeType" TEXT NOT NULL DEFAULT 'application/pdf';

ALTER TABLE "Resume"
DROP COLUMN "encryptedDataKey";
