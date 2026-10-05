import Link from "next/link";
import { Download, FileText, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { deleteResume, retryResumeParse, uploadResume } from "@/app/actions/resumes";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export default async function ResumesPage() {
  const user = await requireUser();
  const resumes = await db.resume.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      targetRole: true,
      originalName: true,
      mimeType: true,
      parseStatus: true,
      parseError: true,
      parsedData: true,
      createdAt: true,
      _count: { select: { applications: true } },
    },
  });

  return (
    <div className="page-wrap">
      <header className="page-header"><div><p className="eyebrow">Your experience, organized</p><h1>Resume library</h1><p>Keep a separate, private resume for each target role.</p></div><span className="soft-pill">{resumes.length} saved</span></header>
      <section className="panel upload-panel">
        <div className="upload-illustration"><FileText size={23} /></div>
        <div className="upload-copy"><h2>Add a role-specific resume</h2><p>PDF or DOCX, up to 10 MB. Files are encrypted before they are stored. Parsing runs in the worker.</p><span><ShieldCheck size={13} /> Private to your account</span></div>
        <form action={uploadResume} className="resume-upload-form">
          <label className="field"><span>Target role</span><input name="targetRole" maxLength={120} placeholder="e.g. Data Analyst" required /></label>
          <label className="field"><span>Resume file</span><input name="file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required /></label>
          <button className="button button-primary" type="submit"><Plus size={16} /> Upload resume</button>
        </form>
      </section>

      <div className="resume-list-heading"><div><p className="eyebrow">Your library</p><h2>{resumes.length ? "Saved resumes" : "Start with your first resume"}</h2></div></div>
      {resumes.length === 0 ? (
        <div className="panel empty-card resume-empty"><div className="empty-mark"><FileText size={20} /></div><h3>No resumes yet</h3><p>Add one resume for each role you are targeting. CareerMentor will compare them separately when jobs are found.</p></div>
      ) : (
        <div className="resume-grid">{resumes.map((resume) => {
          const parsed = getParsedData(resume.parsedData);
          const status = resume.parseStatus.toLowerCase().replace("_", " ");
          return <article className="panel resume-card" key={resume.id}>
            <div className="resume-card-head"><div className="resume-file-icon"><FileText size={18} /></div><span className={`status-pill status-${resume.parseStatus.toLowerCase()}`}>{status}</span></div>
            <p className="eyebrow">TARGET ROLE</p><h3>{resume.targetRole}</h3><p className="resume-filename" title={resume.originalName}>{resume.originalName}</p>
            <div className="resume-meta"><span>{resume.mimeType === "application/pdf" ? "PDF" : "DOCX"}</span><span>{resume.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span></div>
            {resume.parseError && <p className="parse-error">{resume.parseError}</p>}
            {parsed && <div className="parsed-summary"><div><b>{parsed.skills.length}</b><span>skills</span></div><div><b>{parsed.education.length}</b><span>education</span></div><div><b>{parsed.projects.length}</b><span>projects</span></div></div>}
            {parsed?.skills.length ? <div className="tag-list skill-list">{parsed.skills.slice(0, 7).map((skill) => <span key={skill}>{skill}</span>)}{parsed.skills.length > 7 && <span>+{parsed.skills.length - 7}</span>}</div> : null}
            <div className="resume-card-actions">
              <Link href={`/api/resumes/${resume.id}/download`} className="text-action"><Download size={14} /> Download</Link>
              {resume.parseStatus === "FAILED" && <form action={retryResumeParse}><input type="hidden" name="id" value={resume.id} /><button className="text-action" type="submit"><RefreshCw size={13} /> Retry parse</button></form>}
              {resume._count.applications === 0 && <form action={deleteResume}><input type="hidden" name="id" value={resume.id} /><button className="icon-button danger" type="submit" aria-label={`Delete ${resume.originalName}`}><Trash2 size={14} /></button></form>}
              {resume._count.applications > 0 && <span className="resume-linked">Used in {resume._count.applications} application{resume._count.applications === 1 ? "" : "s"}</span>}
            </div>
          </article>;
        })}</div>
      )}
    </div>
  );
}

function getParsedData(value: Prisma.JsonValue | null) {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  const record = value as Record<string, Prisma.JsonValue>;
  const strings = (key: string) => Array.isArray(record[key]) ? record[key].filter((item): item is string => typeof item === "string") : [];
  return { skills: strings("skills"), education: strings("education"), projects: strings("projects") };
}
