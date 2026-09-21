import { redirect } from "next/navigation";

import { safeAdminRedirectPath } from "@/lib/auth/redirect";
import { logServerError } from "@/lib/server-log";
import { createClient } from "@/lib/supabase/server";

export interface AdminAuthContext {
  userId: string;
  email: string;
  role: "admin" | "super_admin";
  aal: "aal1" | "aal2";
}

/**
 * Server-side admin authorization verification.
 * Verifies that the active session has an authoritative 'admin' or 'super_admin' role
 * stored in private.user_roles in PostgreSQL.
 *
 * NEVER trusts browser-provided roles, user_metadata, or query params.
 */
export async function getAdminAuthContext(): Promise<AdminAuthContext | null> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  const email = claimsData?.claims?.email ?? "";
  const aal = claimsData?.claims?.aal === "aal2" ? "aal2" : "aal1";

  if (claimsError || !userId) {
    if (claimsError) logServerError("admin.auth.claims", "auth_provider_failure");
    return null;
  }

  const { data: role, error } = await supabase.rpc("current_user_role");

  if (error) {
    logServerError("admin.auth.role", "database_failure");
    return null;
  }
  if (role !== "admin" && role !== "super_admin") {
    return null;
  }

  return { userId, email, role, aal };
}

export async function requireAdminAal2(next = "/admin") {
  const context = await getAdminAuthContext();
  const safeNext = safeAdminRedirectPath(next, "/admin");
  if (!context) redirect(`/login?next=${encodeURIComponent(safeNext)}`);
  if (context.aal !== "aal2") {
    const supabase = await createClient();
    const { data: factors, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      logServerError("admin.auth.mfa_factors", "auth_provider_failure");
      redirect(`/mfa/verify?next=${encodeURIComponent(safeNext)}`);
    }
    const hasVerifiedTotp = factors.totp.some((factor) => factor.status === "verified");
    const route = hasVerifiedTotp ? "/mfa/verify" : "/mfa/enroll";
    redirect(`${route}?next=${encodeURIComponent(safeNext)}`);
  }
  return context;
}
