import Link from "next/link";
import { Building2, CircleAlert, ExternalLink, MapPin, Pause, Play, RefreshCw, Trash2 } from "lucide-react";
import { addCompany, deleteCompany, pauseCompanyScan, requestCompanyScan } from "@/app/actions/companies";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";

const errors: Record<string, string> = {
  fields: "Enter a company name and a valid careers page URL.",
  blocked: "Add the company’s own careers page. LinkedIn, Indeed, and Naukri links aren’t supported.",
  https: "Use a secure HTTPS careers page URL.",
  url: "That URL doesn’t look like a public careers page.",
  duplicate: "You already saved this careers page.",
  unsupported: "That job board can’t be scanned automatically yet.",
  "not-found": "That company could not be found.",
};

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; queued?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const companies = await db.company.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { jobs: true } } },
  });
  const openCounts = await Promise.all(companies.map((company) => db.job.count({ where: { companyId: company.id, closedAt: null } })));

  return (
    <div className="page-wrap">
      <header className="page-header"><div><p className="eyebrow">Company watchlist</p><h1>Companies you care about</h1><p>Save public career pages and discover roles across your list.</p></div><span className="soft-pill">{companies.length} saved</span></header>
      {params.error && <p className="notice notice-error" role="alert"><CircleAlert size={16} />{errors[params.error] ?? "Something went wrong. Please try again."}</p>}
      {params.saved && <p className="notice notice-success">Company saved. Its first job scan is queued.</p>}
      {params.queued && <p className="notice notice-success">A fresh scan is queued. New listings will appear here.</p>}

      <section className="panel company-form-panel">
        <div className="panel-heading"><div><p className="eyebrow">Add a company</p><h2>Follow a careers page</h2></div><span className="company-private">Public listings only</span></div>
        <form action={addCompany} className="company-form">
          <label className="field"><span>Company name</span><input name="name" maxLength={100} placeholder="e.g. Northstar Labs" required /></label>
          <label className="field"><span>Careers page URL</span><input name="careersUrl" type="url" maxLength={2048} placeholder="https://careers.example.com/jobs" required /></label>
          <label className="field"><span>Roles to watch <small>Optional</small></span><input name="roleKeywords" placeholder="Data analyst, product intern" /></label>
          <label className="field"><span>Preferred locations <small>Optional</small></span><input name="locations" placeholder="Remote, Bengaluru" /></label>
          <div className="company-form-footer"><span>Public career pages scan every 12 hours. Pages that block crawlers or require sign-in will show their status.</span><button className="button button-primary" type="submit"><Building2 size={16} /> Save company</button></div>
        </form>
      </section>

      <div className="resume-list-heading"><div><p className="eyebrow">Your list</p><h2>{companies.length ? "Saved companies" : "Your watchlist is ready"}</h2></div></div>
      {companies.length === 0 ? (
        <div className="panel empty-card company-empty"><div className="empty-mark"><Building2 size={20} /></div><h3>No companies saved</h3><p>Add a company’s careers page above. CareerMentor checks public job boards and keeps every listing linked to its source.</p></div>
      ) : (
        <div className="company-grid">{companies.map((company, index) => {
          const supported = company.atsPlatform !== "UNSUPPORTED";
          const status = company.lastScanError ? "Needs attention" : company.lastScannedAt ? "Watching for new roles" : supported ? "First scan queued" : "Manual reference";
          return <article className="panel company-card" key={company.id}>
            <div className="company-card-head"><span className={`company-avatar ${index % 2 ? "lilac" : "mint"}`}><Building2 size={17} /></span><span className={`status-pill ${company.lastScanError ? "status-failed" : "status-ready"}`}>{status}</span></div>
            <h3>{company.name}</h3>
            <p className="company-provider">{company.atsPlatform === "UNSUPPORTED" ? "Career page" : company.atsPlatform === "GENERIC" ? "public career site" : company.atsPlatform.toLowerCase()}</p>
            <a className="company-url" href={company.careersUrl} target="_blank" rel="noreferrer"><span>{company.careersUrl}</span><ExternalLink size={13} /></a>
            <div className="company-meta"><span><Building2 size={13} /> {openCounts[index]} open role{openCounts[index] === 1 ? "" : "s"}</span>{company.lastScannedAt && <span>Scanned {company.lastScannedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}</div>
            {(company.roleKeywords.length > 0 || company.locations.length > 0) && <div className="tag-list company-tags">{company.roleKeywords.map((tag) => <span key={`role-${tag}`}>{tag}</span>)}{company.locations.map((tag) => <span key={`location-${tag}`}><MapPin size={10} />{tag}</span>)}</div>}
            {company.lastScanError && <p className="parse-error">{company.lastScanError}</p>}
            {company.atsPlatform === "UNSUPPORTED" && <p className="company-hint">Automatic scanning is not available for this career page yet.</p>}
            <div className="company-actions">
              <Link className="text-action" href={`/jobs?company=${company.id}`}>View roles</Link>
              {supported && company.discoveryEnabled && <form action={pauseCompanyScan}><input type="hidden" name="companyId" value={company.id} /><button className="text-action" type="submit"><Pause size={13} /> Pause</button></form>}
              {supported && !company.discoveryEnabled && <form action={requestCompanyScan}><input type="hidden" name="companyId" value={company.id} /><button className="text-action" type="submit"><Play size={13} /> Resume</button></form>}
              {supported && <form action={requestCompanyScan}><input type="hidden" name="companyId" value={company.id} /><button className="icon-button" type="submit" aria-label={`Scan ${company.name} now`}><RefreshCw size={13} /></button></form>}
              <form action={deleteCompany}><input type="hidden" name="companyId" value={company.id} /><button className="icon-button danger" type="submit" aria-label={`Remove ${company.name}`}><Trash2 size={13} /></button></form>
            </div>
          </article>;
        })}</div>
      )}
    </div>
  );
}
