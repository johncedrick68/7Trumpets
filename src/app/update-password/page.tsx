import { updatePassword } from "@/lib/auth/actions";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main>
      <section className="auth-card" aria-labelledby="update-pw-title">
        <p className="eyebrow">Customer account</p>
        <h1 id="update-pw-title">New password</h1>
        <p className="summary">Set a new secure password for your account.</p>

        {params.error === "password" && (
          <p className="error" role="alert">
            Password must be at least 8 characters long.
          </p>
        )}
        {params.error === "update" && (
          <p className="error" role="alert">
            Unable to update password. Please request a new reset link.
          </p>
        )}

        <form action={updatePassword}>
          <label htmlFor="password">New Password * (min 8 chars)</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <button type="submit">Update password</button>
        </form>
      </section>
    </main>
  );
}
