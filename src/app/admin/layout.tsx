import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminAal2 } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const adminCtx = await requireAdminAal2("/admin");
  return <AdminShell email={adminCtx.email} role={adminCtx.role} aal={adminCtx.aal}>{children}</AdminShell>;
}
