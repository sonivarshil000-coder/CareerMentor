import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";

export async function GET() {
  const user = await requireUser();
  const [account, profile, answers, resumes, companies, applications, notifications, auditEvents] = await Promise.all([
    db.user.findUnique({ where: { id: user.id }, select: { id: true, name: true, email: true, consentedAt: true, consentVersion: true, createdAt: true } }),
    db.profile.findUnique({ where: { userId: user.id } }),
    db.answer.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    db.resume.findMany({ where: { userId: user.id }, select: { id: true, targetRole: true, originalName: true, mimeType: true, parseStatus: true, parsedData: true, createdAt: true } }),
    db.company.findMany({ where: { userId: user.id }, select: { name: true, careersUrl: true, atsPlatform: true, roleKeywords: true, locations: true, discoveryEnabled: true, lastScannedAt: true, createdAt: true } }),
    db.application.findMany({
      where: { userId: user.id },
      include: { job: { select: { title: true, url: true, company: { select: { name: true } } } }, resume: { select: { targetRole: true } }, approval: { select: { decision: true, proposedFields: true, decidedAt: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    db.auditEvent.findMany({ where: { userId: user.id }, select: { eventType: true, payload: true, createdAt: true } }),
  ]);

  const payload = { exportedAt: new Date().toISOString(), account, profile, answers, resumes, companies, applications, notifications, auditEvents };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="careermentor-account-${user.id}.json"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
