import Link from "next/link";
import { updatePassword } from "@/lib/auth/actions";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="catalog-main">
      <div className="catalog-container" style={{ maxWidth: "680px" }}>
        <header style={{ marginBottom: "1.75rem" }}>
          <p className="eyebrow">Customer Account</p>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: "0 0 0.25rem", letterSpacing: "-0.02em" }}>
            Security &amp; Password
          </h1>
          <p style={{ color: "var(--ink-secondary)", fontSize: "14px", margin: 0 }}>
            Manage account authentication and password security.
          </p>
        </header>

        {/* Account Sub-Navigation Tabs */}
        <nav className="account-tabs" aria-label="Account navigation">
          <Link href="/account" className="account-tab">
            Profile Settings
          </Link>
          <Link href="/orders" className="account-tab">
            Order History
          </Link>
          <Link href="/account/addresses" className="account-tab">
            Saved Addresses
          </Link>
          <Link href="/update-password" className="account-tab active">
            Password &amp; Security
          </Link>
          <Link href="/cart" className="account-tab">
            Shopping Bag
          </Link>
        </nav>

        <section className="card-surface" aria-labelledby="update-pw-title">
          <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "1rem", marginBottom: "1.5rem" }}>
            <h2 id="update-pw-title" style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
              Change Password
            </h2>
            <p style={{ color: "var(--ink-muted)", fontSize: "13px", margin: 0 }}>
              Enter a new secure password (minimum 8 characters).
            </p>
          </div>

          {params.error === "password" && (
            <p className="error" role="alert">
              Password must be at least 8 characters long.
            </p>
          )}
          {params.error === "update" && (
            <p className="error" role="alert">
              Unable to update password. Please check your session or request a new reset link.
            </p>
          )}

          <form action={updatePassword}>
            <div className="form-group">
              <label htmlFor="password">New Password *</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                placeholder="••••••••"
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
              <button type="submit" className="btn btn-primary">
                Update Password &rarr;
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
