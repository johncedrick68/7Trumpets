import { safeAdminRedirectPath, safeCustomerRedirectPath } from "@/lib/auth/redirect";

export type AuthenticatedRole = "customer" | "cashier" | "admin" | "super_admin";

export function postLoginRoute({
  role,
  hasVerifiedTotp,
  aal,
  next,
}: {
  role: AuthenticatedRole | null;
  hasVerifiedTotp: boolean;
  aal: "aal1" | "aal2";
  next?: string | null;
}) {
  if (role !== "admin" && role !== "super_admin") {
    return safeCustomerRedirectPath(next, "/account");
  }

  const adminNext = safeAdminRedirectPath(next, "/admin");
  const encodedNext = encodeURIComponent(adminNext);
  if (!hasVerifiedTotp) return `/mfa/enroll?next=${encodedNext}`;
  if (aal !== "aal2") return `/mfa/verify?next=${encodedNext}`;
  return adminNext;
}
