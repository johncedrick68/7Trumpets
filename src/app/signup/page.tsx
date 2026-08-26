import Link from "next/link";

import { signInWithGoogle, signUp } from "@/lib/auth/actions";

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
        {params.error === "oauth" && (
          <p className="error" role="alert">
            Google authentication failed. Please try again.
          </p>
        )}

        {/* Google OAuth action */}
        <form action={signInWithGoogle} style={{ marginBottom: "1rem" }}>
          <button type="submit" className="button-link secondary" style={{ width: "100%", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: "0.5rem" }} aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Sign up with Google
          </button>
        </form>

        <div style={{ display: "flex", alignItems: "center", margin: "1rem 0", color: "var(--text-muted)" }}>
          <hr style={{ flex: 1, borderColor: "var(--border)" }} />
          <span style={{ padding: "0 0.75rem", fontSize: "0.85rem" }}>or register with email</span>
          <hr style={{ flex: 1, borderColor: "var(--border)" }} />
        </div>

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
