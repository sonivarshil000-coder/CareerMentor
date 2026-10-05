import Link from "next/link";
import {
  ArrowRight,
  Check,
  FileText,
  Fingerprint,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/logo";

const features = [
  { icon: FileText, title: "A resume for every role", text: "Keep tailored resumes side by side. See which one fits a job and why." },
  { icon: SearchCheck, title: "Find fresher-friendly roles", text: "Discover supported company career openings that fit your experience level." },
  { icon: Fingerprint, title: "Answers grounded in your facts", text: "Your profile, answer bank, and chosen resume are the only sources for application answers." },
];

export default function Home() {
  return (
    <main className="landing">
      <header className="marketing-nav">
        <Logo />
        <nav aria-label="Main navigation"><Link href="#how-it-works">How it works</Link><Link href="#privacy">Privacy</Link><Link href="/pricing">Pricing</Link></nav>
        <div className="nav-actions"><Link href="/login" className="nav-login">Log in</Link><Link href="/signup" className="button button-primary button-small">Get started <ArrowRight size={15} /></Link></div>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <div className="hero-badge"><span className="pulse-dot" /> JOB SEARCH, WITH YOU IN CONTROL</div>
          <h1>Make room for the work that <em>moves you forward.</em></h1>
          <p>CareerMentor finds entry-level roles across the company career pages you choose, matches them to your resumes, and prepares job-specific application details.</p>
          <div className="hero-actions"><Link href="/signup" className="button button-primary">Create your free workspace <ArrowRight size={17} /></Link><Link href="#how-it-works" className="button button-quiet">See how it works</Link></div>
          <div className="hero-proof"><ShieldCheck size={16} /><span>No application is submitted before you approve it.</span></div>
        </div>

        <div className="preview-card" aria-label="CareerMentor dashboard preview">
          <div className="preview-topbar"><div className="preview-brand"><span className="brand-mark mini"><i /><i /><i /><i /></span><b>CareerMentor</b></div><div className="preview-user">VS</div></div>
          <div className="preview-content"><div className="preview-greeting"><div><small>MONDAY, OCTOBER 5</small><h2>Your search, at a glance.</h2></div><span className="preview-period">This week⌄</span></div>
            <div className="preview-stats"><div><small>NEW MATCHES</small><b>08</b><span>+3 since Friday</span></div><div><small>COMPANIES</small><b>04</b><span>Across 2 locations</span></div><div className="stat-warm"><small>YOUR REVIEW</small><b>02</b><span>Ready when you are</span></div></div>
            <div className="preview-section-head"><b>Top matches</b><span>View all jobs <ArrowRight size={13} /></span></div>
            <div className="preview-job"><span className="company-avatar mint">S</span><div><b>Junior Data Analyst</b><small>Stripe <i /> Bengaluru · Entry level</small></div><span className="match-score">92%<small>match</small></span></div>
            <div className="preview-job"><span className="company-avatar lilac">A</span><div><b>AI Product Intern</b><small>Atlassian <i /> Remote · Internship</small></div><span className="match-score">86%<small>match</small></span></div>
            <div className="preview-footer"><span><ShieldCheck size={14} /> Nothing submits without you</span><span>Preview</span></div>
          </div>
        </div>
        <div className="hero-spark spark-one" aria-hidden="true">✳</div><div className="hero-spark spark-two" aria-hidden="true">✳</div>
      </section>

      <section className="trust-strip"><p>Made for thoughtful applications</p><div><span><Check size={15} /> Company career pages</span><span><Check size={15} /> Public ATS platforms</span><span><Check size={15} /> Human approval first</span></div></section>

      <section className="feature-section" id="how-it-works"><div className="section-intro"><p className="eyebrow">A better way to keep momentum</p><h2>Less searching. More choosing.</h2><p>Keep your job search in one place and make each application feel considered.</p></div><div className="feature-grid">{features.map(({ icon: Icon, title, text }, index) => <article className="feature-card" key={title}><span className="feature-index">0{index + 1}</span><div className="feature-icon"><Icon size={20} /></div><h3>{title}</h3><p>{text}</p><span className="feature-line" /></article>)}</div></section>

      <section className="control-section" id="privacy"><div className="control-card"><div><p className="eyebrow">Your information, your call</p><h2>Helpful automation.<br /><em>Human judgment.</em></h2><p>CareerMentor reuses the facts you save and tailors application details to each role. You can review and correct them before they are used.</p><Link href="/signup" className="button button-light">Build your workspace <ArrowRight size={16} /></Link></div><ul><li><Check size={16} /> Private resumes and profile data</li><li><Check size={16} /> Clear match reasons and skill gaps</li><li><Check size={16} /> Job-specific application details</li><li><Check size={16} /> Export or delete your data</li></ul></div></section>

      <footer className="marketing-footer"><Logo /><span>© 2026 CareerMentor</span><div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="mailto:support@careermentor.example">Contact</Link></div></footer>
    </main>
  );
}
