import Link from "next/link";

import { signUp } from "@/lib/auth/actions";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;

  return (
    <main>
      <section className="auth-card" aria-labelledby="signup-title">
        <p className="eyebrow">Customer account</p>
        <h1 id="signup-title">Create account</h1>
        <p className="summary">
          Join 7Trumpets for verified order tracking and checkout.
        </p>

        {params.sent === "1" && (
          <p className="notice" role="status">
            Check your email to confirm your account and complete registration.
          </p>
        )}
        {params.error === "email" && (
          <p className="error" role="alert">
            Please provide a valid email address.
          </p>
        )}
        {params.error === "password" && (
          <p className="error" role="alert">
            Password must be at least 8 characters long.
          </p>
        )}
        {params.error === "profile" && (
          <p className="error" role="alert">
            Display name or phone number is invalid.
          </p>
        )}
        {params.error === "signup" && (
          <p className="error" role="alert">
            Unable to create account. Email may already be in use.
          </p>
        )}

        <form action={signUp}>
          <label htmlFor="email">Email *</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
          />

          <label htmlFor="password">Password * (min 8 chars)</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />

          <label htmlFor="display_name">Display Name</label>
          <input
            id="display_name"
            name="display_name"
            autoComplete="name"
            maxLength={100}
          />

          <label htmlFor="phone">Phone</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={32}
          />

          <button type="submit">Create account</button>
        </form>

        <div className="alternate">
          <span>
            Already have an account? <Link href="/login">Sign in</Link>
          </span>
        </div>
      </section>
    </main>
  );
}
