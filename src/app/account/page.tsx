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
    <main>
      <section className="account-card" aria-labelledby="account-title">
        <div className="account-heading">
          <div>
            <p className="eyebrow">Customer account</p>
            <h1 id="account-title">Your profile</h1>
          </div>
          <form action={signOut}>
            <button className="secondary" type="submit">
              Sign out
            </button>
          </form>
        </div>

        <p className="account-email">
          Signed in as <strong>{userData.user.email}</strong>
        </p>

        <nav className="account-quick-links" aria-label="Account navigation">
          <Link href="/orders" className="category-pill">
            My Orders
          </Link>
          <Link href="/account/addresses" className="category-pill">
            Saved Addresses
          </Link>
          <Link href="/cart" className="category-pill">
            View Cart
          </Link>
        </nav>

        {params.saved === "1" && (
          <p className="notice" role="status">
            Profile saved.
          </p>
        )}
        {params.password === "updated" && (
          <p className="notice" role="status">
            Password updated.
          </p>
        )}
        {(params.error || profileError || !profile) && (
          <p className="error" role="alert">
            We could not load or save your profile.
          </p>
        )}

        {profile && (
          <form action={updateProfile}>
            <label htmlFor="display_name">Display name</label>
            <input
              id="display_name"
              name="display_name"
              autoComplete="name"
              maxLength={100}
              defaultValue={profile.display_name ?? ""}
            />
            <label htmlFor="phone">Phone</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              maxLength={32}
              defaultValue={profile.phone ?? ""}
            />
            <button type="submit">Save profile</button>
          </form>
        )}
      </section>
    </main>
  );
}
