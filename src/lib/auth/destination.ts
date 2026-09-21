import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { postLoginRoute } from "@/lib/auth/mfa-routing";
import type { Database } from "@/types/database";

export async function resolvePostLoginDestination(
  supabase: SupabaseClient<Database>,
  next?: string | null,
) {
  const [{ data: role }, { data: factors }, { data: assurance }] = await Promise.all([
    supabase.rpc("current_user_role"),
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);

  const canonicalRole =
    role === "customer" || role === "cashier" || role === "admin" || role === "super_admin"
      ? role
      : null;

  return postLoginRoute({
    role: canonicalRole,
    hasVerifiedTotp: factors?.totp.some((factor) => factor.status === "verified") ?? false,
    aal: assurance?.currentLevel === "aal2" ? "aal2" : "aal1",
    next,
  });
}
