import Link from "next/link";

import { requestPasswordReset } from "@/lib/auth/actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;

  return (
    <main>
      <section className="auth-card" aria-labelledby="forgot-title">
        <p className="eyebrow">Customer account</p>
        <h1 id="forgot-title">Reset password</h1>
        <p className="summary">
          Enter your account email to receive a password reset link.
        </p>

        {params.sent === "1" && (
          <p className="notice" role="status">
            If an account exists with that email, a password reset link has been sent.
          </p>
        )}
        {params.error === "email" && (
          <p className="error" role="alert">
            Please enter a valid email address.
          </p>
        )}

        <form action={requestPasswordReset}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
          />
          <button type="submit">Send reset link</button>
        </form>

        <div className="alternate">
          <Link href="/login">Back to sign in</Link>
        </div>
      </section>
    </main>
  );
}
