import Link from "next/link";
import { ArrowRight, LogIn, Mail } from "lucide-react";
import { startAuthentication } from "@/app/actions/auth";

type AuthFormProps = { mode: "login" | "signup" };

export function AuthForm({ mode }: AuthFormProps) {
  const isSignup = mode === "signup";
  const emailEnabled = Boolean(process.env.EMAIL_SERVER && process.env.EMAIL_FROM);
  const googleEnabled = Boolean(
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
  );

  return (
    <section className="auth-card">
      <p className="eyebrow">{isSignup ? "Create your workspace" : "Welcome back"}</p>
      <h1>{isSignup ? "Start with a clearer plan." : "Pick up where you left off."}</h1>
      <p className="auth-copy">
        Use a secure email link or continue with Google. We ask for your email
        first so your consent is recorded with the account you choose.
      </p>

      <form action={startAuthentication} className="auth-form">
        <input type="hidden" name="provider" value="nodemailer" />
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          maxLength={254}
          required
        />
        <label className="consent-row">
          <input type="checkbox" name="consent" required />
          <span>
            I agree to the <Link href="/privacy">Privacy Notice</Link> and
            consent to CareerMentor processing my profile, resumes, and application
            data to provide this service.
          </span>
        </label>
        <button className="button button-primary" type="submit" disabled={!emailEnabled}>
          <Mail size={17} />
          {emailEnabled ? "Continue with email" : "Email login needs SMTP setup"}
          {emailEnabled && <ArrowRight size={17} />}
        </button>
      </form>

      <div className="auth-divider"><span>or</span></div>

      <form action={startAuthentication} className="auth-form">
        <input type="hidden" name="provider" value="google" />
        <label className="sr-only" htmlFor="google-email">Google account email</label>
        <input
          id="google-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Email on your Google account"
          maxLength={254}
          required
        />
        <label className="consent-row">
          <input type="checkbox" name="consent" required />
          <span>
            I agree to the <Link href="/privacy">Privacy Notice</Link> and
            consent to processing my application data.
          </span>
        </label>
        <button className="button button-secondary" type="submit" disabled={!googleEnabled}>
          <LogIn size={17} />
          {googleEnabled ? "Continue with Google" : "Google login needs setup"}
        </button>
      </form>

      {!emailEnabled && !googleEnabled && (
        <p className="setup-hint">
          Add SMTP or Google OAuth credentials to `.env` to enable sign-in.
          See the setup guide in README.md.
        </p>
      )}

      <p className="auth-switch">
        {isSignup ? "Already have an account?" : "New to CareerMentor?"}{" "}
        <Link href={isSignup ? "/login" : "/signup"}>
          {isSignup ? "Sign in" : "Create an account"}
        </Link>
      </p>
      <p className="auth-footnote">
        Sign-in links expire after 30 minutes. You can export or delete your
        account data from Settings.
      </p>
    </section>
  );
}
