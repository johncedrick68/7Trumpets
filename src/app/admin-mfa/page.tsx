import { redirect } from "next/navigation";

import { getAdminAuthContext } from "@/lib/admin/auth";
import { safeRedirectPath } from "@/lib/auth/redirect";
import MfaForm from "./mfa-form";

export const dynamic = "force-dynamic";

export default async function AdminMfaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const context = await getAdminAuthContext();
  const next = safeRedirectPath((await searchParams).next, "/admin");
  if (!context) redirect(`/login?next=${encodeURIComponent("/admin")}`);
  if (context.aal === "aal2") redirect(next);

  return (
    <main className="auth-main">
      <section className="auth-card" aria-labelledby="mfa-heading">
        <p className="eyebrow">Staff security</p>
        <h1 id="mfa-heading">Verify authenticator</h1>
        <p>Admin access requires a current six-digit authenticator code.</p>
        <MfaForm email={context.email} next={next} />
      </section>
    </main>
  );
}
