"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { makeRoleSpecificApplicationNote } from "@/lib/matching/application-draft";

const applicationInput = z.object({ jobId: z.string().cuid(), resumeId: z.string().cuid() });
const statusInput = z.enum(["APPLIED", "INTERVIEW", "OFFER", "REJECTED"]);
const applicationNoteInput = z.object({ applicationId: z.string().cuid(), coverLetter: z.string().trim().max(5_000) });
const approvalFieldsInput = z.object({
  applicationId: z.string().cuid(),
  fullName: z.string().trim().min(1).max(100),
  email: z.email().max(254),
  phone: z.string().trim().max(40),
  city: z.string().trim().max(100),
  workAuthorization: z.string().trim().max(160),
  needsVisaSponsorship: z.enum(["yes", "no", "unknown"]),
});

export async function startApplication(formData: FormData) {
  const user = await requireUser();
  const parsed = applicationInput.safeParse({ jobId: formData.get("jobId"), resumeId: formData.get("resumeId") });
  if (!parsed.success) redirect("/jobs?error=application-fields");

  const [job, resume, profile, answers, existing] = await Promise.all([
    db.job.findFirst({ where: { id: parsed.data.jobId, closedAt: null, company: { userId: user.id } }, include: { company: { select: { name: true } } } }),
    db.resume.findFirst({ where: { id: parsed.data.resumeId, userId: user.id, parseStatus: "READY" } }),
    db.profile.findUnique({ where: { userId: user.id } }),
    db.answer.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, select: { question: true, answer: true } }),
    db.application.findUnique({ where: { userId_jobId: { userId: user.id, jobId: parsed.data.jobId } }, select: { id: true } }),
  ]);
  if (!job) redirect("/jobs?error=job-unavailable");
  if (!resume) redirect("/jobs?error=resume-not-ready");
  if (existing) redirect("/applications?error=duplicate");
  const candidateName = profile?.fullName || user.name;
  const candidateEmail = profile?.email || user.email;
  if (!candidateName || !candidateEmail) redirect("/jobs?error=profile-incomplete");

  const proposedFields = {
    company: job.company.name,
    role: job.title,
    roleUrl: job.url,
    resume: resume.targetRole,
    candidate: {
      fullName: candidateName,
      email: candidateEmail,
      phone: profile?.phone ?? null,
      city: profile?.city ?? null,
      links: profile?.links ?? [],
      workAuthorization: profile?.workAuthorization ?? null,
      needsVisaSponsorship: profile?.needsVisaSponsorship ?? null,
    },
    savedAnswers: answers,
    coverLetter: makeRoleSpecificApplicationNote({ company: job.company.name, role: job.title, description: job.descriptionText || job.description, fullName: candidateName, resumeData: resume.parsedData }),
  } satisfies Prisma.InputJsonObject;

  try {
    await db.application.create({
      data: {
        userId: user.id,
        jobId: job.id,
        resumeId: resume.id,
        status: "NEEDS_APPROVAL",
        answersSnapshot: answers as Prisma.InputJsonValue,
        stopReason: "Review the proposed details before continuing to the employer.",
        approval: { create: { proposedFields } },
        auditEvents: {
          create: {
            userId: user.id,
            eventType: "APPLICATION_PREPARED",
            payload: { jobId: job.id, resumeId: resume.id, requiresApproval: true },
          },
        },
      },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      redirect("/applications?error=duplicate");
    }
    throw error;
  }

  revalidatePath("/approvals");
  revalidatePath("/applications");
  revalidatePath("/jobs");
  redirect("/approvals?prepared=1");
}

export async function decideApplication(formData: FormData) {
  const user = await requireUser();
  const id = z.string().cuid().parse(formData.get("applicationId"));
  const decision = z.enum(["APPROVED", "REJECTED"]).parse(formData.get("decision"));
  const application = await db.application.findFirst({
    where: { id, userId: user.id, status: "NEEDS_APPROVAL" },
    include: { approval: true },
  });
  if (!application?.approval || application.approval.decision !== "PENDING") redirect("/approvals?error=not-pending");
  if (decision === "APPROVED") {
    const fields = asRecord(application.approval.proposedFields);
    const candidate = asRecord(fields.candidate);
    if (typeof candidate.fullName !== "string" || typeof candidate.email !== "string") {
      redirect("/approvals?error=profile-incomplete");
    }
  }

  const nextStatus = decision === "APPROVED" ? "NEEDS_USER_ACTION" : "REJECTED";
  const note = decision === "APPROVED"
    ? "Approved. Complete the application on the employer’s site."
    : "You declined this application draft.";
  const changed = await db.$transaction(async (tx) => {
    const approved = await tx.approval.updateMany({
      where: { id: application.approval!.id, decision: "PENDING" },
      data: { decision, decidedAt: new Date() },
    });
    if (!approved.count) return false;
    const updated = await tx.application.updateMany({
      where: { id: application.id, userId: user.id, status: "NEEDS_APPROVAL" },
      data: { status: nextStatus, stopReason: note },
    });
    if (!updated.count) throw new Error("The application is no longer waiting for approval.");
    await tx.auditEvent.create({
      data: {
        userId: user.id,
        applicationId: application.id,
        eventType: `APPLICATION_${decision}`,
        payload: { decision, externalSubmission: false },
      },
    });
    return true;
  });
  if (!changed) redirect("/approvals?error=not-pending");
  revalidatePath("/approvals");
  revalidatePath("/applications");
  redirect(decision === "APPROVED" ? "/applications?approved=1" : "/approvals?rejected=1");
}

