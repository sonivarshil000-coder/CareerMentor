import { db } from "./db";
import { scoreResumeMatch } from "@/lib/matching/score";

export async function refreshCompanyMatches(companyId: string) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true, userId: true, name: true, roleKeywords: true, locations: true },
  });
  if (!company) return;

  const [jobs, resumes] = await Promise.all([
    db.job.findMany({ where: { companyId, closedAt: null } }),
    db.resume.findMany({ where: { userId: company.userId, parseStatus: "READY" }, select: { id: true, targetRole: true, parsedData: true } }),
  ]);
  for (const resume of resumes) {
    const data = asRecord(resume.parsedData);
    const candidate = {
      targetRole: resume.targetRole,
      skills: stringArray(data.skills),
      experienceLevel: stringOr(data.experienceLevel, "unknown"),
    };
    for (const job of jobs) {
      const match = scoreResumeMatch(job, candidate, company.roleKeywords, company.locations);
      const key = { userId_jobId_resumeId: { userId: company.userId, jobId: job.id, resumeId: resume.id } };
      await db.match.upsert({
        where: key,
        create: {
          userId: company.userId,
          jobId: job.id,
          resumeId: resume.id,
          ...match,
        },
        update: match,
      });
      const notificationKey = `match-${resume.id}-${job.id}`;
      if (match.score >= 70 && !await db.notification.findUnique({ where: { dedupeKey: notificationKey }, select: { id: true } })) {
        try {
          await db.notification.create({
            data: {
              userId: company.userId,
              kind: "NEW_MATCHING_JOB",
              dedupeKey: notificationKey,
              title: `Strong match: ${job.title}`,
              body: `${match.score}% resume fit at ${company.name}. ${match.explanation}`,
              href: `/jobs?company=${company.id}&resume=${resume.id}&strong=1`,
            },
          });
        } catch (error) {
          if (!(typeof error === "object" && error !== null && "code" in error && error.code === "P2002")) throw error;
        }
      }
    }
  }
}

export async function refreshUserMatches(userId: string) {
  const companyIds = await db.company.findMany({ where: { userId }, select: { id: true } });
  for (const company of companyIds) await refreshCompanyMatches(company.id);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function stringOr(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}
