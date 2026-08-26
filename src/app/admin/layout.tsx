import Link from "next/link";

import { requireAdminAal2 } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const adminCtx = await requireAdminAal2("/admin");

  return (
    <div className="admin-container">
      <aside className="admin-sidebar" aria-label="Admin Navigation">
        <div className="admin-sidebar-header">
          <Link href="/admin" className="admin-brand">
            7Trumpets Admin
          </Link>
          <div className="admin-user-pill">
            <span className="admin-user-email">{adminCtx.email}</span>
            <span className="admin-role-badge">
              {adminCtx.role === "super_admin" ? "SUPER ADMIN" : "ADMIN"}
            </span>
            {adminCtx.aal === "aal2" && <span className="aal-badge">AAL2</span>}
          </div>
        </div>

        <nav className="admin-nav">
          <Link href="/admin" className="admin-nav-link">
            Dashboard
          </Link>
          <Link href="/admin/orders" className="admin-nav-link">
            Orders & Fulfillment
          </Link>
          <Link href="/admin/payments" className="admin-nav-link">
            Payment Verification
          </Link>
          <Link href="/admin/catalog" className="admin-nav-link">
            Catalog Overview
          </Link>
          <Link href="/admin/audit" className="admin-nav-link">
            Audit Logs
          </Link>
          {adminCtx.role === "super_admin" && (
            <Link href="/admin/users" className="admin-nav-link">
              Staff & Roles
            </Link>
          )}
          <hr className="admin-divider" />
          <Link href="/" className="admin-nav-link storefront-link">
            &larr; Customer Storefront
          </Link>
        </nav>
      </aside>

      <main className="admin-main-content">{children}</main>
    </div>
  );
}
