"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { decodeFileEncryptionKey, encryptResumeBytes } from "@/lib/files/encryption";
import { getResumeQueue } from "@/lib/queues/resume-queue";
import { deletePrivateObject, newResumeObjectKey, putPrivateObject } from "@/lib/storage";

const MAX_RESUME_SIZE = 10 * 1024 * 1024;
const supportedTypes = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

const resumeInputSchema = z.object({
  targetRole: z.string().trim().min(2).max(120),
});

export async function uploadResume(formData: FormData) {
  const user = await requireUser();
  const input = resumeInputSchema.safeParse({ targetRole: formData.get("targetRole") });
  const file = formData.get("file");
  if (!input.success || !(file instanceof File)) {
    throw new Error("Add a target role and choose a PDF or DOCX resume.");
  }
  if (file.size <= 0 || file.size > MAX_RESUME_SIZE) {
    throw new Error("Resume files must be between 1 byte and 10 MB.");
  }

  const originalName = file.name.split(/[\\/]/).pop()?.trim().slice(0, 160) || "resume";
  const extension = originalName.toLowerCase().split(".").pop();
  const mimeType = extension === "pdf"
    ? supportedTypes.pdf
    : extension === "docx"
      ? supportedTypes.docx
      : null;
  if (!mimeType || (file.type && file.type !== mimeType && file.type !== "application/octet-stream")) {
    throw new Error("Only PDF and DOCX resume files are supported.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const looksLikePdf = bytes.subarray(0, 1024).includes(Buffer.from("%PDF-"));
  const looksLikeDocx = bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  if ((mimeType === supportedTypes.pdf && !looksLikePdf) || (mimeType === supportedTypes.docx && !looksLikeDocx)) {
    throw new Error("The file content does not match its PDF or DOCX extension.");
  }

  const contentHash = createHash("sha256").update(bytes).digest("hex");
  const duplicate = await db.resume.findFirst({ where: { userId: user.id, contentHash } });
  if (duplicate) throw new Error("This file is already saved in your resume library.");

  const key = decodeFileEncryptionKey(process.env.FILE_ENCRYPTION_KEY ?? "");
  const objectKey = newResumeObjectKey(user.id);
  const encrypted = encryptResumeBytes(bytes, key);
  await putPrivateObject(objectKey, encrypted, { owner: user.id, encrypted: "aes-256-gcm-v1" });

  let resume;
  try {
    resume = await db.resume.create({
      data: {
        userId: user.id,
        targetRole: input.data.targetRole,
        originalName,
        mimeType,
        objectKey,
        contentHash,
        parseStatus: "PENDING",
      },
    });
  } catch (error) {
    await deletePrivateObject(objectKey).catch(() => undefined);
    throw error;
  }

  try {
    await enqueueResumeParse(user.id, resume.id);
  } catch {
    await db.resume.updateMany({
      where: { id: resume.id, userId: user.id },
      data: { parseStatus: "FAILED", parseError: "The parsing worker is unavailable. Retry after it starts." },
    });
  }

  revalidatePath("/resumes");
  revalidatePath("/dashboard");
  redirect("/resumes?uploaded=1");
}

export async function retryResumeParse(formData: FormData) {
  const user = await requireUser();
  const id = z.string().cuid().parse(formData.get("id"));
  const resume = await db.resume.findFirst({ where: { id, userId: user.id } });
  if (!resume) throw new Error("That resume could not be found.");
  if (resume.parseStatus !== "FAILED") return;

  await db.resume.updateMany({
    where: { id, userId: user.id },
    data: { parseStatus: "PENDING", parseError: null },
  });
  try {
    await enqueueResumeParse(user.id, resume.id, `retry-${Date.now()}`);
  } catch {
    await db.resume.updateMany({
      where: { id, userId: user.id },
      data: { parseStatus: "FAILED", parseError: "The parsing worker is unavailable. Try again later." },
    });
  }
  revalidatePath("/resumes");
}

export async function deleteResume(formData: FormData) {
  const user = await requireUser();
  const id = z.string().cuid().parse(formData.get("id"));
  const resume = await db.resume.findFirst({ where: { id, userId: user.id } });
  if (!resume) return;

  const inUse = await db.application.count({ where: { userId: user.id, resumeId: id } });
  if (inUse > 0) throw new Error("This resume is linked to an application. Keep it for your tracker history.");

  await deletePrivateObject(resume.objectKey);
  await db.resume.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/resumes");
  revalidatePath("/dashboard");
}

async function enqueueResumeParse(userId: string, resumeId: string, suffix = "initial") {
  const queue = getResumeQueue();
  const enqueue = queue.add("parse", { userId, resumeId }, { jobId: `${resumeId}-${suffix}` });
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Queue connection timed out.")), 5_000);
  });
  try {
    await Promise.race([enqueue, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
