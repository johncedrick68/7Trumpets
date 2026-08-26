import { createClient, createServiceClient } from "@/lib/supabase/server";

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
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  const email = claimsData?.claims?.email ?? "";
  const aal = (claimsData?.claims?.aal as "aal1" | "aal2") || "aal1";

  if (!userId) {
    return null;
  }

  // Use service client to securely query private.user_roles for this user
  const serviceClient = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: roles, error } = await (serviceClient as any)
    .schema("private")
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error || !roles || roles.length === 0) {
    return null;
  }

  // Check if user has super_admin or admin role
  const roleList = roles.map((r: { role: string }) => r.role);
  if (roleList.includes("super_admin")) {
    return { userId, email, role: "super_admin", aal };
  } else if (roleList.includes("admin")) {
    return { userId, email, role: "admin", aal };
  }

  return null;
}
