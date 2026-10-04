import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <header className="auth-header">
        <Logo />
        <Link href="/" className="quiet-link">Back to home</Link>
      </header>
      <div className="auth-layout">
        <div className="auth-story">
          <p className="eyebrow">A calmer job search starts here</p>
          <h2>Keep your applications honest, organized, and yours.</h2>
          <ul>
            <li>One resume tailored to each target role</li>
            <li>Entry-level openings from saved company career sites</li>
            <li>Every application reviewed by you before it is sent</li>
          </ul>
        </div>
        <AuthForm mode="login" />
      </div>
    </main>
  );
}
