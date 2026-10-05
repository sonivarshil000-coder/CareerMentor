import Link from "next/link";
import { Check, CircleAlert, ExternalLink, ShieldCheck, X } from "lucide-react";
import { decideApplication, saveApprovalFields, saveApprovalNote } from "@/app/actions/applications";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ prepared?: string; error?: string; rejected?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const applications = await db.application.findMany({
    where: { userId: user.id, status: "NEEDS_APPROVAL", approval: { decision: "PENDING" } },
    include: {
      job: { include: { company: { select: { name: true } } } },
      resume: { select: { targetRole: true } },
      approval: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="page-wrap">
      <header className="page-header"><div><p className="eyebrow">Your decision comes first</p><h1>Approval queue</h1><p>Check every proposed detail before you continue to an employer’s site.</p></div><span className="soft-pill">{applications.length} awaiting review</span></header>
      {params.prepared && <p className="notice notice-success"><ShieldCheck size={15} />Draft prepared. Review it below before continuing.</p>}
      {params.rejected && <p className="notice notice-success">Draft declined. Nothing was sent to the employer.</p>}
      {params.error && <p className="notice notice-error"><CircleAlert size={15} />{params.error === "profile-incomplete" ? <>Add your name and email in <Link href="/profile">your profile</Link>, then prepare a new draft.</> : "This draft is no longer waiting for approval."}</p>}
      {applications.length === 0 ? (
        <div className="panel empty-card approvals-empty"><div className="empty-mark"><ShieldCheck size={20} /></div><h3>You’re all caught up</h3><p>When you prepare an application, its profile fields and saved answers will appear here for review.</p><Link className="text-action" href="/jobs">Browse job matches</Link></div>
      ) : (
        <div className="approval-list">{applications.map((application) => {
          const fields = getFields(application.approval?.proposedFields ?? null);
          return <article className="panel approval-card" key={application.id}>
            <div className="approval-card-heading"><div><p className="eyebrow">{application.job.company.name}</p><h2>{application.job.title}</h2><span className="approval-resume">Using resume for {application.resume.targetRole}</span></div><span className="status-pill status-pending">Needs your approval</span></div>
            <div className="approval-fields">
              <div><h3>Contact details</h3><dl>{[
                ["Name", fields.candidate.fullName], ["Email", fields.candidate.email], ["Phone", fields.candidate.phone], ["City", fields.candidate.city], ["Work authorization", fields.candidate.workAuthorization], ["Visa sponsorship", fields.candidate.needsVisaSponsorship === null ? "Not specified" : fields.candidate.needsVisaSponsorship ? "Needed" : "Not needed"],
              ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "Not provided"}</dd></div>)}{fields.candidate.links.length > 0 && <div className="approval-links"><dt>Links</dt><dd>{fields.candidate.links.join(" · ")}</dd></div>}</dl><details className="approval-edit"><summary>Edit proposed details</summary><form action={saveApprovalFields} className="approval-edit-form"><input type="hidden" name="applicationId" value={application.id} /><label className="field"><span>Full name</span><input name="fullName" maxLength={100} defaultValue={fields.candidate.fullName ?? ""} required /></label><label className="field"><span>Email</span><input name="email" type="email" maxLength={254} defaultValue={fields.candidate.email ?? ""} required /></label><label className="field"><span>Phone</span><input name="phone" maxLength={40} defaultValue={fields.candidate.phone ?? ""} /></label><label className="field"><span>City</span><input name="city" maxLength={100} defaultValue={fields.candidate.city ?? ""} /></label><label className="field"><span>Work authorization</span><input name="workAuthorization" maxLength={160} defaultValue={fields.candidate.workAuthorization ?? ""} /></label><label className="field"><span>Visa sponsorship</span><select name="needsVisaSponsorship" defaultValue={fields.candidate.needsVisaSponsorship === null ? "unknown" : fields.candidate.needsVisaSponsorship ? "yes" : "no"}><option value="unknown">Not specified</option><option value="yes">Needed</option><option value="no">Not needed</option></select></label><button className="button button-quiet button-small" type="submit">Save proposed details</button></form></details></div>
              <div><h3>Saved answers ({fields.savedAnswers.length})</h3>{fields.savedAnswers.length ? <ul className="approval-answer-list">{fields.savedAnswers.slice(0, 8).map((answer, index) => <li key={`${answer.question}-${index}`}><b>{answer.question}</b><span>{answer.answer}</span></li>)}</ul> : <p className="approval-missing">No saved answers will be used.</p>}{fields.savedAnswers.length > 8 && <p className="approval-missing">Showing the first 8 saved answers.</p>}</div>
              <div><h3>Role-specific application note</h3><p className="approval-missing">Drafted for this role using skills listed in your selected resume. Review and edit it before using it.</p><form action={saveApprovalNote} className="approval-edit-form"><input type="hidden" name="applicationId" value={application.id} /><label className="field"><span>Application note</span><textarea name="coverLetter" rows={8} maxLength={5000} defaultValue={fields.coverLetter} /></label><button className="button button-quiet button-small" type="submit">Save application note</button></form></div>
            </div>
            {!fields.candidate.fullName || !fields.candidate.email ? <p className="parse-error">Your name or email is missing. <Link href="/profile">Update your profile</Link> before continuing.</p> : null}
            <div className="approval-footer"><span>CareerMentor prepared a role-specific draft from your saved profile and selected resume. Direct submission depends on an employer-authorized ATS integration.</span><div className="approval-actions"><form action={decideApplication}><input type="hidden" name="applicationId" value={application.id} /><input type="hidden" name="decision" value="REJECTED" /><button className="button button-quiet button-small" type="submit"><X size={14} /> Decline</button></form><form action={decideApplication}><input type="hidden" name="applicationId" value={application.id} /><input type="hidden" name="decision" value="APPROVED" /><button className="button button-primary button-small" type="submit"><Check size={14} /> Approve details</button></form><a className="text-action" href={application.job.url} target="_blank" rel="noreferrer">Preview role <ExternalLink size={13} /></a></div></div>
          </article>;
        })}</div>
      )}
    </div>
  );
}

function getFields(value: Prisma.JsonValue | null) {
  const record = asRecord(value);
  const candidate = asRecord(record.candidate);
  const savedAnswers = Array.isArray(record.savedAnswers)
    ? record.savedAnswers.flatMap((value) => {
      const answer = asRecord(value);
      return typeof answer.question === "string" && typeof answer.answer === "string"
        ? [{ question: answer.question, answer: answer.answer }]
        : [];
    })
    : [];
  return {
    candidate: {
      fullName: nullableString(candidate.fullName),
      email: nullableString(candidate.email),
      phone: nullableString(candidate.phone),
      city: nullableString(candidate.city),
      links: stringArray(candidate.links),
      workAuthorization: nullableString(candidate.workAuthorization),
      needsVisaSponsorship: typeof candidate.needsVisaSponsorship === "boolean" ? candidate.needsVisaSponsorship : null,
    },
    savedAnswers,
    coverLetter: nullableString(record.coverLetter) ?? "",
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}
