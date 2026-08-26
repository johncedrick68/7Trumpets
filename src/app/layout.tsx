import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";
import { BagIcon, UserIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: {
    default: "1968 Clothing — Filipino Streetwear",
    template: "%s | 1968 Clothing",
  },
  description: "Independent Filipino streetwear · Est. 1968. Archival pieces shaped by community, heritage, and the streets.",
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
        {/* Editorial Top Announcement */}
        <div className="announcement-bar">
          <span>1968 Clothing · Drop 01 / Archive Collection</span>
        </div>

        <header className="site-header">
          <Link href="/" className="brand-logo" aria-label="1968 Clothing Home">
            <Image
              src="/images/1968%20Clothing%20Logo%20transparent.webp"
              alt="1968 Clothing"
              width={130}
              height={32}
              priority
              style={{ height: "32px", width: "auto", objectFit: "contain" }}
            />
          </Link>

          <nav className="primary-nav" aria-label="Main Navigation">
            <Link href="/products" className="nav-link">
              Collection
            </Link>
            <Link href="/#story" className="nav-link">
              Story
            </Link>
            <Link href="/orders" className="nav-link">
              Orders
            </Link>
          </nav>

          <div className="header-actions">
            <Link href="/account" className="nav-link" aria-label="Account Profile" style={{ minHeight: "40px" }}>
              <UserIcon size={16} />
              <span>Account</span>
            </Link>

            <Link href="/cart" className="bag-btn" aria-label="Shopping Bag">
              <BagIcon size={16} />
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
                  width={110}
                  height={28}
                  style={{ height: "28px", width: "auto", objectFit: "contain" }}
                />
              </div>
              <p style={{ maxWidth: "260px", lineHeight: 1.6, color: "var(--ink-muted)", fontSize: "13px" }}>
                Independent Filipino streetwear · Est. 1968. Archival garments crafted to be worn.
              </p>
            </div>

            <div className="footer-col">
              <h4>Collection</h4>
              <ul>
                <li><Link href="/products">All Drops</Link></li>
                <li><Link href="/categories/drops">Current Releases</Link></li>
                <li><Link href="/categories/san-roque">San Roque Edition</Link></li>
                <li><Link href="/categories/classics">Classics</Link></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Account &amp; Service</h4>
              <ul>
                <li><Link href="/orders">Track Order</Link></li>
                <li><Link href="/account">Account Settings</Link></li>
                <li><Link href="/account/addresses">Saved Addresses</Link></li>
                <li><Link href="/admin">Operations Portal</Link></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Direct Contact</h4>
              <p style={{ color: "var(--ink-secondary)", marginBottom: "0.4rem", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                Manila, Philippines
              </p>
              <p style={{ color: "var(--ink-muted)", fontSize: "12px" }}>
                1968clothing.official@gmail.com
              </p>
            </div>
          </div>

          <div className="footer-container footer-bottom">
            <div>&copy; {new Date().getFullYear()} 1968 Clothing. All rights reserved.</div>
            <div style={{ letterSpacing: "0.08em" }}>WEAR THE LEGACY. MOVE THE CULTURE.</div>
          </div>
        </footer>
      </body>
    </html>
  );
}
