import "dotenv/config";
import IORedis from "ioredis";
import { Worker } from "bullmq";
import { db } from "@/lib/db";
import { decryptResumeBytes, decodeFileEncryptionKey } from "@/lib/files/encryption";
import { getPrivateObject } from "@/lib/storage";
import { extractResumeText, parseResumeText } from "./resume-parser";

type ResumeJob = { userId: string; resumeId: string };

const connection = new IORedis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  { maxRetriesPerRequest: null, enableReadyCheck: true },
);

const worker = new Worker<ResumeJob>(
  "resume-processing",
  async (job) => {
    const { userId, resumeId } = job.data;
    const resume = await db.resume.findFirst({ where: { id: resumeId, userId } });
    if (!resume) return { skipped: true };

    await db.resume.updateMany({
      where: { id: resumeId, userId },
      data: { parseStatus: "PROCESSING", parseError: null },
    });

    try {
      const encrypted = await getPrivateObject(resume.objectKey);
      const key = decodeFileEncryptionKey(process.env.FILE_ENCRYPTION_KEY ?? "");
      const bytes = decryptResumeBytes(encrypted, key);
      const text = await extractResumeText(bytes, resume.mimeType);
      const parsedData = await parseResumeText(text, userId);
      await db.resume.updateMany({
        where: { id: resumeId, userId },
        data: { parsedData, parseStatus: "READY", parseError: null },
      });
      return { skillCount: parsedData.skills.length };
    } catch (error) {
      const safeMessage = error instanceof Error && error.message === "Unsupported resume format."
        ? error.message
        : "We could not read this file. Try a text-based PDF or DOCX resume.";
      await db.resume.updateMany({
        where: { id: resumeId, userId },
        data: { parseStatus: "FAILED", parseError: safeMessage },
      });
      throw error;
    }
  },
  { connection, concurrency: 2 },
);

worker.on("completed", (job) => {
  console.info(`Resume job ${job.id} completed.`);
});
worker.on("failed", (job, error) => {
  console.error(`Resume job ${job?.id ?? "unknown"} failed: ${error.message}`);
});
worker.on("error", (error) => {
  console.error(`Worker error: ${error.message}`);
});

async function shutdown() {
  await worker.close();
  await connection.quit();
  await db.$disconnect();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
