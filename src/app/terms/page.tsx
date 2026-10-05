import Link from "next/link";
import { Logo } from "@/components/logo";

export default function TermsPage() {
  return (
    <main className="auth-page">
      <header className="auth-header"><Logo /><Link href="/" className="quiet-link">Back to home</Link></header>
      <article className="legal-page">
        <p className="eyebrow">Terms · product draft</p>
        <h1>You decide what gets sent.</h1>
        <p className="legal-lede">CareerMentor organizes job discovery and prepares role-specific application details. Review these draft terms with counsel before making the service available to the public.</p>
        <h2>Use of the service</h2><p>Use only company career pages and supported public ATS platforms that permit access. Do not connect sites that prohibit automated access, including LinkedIn, Naukri, and Indeed.</p>
        <h2>Application review</h2><p>Prepared fields are drafts. Check each field before sending it. CareerMentor must stop when a form requires an unknown fact, account login, payment, CAPTCHA, or uncertain field mapping.</p>
        <h2>Your information</h2><p>Keep your profile and answers accurate. Do not ask the service to invent work experience or qualifications. You can export or request deletion of your account data.</p>
        <h2>Plans and availability</h2><p>Features and plan limits are shown in the product. Job listings can close or change, and CareerMentor cannot guarantee a job remains available or that an employer responds.</p>
        <h2>Contact</h2><p>Use the support contact configured by the service operator for questions about these terms.</p>
      </article>
    </main>
  );
}
