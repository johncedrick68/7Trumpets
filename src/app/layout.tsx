import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";
import { BagIcon, UserIcon } from "@/components/icons";
import { MobileNav } from "@/components/mobile-nav";

export const metadata: Metadata = {
  title: {
    default: "1968 Clothing — Filipino Streetwear",
    template: "%s | 1968 Clothing",
  },
  description:
    "Independent Filipino streetwear · Est. 1968. Archival pieces shaped by community, heritage, and the streets.",
  applicationName: "1968 Clothing",
  keywords: ["streetwear", "Filipino fashion", "1968 clothing", "Manila"],
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
        {/* Editorial Announcement Strip */}
        <div className="announcement-bar" role="banner">
          <span>Drop 01 — Archive Collection · Free delivery on orders ₱1,500+</span>
        </div>

        {/* ─── Site Header ─────────────────────────────────────── */}
        <header className="site-header">
          <div className="header-inner">
            {/* Logo */}
            <Link href="/" className="brand-logo" aria-label="1968 Clothing — Home">
              <Image
                src="/images/1968%20Clothing%20Logo%20transparent.webp"
                alt="1968 Clothing"
                width={125}
                height={28}
                priority
                style={{ height: "28px", width: "auto", objectFit: "contain" }}
              />
            </Link>

            {/* Desktop center nav */}
            <nav className="primary-nav" aria-label="Main navigation">
              <Link href="/products" className="nav-link">Collection</Link>
              <Link href="/#story" className="nav-link">Story</Link>
              <Link href="/orders" className="nav-link">Orders</Link>
            </nav>

            {/* Right actions */}
            <div className="header-actions">
              <Link
                href="/account"
                className="icon-btn"
                aria-label="My Account"
                title="Account"
              >
                <UserIcon size={18} />
              </Link>

              <Link
                href="/cart"
                className="bag-btn"
                aria-label="Shopping Bag"
              >
                <BagIcon size={15} />
                <span>Bag</span>
                <span className="bag-count" aria-label="0 items">0</span>
              </Link>

              {/* Mobile hamburger — client component */}
              <MobileNav />
            </div>
          </div>
        </header>

        {/* Page content */}
        {children}

        {/* ─── Footer ──────────────────────────────────────────── */}
        <footer className="site-footer" id="footer">
          <div className="footer-container">
            {/* Brand column */}
            <div className="footer-col">
              <div className="footer-logo">
                <Image
                  src="/images/1968%20Clothing%20Logo%20transparent.webp"
                  alt="1968 Clothing"
                  width={110}
                  height={26}
                  style={{ height: "26px", width: "auto", objectFit: "contain" }}
                />
              </div>
              <p>
                Independent Filipino streetwear · Est. 1968. Archival garments crafted to be worn, built for the daily journey.
              </p>
            </div>

            {/* Collection */}
            <div className="footer-col">
              <h4>Collection</h4>
              <ul>
                <li><Link href="/products">All Drops</Link></li>
                <li><Link href="/categories/drops">Current Releases</Link></li>
                <li><Link href="/categories/san-roque">San Roque Edition</Link></li>
                <li><Link href="/categories/classics">Classics</Link></li>
              </ul>
            </div>

            {/* Account & Service */}
            <div className="footer-col">
              <h4>Account & Service</h4>
              <ul>
                <li><Link href="/orders">Track Order</Link></li>
                <li><Link href="/account">Account Settings</Link></li>
                <li><Link href="/account/addresses">Saved Addresses</Link></li>
                <li><Link href="/admin">Operations Portal</Link></li>
              </ul>
            </div>

            {/* Contact */}
            <div className="footer-col">
              <h4>Contact</h4>
              <ul>
                <li>
                  <a href="mailto:1968clothing.official@gmail.com">
                    1968clothing.official@gmail.com
                  </a>
                </li>
                <li>
                  <span style={{ fontSize: "13px", color: "var(--ink-muted)" }}>
                    Manila, Philippines
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom">
            <p>© {new Date().getFullYear()} 1968 Clothing. All rights reserved.</p>
            <p>Wear the legacy. Move the culture.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
