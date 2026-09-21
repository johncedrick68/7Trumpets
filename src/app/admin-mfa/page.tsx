import { redirect } from "next/navigation";
import { getAdminAuthContext } from "@/lib/admin/auth";
import { safeAdminRedirectPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminMfaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const context = await getAdminAuthContext();
  const next = safeAdminRedirectPath((await searchParams).next, "/admin");
  if (!context) redirect(`/login?next=${encodeURIComponent("/admin")}`);
  if (context.aal === "aal2") redirect(next);
  const { data: factors } = await (await createClient()).auth.mfa.listFactors();
  const route = factors?.totp.some((factor) => factor.status === "verified") ? "/mfa/verify" : "/mfa/enroll";
  redirect(`${route}?next=${encodeURIComponent(next)}`);
}

