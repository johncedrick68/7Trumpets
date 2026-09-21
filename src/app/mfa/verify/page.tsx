import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { AdminMfaForm } from "@/components/admin-mfa-form";
import { getAdminAuthContext } from "@/lib/admin/auth";
import { safeAdminRedirectPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MfaVerifyPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeAdminRedirectPath((await searchParams).next, "/admin");
  const context = await getAdminAuthContext();
  if (!context) redirect(`/login?next=${encodeURIComponent(`/mfa/verify?next=${next}`)}`);
  if (context.aal === "aal2") redirect(next);

  const { data: factors } = await (await createClient()).auth.mfa.listFactors();
  const verified = factors?.totp.find((factor) => factor.status === "verified");
  if (!verified) redirect(`/mfa/enroll?next=${encodeURIComponent(next)}`);

  return (
    <main className="store-container page-section flex min-h-[70vh] items-center justify-center">
      <section className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8" aria-labelledby="mfa-heading">
        <div className="mb-2 flex items-center gap-2"><ShieldCheck className="size-5" /><p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Staff Security</p></div>
        <h1 id="mfa-heading" className="text-2xl font-black tracking-tight sm:text-3xl">Verify authenticator</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Enter the current code from your personal authenticator to establish an AAL2 Admin session.</p>
        <AdminMfaForm mode="verify" next={next} verifiedFactorId={verified.id} />
      </section>
    </main>
  );
}
