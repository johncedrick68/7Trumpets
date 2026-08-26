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
    <div className="admin-container" style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <aside className="admin-sidebar" aria-label="Admin Navigation" style={{ width: "250px", background: "var(--bg-subtle)", borderRight: "1px solid var(--border)", padding: "1.5rem 1rem", display: "flex", flexDirection: "column" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <Link href="/admin" aria-label="1968 Operations Home">
            <Image
              src="/images/1968%20Clothing%20Logo%20transparent.webp"
              alt="1968 Clothing"
              width={120}
              height={30}
              style={{ height: "30px", width: "auto", objectFit: "contain", marginBottom: "0.75rem" }}
            />
          </Link>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--ink-muted)", overflow: "hidden", textOverflow: "ellipsis" }}>
              {adminCtx.email}
            </span>
            <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.25rem" }}>
              <span className="status-pill status-confirmed">
                {adminCtx.role === "super_admin" ? "SUPER ADMIN" : "ADMIN"}
              </span>
              {adminCtx.aal === "aal2" && (
                <span className="status-pill" style={{ background: "rgba(255, 255, 255, 0.08)", color: "var(--ink)" }}>
                  AAL2 MFA
                </span>
              )}
            </div>
          </div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 }}>
          <Link href="/admin" className="nav-link" style={{ padding: "0.5rem 0.6rem" }}>
            Overview
          </Link>
          <Link href="/admin/orders" className="nav-link" style={{ padding: "0.5rem 0.6rem" }}>
            Orders &amp; Fulfillment
          </Link>
          <Link href="/admin/payments" className="nav-link" style={{ padding: "0.5rem 0.6rem" }}>
            GCash Review
          </Link>
          <Link href="/admin/catalog" className="nav-link" style={{ padding: "0.5rem 0.6rem" }}>
            Catalog
          </Link>
          <Link href="/admin/audit" className="nav-link" style={{ padding: "0.5rem 0.6rem" }}>
            Audit Logs
          </Link>
          {adminCtx.role === "super_admin" && (
            <Link href="/admin/users" className="nav-link" style={{ padding: "0.5rem 0.6rem" }}>
              Staff &amp; Roles
            </Link>
          )}

          <div style={{ marginTop: "auto", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            <Link href="/" className="nav-link" style={{ padding: "0.5rem 0.6rem", color: "var(--ink)" }}>
              &larr; Storefront
            </Link>
          </div>
        </nav>
      </aside>

      <main style={{ flex: 1, overflowY: "auto", padding: "2rem var(--pad-page)" }}>{children}</main>
    </div>
  );
}
