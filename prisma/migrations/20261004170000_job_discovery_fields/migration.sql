ALTER TABLE "Company" ADD COLUMN "lastScanError" TEXT;

ALTER TABLE "Job" ADD COLUMN "descriptionText" TEXT NOT NULL DEFAULT '';
UPDATE "Job" SET "descriptionText" = regexp_replace("description", '<[^>]*>', ' ', 'g');
ALTER TABLE "Job" ALTER COLUMN "descriptionText" DROP DEFAULT;
