import Link from "next/link";
import { ArrowRight, Building2, FileText, Search, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";

export default async function DashboardPage() {
  const user = await requireUser();
  const [companyCount, resumeCount, openApplications, pendingApprovals, matchCount] =
    await Promise.all([
      db.company.count({ where: { userId: user.id } }),
      db.resume.count({ where: { userId: user.id } }),
      db.application.count({
        where: { userId: user.id, status: { in: ["FOUND", "NEEDS_APPROVAL", "APPLIED", "INTERVIEW"] } },
      }),
      db.application.count({ where: { userId: user.id, status: "NEEDS_APPROVAL" } }),
      db.match.count({ where: { userId: user.id } }),
    ]);

  const steps = [
    { done: resumeCount > 0, title: "Add a role-specific resume", description: "Your resume stays private and is used only for matches you review.", href: "/resumes", action: "Add resume", icon: FileText },
    { done: companyCount > 0, title: "Save a company career page", description: "We only look at supported company sites and public ATS pages.", href: "/companies", action: "Add company", icon: Building2 },
    { done: matchCount > 0, title: "Review your first job matches", description: "See why each role fits, including matched skills and gaps.", href: "/jobs", action: "View jobs", icon: Search },
  ];

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div><p className="eyebrow">Your workspace</p><h1>Good to have you, {user.name?.split(" ")[0] ?? "there"}.</h1><p>Build your job search around the roles you actually want.</p></div>
        <Link className="button button-primary" href="/companies">Add a company <ArrowRight size={16} /></Link>
      </header>
      <div className="metric-grid">
        <Metric label="Saved companies" value={companyCount} caption="No company cap" />
        <Metric label="Role-specific resumes" value={resumeCount} caption="Ready for matching" />
        <Metric label="Applications" value={openApplications} caption="In your tracker" />
        <Metric label="Needs your review" value={pendingApprovals} caption="Nothing submits without you" highlight />
      </div>
      <div className="dashboard-grid">
        <section className="panel setup-panel">
          <div className="panel-heading"><div><p className="eyebrow">Getting started</p><h2>Your next three steps</h2></div><span className="soft-pill">{steps.filter((step) => step.done).length} of 3 done</span></div>
          <div className="setup-list">
            {steps.map(({ done, title, description, href, action, icon: Icon }, index) => (
              <div className={`setup-step ${done ? "is-done" : ""}`} key={title}>
                <div className="step-number">{done ? <ShieldCheck size={18} /> : `0${index + 1}`}</div>
                <div className="step-icon"><Icon size={18} /></div>
                <div className="step-copy"><h3>{title}</h3><p>{description}</p></div>
                <Link href={href} className="text-action">{done ? "Open" : action}<ArrowRight size={15} /></Link>
              </div>
            ))}
          </div>
        </section>
        <aside className="panel privacy-panel"><div className="privacy-icon"><ShieldCheck size={20} /></div><p className="eyebrow">You stay in control</p><h2>Every answer is yours.</h2><p>We only use facts from your profile, saved answers, and selected resume. You review every field before an application is submitted.</p><Link href="/settings">Review privacy settings <ArrowRight size={15} /></Link></aside>
      </div>
    </div>
  );
}

function Metric({ label, value, caption, highlight = false }: { label: string; value: number; caption: string; highlight?: boolean }) {
  return <article className={`metric-card ${highlight ? "metric-highlight" : ""}`}><span>{label}</span><strong>{value}</strong><small>{caption}</small></article>;
}
