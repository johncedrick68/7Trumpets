import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";
import { BagIcon, UserIcon, ShieldCheckIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: {
    default: "1968 Clothing — Filipino Streetwear",
    template: "%s | 1968 Clothing",
  },
  description: "Independent Filipino streetwear · Est. 1968. Limited-run pieces shaped by community, history, and the streets.",
  applicationName: "1968 Clothing",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {/* Top Announcement Bar */}
        <div style={{ background: "linear-gradient(90deg, #12101e 0%, #201a3c 50%, #12101e 100%)", color: "var(--accent-soft)", fontSize: "0.78rem", fontWeight: 600, textAlign: "center", padding: "0.45rem 1rem", borderBottom: "1px solid rgba(200, 196, 255, 0.15)", letterSpacing: "0.04em" }}>
          <span>⚡ DROP 01 LIVE · Authentic Filipino Streetwear · Nationwide Cash on Delivery &amp; Manual GCash</span>
        </div>

        <header className="site-header">
          <Link href="/" className="brand-logo" aria-label="1968 Clothing Home">
            <Image
              src="/images/1968%20Clothing%20Logo%20transparent.webp"
              alt="1968 Clothing"
              width={140}
              height={38}
              priority
              style={{ height: "38px", width: "auto", objectFit: "contain" }}
            />
          </Link>

          <nav className="primary-nav" aria-label="Main Navigation">
            <Link href="/products" className="nav-link">
              Collection
            </Link>
            <Link href="/#story" className="nav-link">
              Our Story
            </Link>
            <Link href="/orders" className="nav-link">
              Track Order
            </Link>
          </nav>

          <div className="header-actions">
            <Link href="/account" className="nav-link" aria-label="Account Profile" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
              <UserIcon size={18} />
              <span>Account</span>
            </Link>

            <Link href="/cart" className="bag-btn" aria-label="Shopping Bag">
              <BagIcon size={18} />
              <span>Bag</span>
              <span className="bag-count">0</span>
            </Link>
          </div>
        </header>

        {children}

        <footer className="site-footer" id="footer">
          <div className="footer-container">
            <div className="footer-col">
              <div className="footer-logo">
                <Image
                  src="/images/1968%20Clothing%20Logo%20transparent.webp"
                  alt="1968 Clothing"
                  width={120}
                  height={32}
                  style={{ height: "32px", width: "auto", objectFit: "contain" }}
                />
              </div>
              <p style={{ maxWidth: "280px", margin: "0 0 1rem" }}>
                Independent Filipino streetwear · Est. 1968. Limited releases, made to be worn.
              </p>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", color: "var(--accent-soft)", fontSize: "0.8rem", background: "var(--surface)", padding: "0.3rem 0.6rem", borderRadius: "var(--radius-sm)" }}>
                <ShieldCheckIcon size={16} />
                <span>100% Genuine Merchandise</span>
              </div>
            </div>

            <div className="footer-col">
              <h4>Explore</h4>
              <ul>
                <li><Link href="/products">All Products</Link></li>
                <li><Link href="/#story">Our Legacy &amp; Story</Link></li>
                <li><Link href="/orders">Order History &amp; Tracking</Link></li>
                <li><Link href="/account/addresses">Saved Addresses</Link></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Operations &amp; Security</h4>
              <ul>
                <li><Link href="/admin">Staff Operations</Link></li>
                <li><Link href="/login">Customer Sign In</Link></li>
                <li><Link href="/signup">Create Account</Link></li>
                <li><span>GCash &amp; Doorstep COD</span></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Community &amp; Support</h4>
              <p style={{ margin: "0 0 0.5rem" }}>Direct community support.</p>
              <p style={{ color: "var(--accent-soft)", fontWeight: 600, margin: "0 0 0.5rem" }}>
                Philippines · Worldwide Delivery
              </p>
              <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: 0 }}>
                Support: 1968clothing.official@gmail.com
              </p>
            </div>
          </div>

          <div className="footer-container footer-bottom">
            <div>&copy; {new Date().getFullYear()} 1968 Clothing. All rights reserved.</div>
            <div>Wear the legacy. Move the culture.</div>
          </div>
        </footer>
      </body>
    </html>
  );
}
