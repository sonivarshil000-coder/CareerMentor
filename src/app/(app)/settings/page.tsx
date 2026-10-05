import Link from "next/link";
import { ArrowRight, Download, FileText, LockKeyhole, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { deleteAccount } from "@/app/actions/account";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";

export default async function SettingsPage() {
  const user = await requireUser();
  const [profile, account, subscription, companyCount, resumeCount] = await Promise.all([
    db.profile.findUnique({ where: { userId: user.id }, select: { fullName: true, email: true } }),
    db.user.findUnique({ where: { id: user.id }, select: { consentedAt: true, consentVersion: true } }),
    db.subscription.findUnique({ where: { userId: user.id }, select: { plan: true, status: true, currentPeriodEnd: true } }),
    db.company.count({ where: { userId: user.id } }),
    db.resume.count({ where: { userId: user.id } }),
  ]);

  return (
    <div className="page-wrap">
      <header className="page-header"><div><p className="eyebrow">Your account</p><h1>Settings</h1><p>Manage your account details and review how CareerMentor handles your data.</p></div><span className="soft-pill">{(subscription?.plan ?? "FREE").toLowerCase()} plan</span></header>
      <div className="settings-grid">
        <section className="panel settings-card"><div className="settings-icon"><UserRound size={19} /></div><p className="eyebrow">Profile</p><h2>{profile?.fullName ?? user.name ?? "Your account"}</h2><p>{profile?.email ?? user.email ?? "Add an email to your profile"}</p><Link className="text-action" href="/profile">Edit profile and answers <ArrowRight size={14} /></Link></section>
        <section className="panel settings-card"><div className="settings-icon"><FileText size={19} /></div><p className="eyebrow">Your workspace</p><h2>{companyCount} companies · {resumeCount} resumes</h2><p>There is no saved-company limit. Pause or remove boards from your company list any time.</p><Link className="text-action" href="/companies">Manage companies <ArrowRight size={14} /></Link></section>
        <section className="panel settings-card"><div className="settings-icon"><LockKeyhole size={19} /></div><p className="eyebrow">Application safety</p><h2>Nothing is submitted automatically</h2><p>Every prepared application waits for your approval. Approved drafts continue on the employer’s own site.</p><Link className="text-action" href="/approvals">Review approval queue <ArrowRight size={14} /></Link></section>
        <section className="panel settings-card"><div className="settings-icon"><ShieldCheck size={19} /></div><p className="eyebrow">Privacy and consent</p><h2>{account?.consentedAt ? "Consent is recorded" : "Consent is not recorded"}</h2><p>{account?.consentedAt ? `Accepted ${account.consentVersion ?? "the current terms"} on ${account.consentedAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.` : "Review the privacy notice and consent terms before using your account."} Account data is scoped to you.</p><Link className="text-action" href="/privacy">Read privacy notice <ArrowRight size={14} /></Link></section>
      </div>
      <section className="panel data-rights-card"><div><p className="eyebrow">Your data</p><h2>Export or remove your account</h2><p>The export contains your profile, saved answers, resume parsing results, company list, applications, notifications, and audit history. Resume files remain available in your private library until account removal.</p></div><div className="data-rights-actions"><a className="button button-quiet button-small" href="/api/account/export"><Download size={14} /> Download my data</a><details className="delete-account-details"><summary><Trash2 size={14} /> Delete account</summary><form action={deleteAccount} className="delete-account-form"><label className="field"><span>Type DELETE to confirm</span><input name="confirmation" required pattern="DELETE" minLength={6} maxLength={6} autoComplete="off" /></label><button className="button button-danger button-small" type="submit">Delete account and private files</button></form></details></div></section>
    </div>
  );
}
