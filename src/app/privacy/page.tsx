import Link from "next/link";
import { Logo } from "@/components/logo";

export default function PrivacyPage() {
  return (
    <main className="auth-page">
      <header className="auth-header"><Logo /><Link href="/" className="quiet-link">Back to home</Link></header>
      <article className="legal-page">
        <p className="eyebrow">Privacy notice · product draft</p>
        <h1>Your job-search data stays yours.</h1>
        <p className="legal-lede">CareerMentor uses the details you choose to store to organize your search, compare jobs with your resumes, and prepare role-specific application details. This notice should be reviewed for your launch jurisdiction before collecting real user data.</p>
        <h2>Information you provide</h2><p>Account details, profile facts, saved answers, resumes, company career-page URLs, and application review decisions. Application screenshots and event records may also be created when you use the review flow.</p>
        <h2>How CareerMentor uses it</h2><p>To discover jobs on public career pages, match jobs against your selected resumes, prepare role-specific application details from stored facts, maintain your tracker, and send service notifications. If an AI feature is enabled, only relevant resume or job context is sent to the configured AI provider; unrelated profile data should not be included.</p>
        <h2>Your choices</h2><p>You can review and edit proposed answers, decide whether to send an application, export your account data, or request account deletion from Settings. CareerMentor must not submit facts that you have not stored or confirmed.</p>
        <h2>Storage and sharing</h2><p>Resumes and profile information are sensitive. Production deployments must encrypt stored files, scope records to the owning account, restrict staff access, and document service providers and retention periods before launch.</p>
        <h2>Questions</h2><p>Contact the CareerMentor team through the support address configured by the service operator. This draft does not replace a jurisdiction-specific privacy notice or legal review.</p>
      </article>
    </main>
  );
}
