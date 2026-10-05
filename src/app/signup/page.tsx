import { AuthForm } from "@/components/auth-form";
import { Logo } from "@/components/logo";
import Link from "next/link";

export default function SignupPage() {
  return (
    <main className="auth-page">
      <header className="auth-header">
        <Logo />
        <Link href="/" className="quiet-link">Back to home</Link>
      </header>
      <div className="auth-layout">
        <div className="auth-story">
          <p className="eyebrow">A free workspace for your next move</p>
          <h2>Apply with context, not copy and paste.</h2>
          <ul>
            <li>Follow as many companies as you need</li>
            <li>Compare jobs against each of your resumes</li>
            <li>Keep control of every answer and final submission</li>
          </ul>
        </div>
        <AuthForm mode="signup" />
      </div>
    </main>
  );
}
