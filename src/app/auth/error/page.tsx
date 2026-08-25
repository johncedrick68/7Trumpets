import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main>
      <section className="auth-card" aria-labelledby="auth-error-title">
        <p className="eyebrow">Authentication Error</p>
        <h1 id="auth-error-title">Link Expired or Invalid</h1>
        <p className="summary">
          The link you followed has expired or is no longer valid. Please request a new confirmation or password reset link.
        </p>

        <div className="alternate">
          <Link href="/login">Return to Sign In</Link>
          <Link href="/signup">Create an Account</Link>
        </div>
      </section>
    </main>
  );
}
