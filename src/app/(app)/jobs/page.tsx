import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, MapPin, Search, ShieldCheck, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { isEntryLevelJob } from "@/lib/matching/score";
import { htmlToText } from "@/lib/ats/html";
import { startApplication } from "@/app/actions/applications";

type JobFilters = { company?: string; level?: string; resume?: string; strong?: string; error?: string };

export default async function JobsPage({ searchParams }: { searchParams: Promise<JobFilters> }) {
  const user = await requireUser();
  const params = await searchParams;
  const [companies, resumes] = await Promise.all([
    db.company.findMany({ where: { userId: user.id }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.resume.findMany({ where: { userId: user.id, parseStatus: "READY" }, select: { id: true, targetRole: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const selectedCompany = companies.find((company) => company.id === params.company) ?? null;
  const selectedResume = resumes.find((resume) => resume.id === params.resume) ?? null;
  const jobs = await db.job.findMany({
    where: { closedAt: null, company: { userId: user.id, ...(selectedCompany ? { id: selectedCompany.id } : {}) } },
    include: {
      company: { select: { id: true, name: true } },
      matches: {
        where: { userId: user.id, ...(selectedResume ? { resumeId: selectedResume.id } : {}) },
        orderBy: { score: "desc" },
        take: 1,
        select: { score: true, matchedSkills: true, skillGaps: true, explanation: true },
      },
      applications: { where: { userId: user.id }, take: 1, select: { id: true, status: true } },
    },
    orderBy: { firstSeenAt: "desc" },
    take: 500,
  });

  const filteredJobs = jobs
    .filter((job) => params.level !== "entry" || isEntryLevelJob(job))
    .filter((job) => params.strong !== "1" || (job.matches[0]?.score ?? 0) >= 70)
    .sort((left, right) => (right.matches[0]?.score ?? -1) - (left.matches[0]?.score ?? -1));
  const countLabel = selectedCompany ? `${selectedCompany.name} roles` : "Open roles";

  return (
    <div className="page-wrap">
      <header className="page-header"><div><p className="eyebrow">Your job feed</p><h1>{countLabel}</h1><p>Fresh public listings, with resume fit explained in plain language.</p></div><span className="soft-pill">{filteredJobs.length} listed</span></header>
      {params.error && <p className="notice notice-error" role="alert">{params.error === "profile-incomplete" ? <>Add your name to <Link href="/profile">your profile</Link> before preparing an application.</> : params.error === "resume-not-ready" ? <>Choose a parsed resume. <Link href="/resumes">Open your resume library</Link>.</> : params.error === "job-unavailable" ? "This role has closed or is no longer available." : "Check the selected job and resume, then try again."}</p>}

      <form method="get" className="panel job-filter-panel">
        <label className="field"><span>Company</span><select name="company" defaultValue={selectedCompany?.id ?? ""}><option value="">All saved companies</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
        <label className="field"><span>Experience level</span><select name="level" defaultValue={params.level === "entry" ? "entry" : "all"}><option value="all">All roles</option><option value="entry">Freshers &amp; internships</option></select></label>
        <label className="field"><span>Match against</span><select name="resume" defaultValue={selectedResume?.id ?? ""}><option value="">Best of my resumes</option>{resumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.targetRole}</option>)}</select></label>
        <label className="job-strong-filter"><input type="checkbox" name="strong" value="1" defaultChecked={params.strong === "1"} /> Strong matches only</label>
        <button className="button button-primary button-small" type="submit"><Search size={14} /> Apply filters</button>
      </form>

      {resumes.length === 0 && <p className="notice notice-success"><Sparkles size={15} />Add and parse a resume to see role fit, matched skills, and skill gaps. <Link href="/resumes">Open resumes</Link></p>}

      {filteredJobs.length === 0 ? (
        <div className="panel empty-card jobs-empty"><div className="empty-mark"><Search size={20} /></div><h3>{jobs.length ? "No roles match these filters" : "No open roles found yet"}</h3><p>{jobs.length ? "Try another company, experience level, or match filter." : "Add a company's public careers page to queue a scan. Readable public listings will show up here after scanning."}</p><Link className="button button-primary button-small" href={jobs.length ? "/jobs" : "/companies"}>{jobs.length ? "Clear filters" : "Add a company"}</Link></div>
      ) : (
        <div className="jobs-list">{filteredJobs.slice(0, 100).map((job) => {
          const match = job.matches[0];
          const isEntry = isEntryLevelJob(job);
          return <article className="panel job-card" key={job.id}>
            <div className="job-card-avatar">{job.company.name.slice(0, 1).toUpperCase()}</div>
            <div className="job-card-copy"><span className="job-company">{job.company.name} <span>·</span> {job.source.toLowerCase().replace("smartrecruiters", "SmartRecruiters")}</span><h2>{job.title}</h2><div className="job-meta">{job.location && <span><MapPin size={13} />{job.location}</span>}{job.employment && <span>{job.employment}</span>}{isEntry && <span className="entry-pill">Fresher friendly</span>}<span>First seen {job.firstSeenAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></div><p className="job-description">{htmlToText(job.descriptionText || job.description) || "No description was provided with this listing."}</p>
              {match && <section className="match-summary" aria-label="Resume match details"><div className="match-score-large"><strong>{match.score}%</strong><span>resume fit</span></div><div className="match-details"><p>{match.explanation}</p>{match.matchedSkills.length > 0 && <div className="match-skill-row"><b>On your resume</b><div className="tag-list">{match.matchedSkills.slice(0, 8).map((skill) => <span key={skill}>{skill}</span>)}</div></div>}{match.skillGaps.length > 0 && <div className="match-skill-row"><b>Skills to build</b><div className="tag-list gap-tags">{match.skillGaps.slice(0, 8).map((skill) => <span key={skill}>{skill}</span>)}</div></div>}</div></section>}
              {job.applications[0] ? <Link className="existing-application-link" href="/applications">Application status: {job.applications[0].status.toLowerCase().replaceAll("_", " ")}</Link> : resumes.length > 0 ? <form action={startApplication} className="application-prepare"><input type="hidden" name="jobId" value={job.id} /><label className="field"><span>Prepare with</span><select name="resumeId" required defaultValue={selectedResume?.id ?? resumes[0].id}>{resumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.targetRole}</option>)}</select></label><button className="button button-primary button-small" type="submit"><ShieldCheck size={13} /> Prepare for approval</button><span>No details are sent until you review and approve them.</span></form> : <Link className="existing-application-link" href="/resumes">Add and parse a resume to prepare an application <ArrowUpRight size={12} /></Link>}
            </div>
            <a className="button button-quiet button-small job-view" href={job.url} target="_blank" rel="noreferrer">View role <ArrowUpRight size={14} /></a>
          </article>;
        })}</div>
      )}
      {filteredJobs.length > 100 && <p className="job-feed-footnote">Showing the 100 top-ranked roles in this view.</p>}
      {!selectedCompany && <p className="job-feed-footnote"><BriefcaseBusiness size={13} />Every listing links back to the employer’s public application page.</p>}
    </div>
  );
}
