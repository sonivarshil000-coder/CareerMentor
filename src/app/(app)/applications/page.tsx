import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, CircleAlert, ExternalLink, FileText } from "lucide-react";
import { updateApplicationStatus } from "@/app/actions/applications";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";

const statusLabels: Record<string, string> = {
  NEEDS_APPROVAL: "Needs approval",
  NEEDS_USER_ACTION: "Ready for you",
  APPLIED: "Applied",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  REJECTED: "Declined",
  FAILED: "Stopped",
  FOUND: "Found",
};

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ error?: string; approved?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const applications = await db.application.findMany({
    where: { userId: user.id },
    include: {
      job: { include: { company: { select: { name: true } } } },
      resume: { select: { targetRole: true } },
      approval: { select: { decision: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="page-wrap">
      <header className="page-header"><div><p className="eyebrow">Your search, tracked</p><h1>Applications</h1><p>Track each role from your first review through interviews and offers.</p></div><span className="soft-pill">{applications.length} tracked</span></header>
      {params.approved && <p className="notice notice-success">Details approved. Continue on the employer’s application page when ready.</p>}
      {params.error === "duplicate" && <p className="notice notice-error"><CircleAlert size={15} />You already have an application draft for that role.</p>}
      {applications.length === 0 ? (
        <div className="panel empty-card applications-empty"><div className="empty-mark"><BriefcaseBusiness size={20} /></div><h3>Your tracker is empty</h3><p>Prepare an application from a job listing. It will appear here after you review the proposed details.</p><Link className="button button-primary button-small" href="/jobs">Browse open roles</Link></div>
      ) : (
        <div className="application-list">{applications.map((application) => {
          const status = application.status;
          const canUpdateStatus = ["APPLIED", "INTERVIEW", "OFFER", "REJECTED"].includes(status);
          return <article className="panel application-card" key={application.id}>
            <div className="application-main"><span className="application-company-mark">{application.job.company.name.slice(0, 1).toUpperCase()}</span><div><span className="job-company">{application.job.company.name}</span><h2>{application.job.title}</h2><p><FileText size={13} /> Resume for {application.resume.targetRole}</p><small>Started {application.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</small></div></div>
            <div className="application-status"><span className={`status-pill status-${status === "NEEDS_APPROVAL" ? "pending" : status === "REJECTED" || status === "FAILED" ? "failed" : status === "APPLIED" || status === "OFFER" ? "ready" : "processing"}`}>{statusLabels[status] ?? status.toLowerCase()}</span>{application.stopReason && <p>{application.stopReason}</p>}</div>
            <div className="application-actions">
              {status === "NEEDS_APPROVAL" && <Link className="button button-primary button-small" href="/approvals">Review approval</Link>}
              {status === "NEEDS_USER_ACTION" && <a className="button button-primary button-small" href={application.job.url} target="_blank" rel="noreferrer">Open employer application <ExternalLink size={13} /></a>}
              {status === "NEEDS_USER_ACTION" && <form action={updateApplicationStatus}><input type="hidden" name="applicationId" value={application.id} /><input type="hidden" name="status" value="APPLIED" /><button className="text-action" type="submit">Mark as applied</button></form>}
              {canUpdateStatus && <form action={updateApplicationStatus} className="application-status-form"><input type="hidden" name="applicationId" value={application.id} /><label className="sr-only" htmlFor={`status-${application.id}`}>Update status for {application.job.title}</label><select id={`status-${application.id}`} name="status" defaultValue={status} aria-label={`Update status for ${application.job.title}`}><option value="APPLIED">Applied</option><option value="INTERVIEW">Interview</option><option value="OFFER">Offer</option><option value="REJECTED">Declined</option></select><button className="text-action" type="submit">Save</button></form>}
              <a className="icon-button" href={application.job.url} target="_blank" rel="noreferrer" aria-label={`Open ${application.job.title} listing`}><ArrowUpRight size={14} /></a>
            </div>
          </article>;
        })}</div>
      )}
    </div>
  );
}
