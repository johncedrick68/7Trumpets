import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
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
    <main className="store-container page-section min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8" aria-labelledby="mfa-heading">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-md bg-muted text-foreground">
              <ShieldCheck className="size-4" />
            </div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Staff Security
            </p>
          </div>

          <h1 id="mfa-heading" className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Verify Authenticator
          </h1>

          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Administrative operations require active two-factor authentication (AAL2).
          </p>

          <MfaForm email={context.email} next={next} />
        </div>
      </div>
    </main>
  );
}

