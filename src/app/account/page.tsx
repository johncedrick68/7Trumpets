import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut, updateProfile } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; password?: string; saved?: string }>;
}) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) redirect("/login?next=/account");

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user || userData.user.id !== userId) {
    redirect("/login?next=/account");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, phone")
    .eq("id", userId)
    .single();

  const params = await searchParams;

  return (
    <main className="catalog-main">
      <div className="catalog-container" style={{ maxWidth: "780px" }}>
        {/* Header with User Info & Sign Out */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.75rem" }}>
          <div>
            <p className="eyebrow">Customer Account</p>
            <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: "0 0 0.25rem", letterSpacing: "-0.02em" }}>
              Account Settings
            </h1>
            <p style={{ color: "var(--ink-secondary)", fontSize: "14px", margin: 0 }}>
              Signed in as <strong style={{ color: "var(--ink)" }}>{userData.user.email}</strong>
            </p>
          </div>

          <form action={signOut}>
            <button type="submit" className="btn btn-secondary small-btn">
              Sign Out
            </button>
          </form>
        </div>

        {/* Account Sub-Navigation Tabs */}
        <nav className="account-tabs" aria-label="Account navigation">
          <Link href="/account" className="account-tab active">
            Profile Settings
          </Link>
          <Link href="/orders" className="account-tab">
            Order History
          </Link>
          <Link href="/account/addresses" className="account-tab">
            Saved Addresses
          </Link>
          <Link href="/update-password" className="account-tab">
            Password &amp; Security
          </Link>
          <Link href="/cart" className="account-tab">
            Shopping Bag
          </Link>
        </nav>

        {params.saved === "1" && (
          <p className="notice" role="status">
            Profile details updated successfully.
          </p>
        )}
        {params.password === "updated" && (
          <p className="notice" role="status">
            Password changed successfully.
          </p>
        )}
        {(params.error || profileError || !profile) && (
          <p className="error" role="alert">
            We could not load or save your profile. Please check your connection.
          </p>
        )}

        {/* Profile Card */}
        <section className="card-surface" aria-labelledby="profile-heading">
          <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "1rem", marginBottom: "1.5rem" }}>
            <h2 id="profile-heading" style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
              Personal Information
            </h2>
            <p style={{ color: "var(--ink-muted)", fontSize: "13px", margin: 0 }}>
              Update your contact details for delivery confirmations.
            </p>
          </div>

          {profile && (
            <form action={updateProfile}>
              <div className="form-group">
                <label htmlFor="display_name">Full Name / Display Name</label>
                <input
                  id="display_name"
                  name="display_name"
                  autoComplete="name"
                  maxLength={100}
                  defaultValue={profile.display_name ?? ""}
                  placeholder="Juan Dela Cruz"
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone Number (e.g. 0917 123 4567)</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  maxLength={32}
                  defaultValue={profile.phone ?? ""}
                  placeholder="0917 123 4567"
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
                <button type="submit" className="btn btn-primary">
                  Save Changes &rarr;
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
