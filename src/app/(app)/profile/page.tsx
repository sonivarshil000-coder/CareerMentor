import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { saveAnswer, saveProfile, deleteAnswer } from "@/app/actions/profile";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";

export default async function ProfilePage() {
  const user = await requireUser();
  const [profile, answers] = await Promise.all([
    db.profile.findUnique({ where: { userId: user.id } }),
    db.answer.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } }),
  ]);
  const links = Array.isArray(profile?.links)
    ? profile.links.filter((value): value is string => typeof value === "string")
    : [];
  const sponsorship = profile?.needsVisaSponsorship === null || profile?.needsVisaSponsorship === undefined
    ? "unknown"
    : profile.needsVisaSponsorship ? "yes" : "no";

  return (
    <div className="page-wrap">
      <header className="page-header"><div><p className="eyebrow">Your facts</p><h1>Profile & answer bank</h1><p>Keep answers current. CareerMentor uses facts you store here.</p></div></header>
      <section className="panel form-panel">
        <div className="panel-heading"><div><p className="eyebrow">Contact and work preferences</p><h2>Profile details</h2></div><span className="form-private"><ShieldCheck size={14} /> Private to your account</span></div>
        <form action={saveProfile} className="data-form">
          <div className="form-grid">
            <Field label="Full name" name="fullName" defaultValue={profile?.fullName ?? user.name ?? ""} required />
            <Field label="Contact email" name="email" type="email" defaultValue={profile?.email ?? user.email ?? ""} required />
            <Field label="Phone" name="phone" type="tel" defaultValue={profile?.phone ?? ""} />
            <Field label="City" name="city" defaultValue={profile?.city ?? ""} placeholder="Surat, India" />
            <Field label="Notice period" name="noticePeriod" defaultValue={profile?.noticePeriod ?? ""} placeholder="Immediate, 30 days, etc." />
            <Field label="Expected salary" name="expectedSalary" defaultValue={profile?.expectedSalary ?? ""} placeholder="Optional; include currency and period" />
            <Field label="Work authorization" name="workAuthorization" defaultValue={profile?.workAuthorization ?? ""} placeholder="Countries where you may work" />
            <label className="field"><span>Need visa sponsorship?</span><select name="needsVisaSponsorship" defaultValue={sponsorship}><option value="unknown">Prefer not to say / not set</option><option value="yes">Yes</option><option value="no">No</option></select></label>
            <label className="field field-wide"><span>Links <small>One URL per line</small></span><textarea name="links" rows={3} defaultValue={links.join("\n")} placeholder="https://linkedin.com/in/…\nhttps://github.com/…" /></label>
          </div>
          <div className="form-footer"><p>These details can be used to fill application fields. Review them before every submission.</p><button className="button button-primary" type="submit">Save profile</button></div>
        </form>
      </section>

      <section className="panel form-panel answer-panel">
        <div className="panel-heading"><div><p className="eyebrow">Reusable, user-written facts</p><h2>Saved answers <span className="count-pill">{answers.length}</span></h2></div></div>
        <div className="answer-layout">
          <form action={saveAnswer} className="answer-form">
            <h3><Plus size={16} /> Add an answer</h3>
            <label className="field"><span>Question</span><input name="question" minLength={3} maxLength={300} placeholder="What are your career goals?" required /></label>
            <label className="field"><span>Your answer</span><textarea name="answer" rows={4} maxLength={5000} placeholder="Write an answer using your own facts…" required /></label>
            <label className="field"><span>Tags <small>Comma separated</small></span><input name="tags" placeholder="career goals, introduction" /></label>
            <button className="button button-primary" type="submit">Save answer</button>
            <p>Answers are never expanded with details you have not provided.</p>
          </form>
          <div className="answer-list">
            {answers.length === 0 ? <div className="empty-card"><div className="empty-mark">Q</div><h3>Your answer bank is empty</h3><p>Add a few common application answers. You can edit or remove them at any time.</p></div> : answers.map((answer) => (
              <article className="answer-card" key={answer.id}>
                <div className="answer-card-top"><h3>{answer.question}</h3><form action={deleteAnswer}><input type="hidden" name="id" value={answer.id} /><button className="icon-button danger" type="submit" aria-label={`Delete answer: ${answer.question}`}><Trash2 size={15} /></button></form></div>
                <p>{answer.answer}</p>
                <div className="tag-list">{answer.tags.map((tag, index) => <span key={`${tag}-${index}`}>{tag}</span>)}</div>
                <details className="answer-edit">
                  <summary><Pencil size={12} /> Edit this answer</summary>
                  <form action={saveAnswer} className="answer-edit-form">
                    <input type="hidden" name="id" value={answer.id} />
                    <label className="field"><span>Question</span><input name="question" defaultValue={answer.question} maxLength={300} required /></label>
                    <label className="field"><span>Answer</span><textarea name="answer" defaultValue={answer.answer} rows={4} maxLength={5000} required /></label>
                    <label className="field"><span>Tags</span><input name="tags" defaultValue={answer.tags.join(", ")} /></label>
                    <button className="button button-secondary" type="submit">Save changes</button>
                  </form>
                </details>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, name, defaultValue, type = "text", placeholder, required = false }: { label: string; name: string; defaultValue: string; type?: string; placeholder?: string; required?: boolean }) {
  return <label className="field"><span>{label}</span><input name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} required={required} maxLength={240} /></label>;
}
