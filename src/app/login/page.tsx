import Link from "next/link";

import { signIn } from "@/lib/auth/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; signedOut?: string }>;
}) {
  const params = await searchParams;

  return (
    <main>
      <section className="auth-card" aria-labelledby="login-title">
        <p className="eyebrow">Customer account</p>
        <h1 id="login-title">Welcome back</h1>
        <p className="summary">Sign in with your confirmed email address.</p>

        {params.signedOut === "1" && (
          <p className="notice" role="status">
            You are signed out.
          </p>
        )}
        {params.error && (
          <p className="error" role="alert">
            Unable to sign in with those credentials.
          </p>
        )}

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
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <button type="submit">Sign in</button>
        </form>

        <div className="alternate">
          <Link href="/forgot-password">Forgot password?</Link>
          <span>
            New here? <Link href="/signup">Create account</Link>
          </span>
        </div>
      </section>
    </main>
  );
}
