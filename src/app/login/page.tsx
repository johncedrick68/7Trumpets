import Link from "next/link";
import { signIn, signInWithGoogle } from "@/lib/auth/actions";
import { GoogleIcon } from "@/components/icons";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; signedOut?: string }>;
}) {
  const params = await searchParams;

  return (
    <main style={{ minHeight: "calc(100vh - 120px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem var(--pad-page)" }}>
      <section className="auth-card" aria-labelledby="login-title">
        <p className="eyebrow">Customer Account</p>
        <h1 id="login-title" style={{ fontSize: "1.8rem", fontWeight: 800, margin: "0 0 0.4rem", letterSpacing: "-0.02em" }}>
          Welcome back
        </h1>
        <p style={{ color: "var(--ink-secondary)", fontSize: "14px", margin: "0 0 1.5rem" }}>
          Sign in to access your orders and account settings.
        </p>

        {params.signedOut === "1" && (
          <p className="notice" role="status">
            You are signed out.
          </p>
        )}
        {params.error === "credentials" && (
          <p className="error" role="alert">
            Invalid email or password.
          </p>
        )}
        {params.error === "oauth" && (
          <p className="error" role="alert">
            Google authentication failed. Please check your provider configuration.
          </p>
        )}

        {/* Google OAuth action */}
        <form action={signInWithGoogle} style={{ marginBottom: "1rem" }}>
          <input type="hidden" name="next" value={params.next ?? "/account"} />
          <button type="submit" className="btn btn-secondary" style={{ width: "100%", justifyContent: "center" }}>
            <GoogleIcon size={16} />
            <span>Continue with Google</span>
          </button>
        </form>

        <div style={{ display: "flex", alignItems: "center", margin: "1.25rem 0", color: "var(--ink-muted)" }}>
          <hr style={{ flex: 1, borderColor: "var(--border)" }} />
          <span style={{ padding: "0 0.75rem", fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            or continue with email
          </span>
          <hr style={{ flex: 1, borderColor: "var(--border)" }} />
        </div>

        <form action={signIn}>
          <input type="hidden" name="next" value={params.next ?? "/account"} />
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            placeholder="you@example.com"
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
          />
          <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
            Sign In &rarr;
          </button>
        </form>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.5rem", borderTop: "1px solid var(--border)", paddingTop: "1rem", fontSize: "13px", color: "var(--ink-muted)" }}>
          <Link href="/forgot-password" style={{ textDecoration: "underline" }}>Forgot password?</Link>
          <span>
            New here? <Link href="/signup" style={{ color: "var(--ink)", fontWeight: 600 }}>Create account &rarr;</Link>
          </span>
        </div>
      </section>
    </main>
  );
}
