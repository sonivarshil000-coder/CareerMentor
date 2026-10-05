import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, CircleHelp, FileText, ShieldCheck } from "lucide-react";

const helpItems = [
  { icon: BriefcaseBusiness, title: "Which companies can I follow?", body: "You can add any company's public careers page. CareerMentor scans supported job boards and public pages that expose readable listings. Pages requiring sign-in, blocking crawlers, or relying on JavaScript may not be readable." },
  { icon: FileText, title: "How does resume matching work?", body: "CareerMentor compares your stated target role and resume skills with each job description. Match scores show the evidence found and the listed skills missing from the resume." },
  { icon: ShieldCheck, title: "How are application details reused?", body: "CareerMentor starts with facts saved in your profile, answer bank, and selected resume, then prepares role-specific details for you to check." },
  { icon: CircleHelp, title: "Why did a job scan fail?", body: "Public boards can be temporarily unavailable or change their response. Open Companies to see the status and request another scan." },
];

export default function HelpPage() {
  return (
    <div className="page-wrap">
      <header className="page-header"><div><p className="eyebrow">Help center</p><h1>How CareerMentor works</h1><p>Answers about job discovery, matching, and applications.</p></div><Link className="button button-quiet button-small" href="/companies">Your companies <ArrowRight size={14} /></Link></header>
      <div className="help-list">{helpItems.map(({ icon: Icon, title, body }) => <article className="panel help-card" key={title}><span className="settings-icon"><Icon size={18} /></span><div><h2>{title}</h2><p>{body}</p></div></article>)}</div>
    </div>
  );
}
