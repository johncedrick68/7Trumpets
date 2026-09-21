"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserIcon } from "@/components/icons";
import { MobileNav } from "@/components/mobile-nav";
import { BrandLogo } from "@/components/brand-logo";

type FooterSettings = { brand_copy?: string; support_email?: string; location?: string };
type FooterCategory = { name: string; slug: string };

export function StorefrontChrome({ children, announcement, cartBadge, footer = {}, footerCategories = [] }: { children: React.ReactNode; announcement: React.ReactNode; cartBadge: React.ReactNode; footer?: FooterSettings; footerCategories?: FooterCategory[] }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return <>{children}</>;
  const isAuthRoute = ["/login", "/signup", "/forgot-password", "/update-password"].includes(pathname);
  const shopLinks = footerCategories.length > 0
    ? footerCategories.slice(0, 4)
    : [
        { name: "Current Drops", slug: "drops" },
        { name: "San Roque Collection", slug: "san-roque" },
        { name: "1968 Classics", slug: "classics" },
      ];

  return <>
    {!isAuthRoute && announcement}
    <header className="site-header"><div className="header-inner">
      <Link href="/" className="brand-logo min-h-11" aria-label="1968 Clothing — Home"><BrandLogo variant="header" priority /></Link>
      <nav className={isAuthRoute ? "primary-nav invisible" : "primary-nav"} aria-label="Main navigation"><Link href="/products" className="nav-link">Collection</Link><Link href="/#story" className="nav-link">Story</Link><Link href="/orders" className="nav-link">Orders</Link></nav>
      <div className="header-actions">{!isAuthRoute && <Link href="/account" className="icon-btn" aria-label="My Account" title="Account"><UserIcon size={18} /></Link>}{cartBadge}{!isAuthRoute && <MobileNav />}</div>
    </div></header>
    {children}
    <footer className="site-footer" id="footer">
      <div className="footer-container">
        <div className="footer-col"><div className="footer-logo"><BrandLogo variant="footer" /></div><p>{footer.brand_copy || "Independent Filipino streetwear · Est. 1968. Archival garments crafted for the daily journey."}</p></div>
        <div className="footer-col"><h4>Shop</h4><ul><li><Link href="/products">All products</Link></li>{shopLinks.map((category) => <li key={category.slug}><Link href={`/categories/${category.slug}`}>{category.name}</Link></li>)}</ul></div>
        <div className="footer-col"><h4>Account & Service</h4><ul><li><Link href="/orders">Track Order</Link></li><li><Link href="/account">Account Settings</Link></li><li><Link href="/account/addresses">Saved Addresses</Link></li></ul></div>
        <div className="footer-col"><h4>Contact</h4><ul><li><a href={`mailto:${footer.support_email || "1968clothing.official@gmail.com"}`}>{footer.support_email || "1968clothing.official@gmail.com"}</a></li><li><span className="text-[13px] text-[var(--ink-muted)]">{footer.location || "Manila, Philippines"}</span></li></ul></div>
      </div>
      <div className="footer-bottom"><p>© {new Date().getFullYear()} 1968 Clothing. All rights reserved.</p><p>Wear the legacy. Move the culture.</p></div>
    </footer>
  </>;
}
