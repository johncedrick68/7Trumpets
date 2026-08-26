import Link from "next/link";
import Image from "next/image";
import { requireAdminAal2 } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const adminCtx = await requireAdminAal2("/admin");

  return (
    <div className="admin-container" style={{ display: "flex", minHeight: "100vh", background: "var(--paper)" }}>
      <aside className="admin-sidebar" aria-label="Admin Navigation" style={{ width: "260px", background: "var(--surface)", borderRight: "1px solid var(--line)", padding: "1.5rem 1rem", display: "flex", flexDirection: "column" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <Link href="/admin" aria-label="1968 Operations Home">
            <Image
              src="/images/1968%20Clothing%20Logo%20transparent.webp"
              alt="1968 Clothing"
              width={130}
              height={34}
              style={{ height: "34px", width: "auto", objectFit: "contain", marginBottom: "0.75rem" }}
            />
          </Link>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis" }}>{adminCtx.email}</span>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <span className="status-pill status-confirmed" style={{ fontSize: "0.7rem", padding: "0.15rem 0.5rem" }}>
                {adminCtx.role === "super_admin" ? "SUPER ADMIN" : "ADMIN"}
              </span>
              {adminCtx.aal === "aal2" && (
                <span className="status-pill" style={{ fontSize: "0.7rem", padding: "0.15rem 0.5rem", background: "rgba(200, 196, 255, 0.15)", color: "var(--accent-soft)", borderColor: "rgba(200, 196, 255, 0.3)" }}>
                  AAL2 MFA
                </span>
              )}
            </div>
          </div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: "0.4rem", flex: 1 }}>
          <Link href="/admin" className="nav-link" style={{ padding: "0.6rem 0.75rem" }}>
            📊 Operations Dashboard
          </Link>
          <Link href="/admin/orders" className="nav-link" style={{ padding: "0.6rem 0.75rem" }}>
            📦 Orders &amp; Fulfillment
          </Link>
          <Link href="/admin/payments" className="nav-link" style={{ padding: "0.6rem 0.75rem" }}>
            💳 GCash Verification
          </Link>
          <Link href="/admin/catalog" className="nav-link" style={{ padding: "0.6rem 0.75rem" }}>
            🏷️ Catalog Overview
          </Link>
          <Link href="/admin/audit" className="nav-link" style={{ padding: "0.6rem 0.75rem" }}>
            🔒 Audit Logs
          </Link>
          {adminCtx.role === "super_admin" && (
            <Link href="/admin/users" className="nav-link" style={{ padding: "0.6rem 0.75rem" }}>
              👥 Staff &amp; Roles
            </Link>
          )}

          <div style={{ marginTop: "auto", borderTop: "1px solid var(--line)", paddingTop: "1rem" }}>
            <Link href="/" className="nav-link" style={{ padding: "0.6rem 0.75rem", color: "var(--accent-soft)" }}>
              &larr; Customer Storefront
            </Link>
          </div>
        </nav>
      </aside>

      <main style={{ flex: 1, overflowY: "auto", padding: "2rem var(--pad)" }}>{children}</main>
    </div>
  );
}