export async function saveApprovalFields(formData: FormData) {
  const user = await requireUser();
  const parsed = approvalFieldsInput.safeParse({
    applicationId: formData.get("applicationId"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    city: formData.get("city") ?? "",
    workAuthorization: formData.get("workAuthorization") ?? "",
    needsVisaSponsorship: formData.get("needsVisaSponsorship"),
  });
  if (!parsed.success) redirect("/approvals?error=invalid-fields");

  const application = await db.application.findFirst({
    where: { id: parsed.data.applicationId, userId: user.id, status: "NEEDS_APPROVAL" },
    include: { approval: true },
  });
  if (!application?.approval || application.approval.decision !== "PENDING") redirect("/approvals?error=not-pending");

  const previous = asRecord(application.approval.proposedFields);
  const previousCandidate = asRecord(previous.candidate);
  const updated = {
    ...previous,
    candidate: {
      ...previousCandidate,
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      city: parsed.data.city || null,
      workAuthorization: parsed.data.workAuthorization || null,
      needsVisaSponsorship: parsed.data.needsVisaSponsorship === "unknown"
        ? null
        : parsed.data.needsVisaSponsorship === "yes",
    },
  } as Prisma.InputJsonObject;

  await db.$transaction(async (tx) => {
    const changed = await tx.approval.updateMany({
      where: { id: application.approval!.id, decision: "PENDING" },
      data: { proposedFields: updated },
    });
    if (!changed.count) redirect("/approvals?error=not-pending");
    await tx.auditEvent.create({
      data: {
        userId: user.id,
        applicationId: application.id,
        eventType: "APPLICATION_FIELDS_EDITED",
        payload: { fields: ["fullName", "email", "phone", "city", "workAuthorization", "needsVisaSponsorship"] },
      },
    });
  });
  revalidatePath("/approvals");
}

export async function saveApprovalNote(formData: FormData) {
  const user = await requireUser();
  const parsed = applicationNoteInput.safeParse({
    applicationId: formData.get("applicationId"),
    coverLetter: formData.get("coverLetter") ?? "",
  });
  if (!parsed.success) redirect("/approvals?error=invalid-fields");
  const application = await db.application.findFirst({
    where: { id: parsed.data.applicationId, userId: user.id, status: "NEEDS_APPROVAL" },
    include: { approval: true },
  });
  if (!application?.approval || application.approval.decision !== "PENDING") redirect("/approvals?error=not-pending");
  const previous = asRecord(application.approval.proposedFields);
  const updated = { ...previous, coverLetter: parsed.data.coverLetter } as Prisma.InputJsonObject;
  await db.$transaction(async (tx) => {
    const changed = await tx.approval.updateMany({
      where: { id: application.approval!.id, decision: "PENDING" },
      data: { proposedFields: updated },
    });
    if (!changed.count) redirect("/approvals?error=not-pending");
    await tx.auditEvent.create({
      data: {
        userId: user.id,
        applicationId: application.id,
        eventType: "APPLICATION_NOTE_EDITED",
        payload: { field: "coverLetter" },
      },
    });
  });
  revalidatePath("/approvals");
}
export async function updateApplicationStatus(formData: FormData) {
  const user = await requireUser();
  const id = z.string().cuid().parse(formData.get("applicationId"));
  const status = statusInput.parse(formData.get("status"));
  const application = await db.application.findFirst({ where: { id, userId: user.id }, select: { id: true, status: true } });
  if (!application || application.status === "NEEDS_APPROVAL") redirect("/applications?error=not-found");
  await db.$transaction([
    db.application.update({
      where: { id: application.id },
      data: { status, submittedAt: status === "APPLIED" ? new Date() : undefined, stopReason: null },
    }),
    db.auditEvent.create({
      data: {
        userId: user.id,
        applicationId: application.id,
        eventType: "APPLICATION_STATUS_UPDATED",
        payload: { from: application.status, to: status, source: "user" },
      },
    }),
  ]);
  revalidatePath("/applications");
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
