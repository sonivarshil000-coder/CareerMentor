import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Logo } from "@/components/logo";

export default function CheckEmailPage() {
  return (
    <main className="auth-page">
      <header className="auth-header">
        <Logo />
        <Link href="/login" className="quiet-link">Back to sign in</Link>
      </header>
      <div className="auth-layout">
        <div className="auth-story">
          <p className="eyebrow">One quick step</p>
          <h2>Check your inbox to finish signing in.</h2>
          <ul>
            <li>Open the secure sign-in link in your email</li>
            <li>Check your spam or junk folder if it is missing</li>
          </ul>
        </div>
        <section className="auth-card">
          <MailCheck size={26} aria-hidden="true" />
          <p className="eyebrow">Email sent</p>
          <h1>Check your email</h1>
          <p className="auth-copy">
            We sent you a sign-in link. Check your inbox and follow the link to continue.
          </p>
          <p className="auth-footnote">
            The sign-in link expires after 30 minutes.
          </p>
        </section>
      </div>
    </main>
  );
}