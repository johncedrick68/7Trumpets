import Link from "next/link";
import { signInWithGoogle, signUp } from "@/lib/auth/actions";
import { GoogleIcon } from "@/components/icons";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;

  return (
    <main style={{ minHeight: "calc(100vh - 120px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem var(--pad-page)" }}>
      <section className="auth-card" aria-labelledby="signup-title">
        <p className="eyebrow">Customer Account</p>
        <h1 id="signup-title" style={{ fontSize: "1.8rem", fontWeight: 800, margin: "0 0 0.4rem", letterSpacing: "-0.02em" }}>
          Create account
        </h1>
        <p style={{ color: "var(--ink-secondary)", fontSize: "14px", margin: "0 0 1.5rem" }}>
          Join 1968 Clothing for verified order tracking and checkout.
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
          <button type="submit" className="btn btn-secondary" style={{ width: "100%", justifyContent: "center" }}>
            <GoogleIcon size={16} />
            <span>Sign up with Google</span>
          </button>
        </form>

        <div style={{ display: "flex", alignItems: "center", margin: "1.25rem 0", color: "var(--ink-muted)" }}>
          <hr style={{ flex: 1, borderColor: "var(--border)" }} />
          <span style={{ padding: "0 0.75rem", fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            or register with email
          </span>
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
            placeholder="you@example.com"
          />

          <label htmlFor="password">Password * (min 8 chars)</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            placeholder="••••••••"
          />

          <label htmlFor="display_name">Full Name</label>
          <input
            id="display_name"
            name="display_name"
            autoComplete="name"
            maxLength={100}
            placeholder="Juan Dela Cruz"
          />

          <label htmlFor="phone">Phone (Optional)</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={32}
            placeholder="0917 123 4567"
          />

          <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
            Create Account &rarr;
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "1.5rem", borderTop: "1px solid var(--border)", paddingTop: "1rem", fontSize: "13px", color: "var(--ink-muted)" }}>
          <span>
            Already have an account? <Link href="/login" style={{ color: "var(--ink)", fontWeight: 600 }}>Sign in &rarr;</Link>
          </span>
        </div>
      </section>
    </main>
  );
}
