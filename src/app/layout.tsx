import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "7Trumpets",
  description: "Faith-driven commerce platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <nav aria-label="Main Navigation" style={{ background: "#fffdf8", borderBottom: "1px solid var(--line)", padding: "0.75rem 1.5rem" }}>
          <div style={{ maxWidth: "72rem", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Link href="/" style={{ fontSize: "1.25rem", fontWeight: "900", color: "var(--ink)", textDecoration: "none" }}>
              7Trumpets
            </Link>
            <div style={{ display: "flex", gap: "1.25rem", alignItems: "center", fontSize: "0.95rem" }}>
              <Link href="/products" style={{ color: "var(--ink)", textDecoration: "none" }}>Shop</Link>
              <Link href="/cart" style={{ color: "var(--ink)", textDecoration: "none" }}>Cart</Link>
              <Link href="/orders" style={{ color: "var(--ink)", textDecoration: "none" }}>Orders</Link>
              <Link href="/account" style={{ color: "var(--ink)", textDecoration: "none" }}>Account</Link>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
