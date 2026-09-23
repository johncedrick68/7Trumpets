"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserIcon, SearchIcon } from "@/components/icons";
import { MobileNav } from "@/components/mobile-nav";
import { BrandLogo } from "@/components/brand-logo";
import { PredictiveSearch } from "@/components/predictive-search";

type FooterSettings = { brand_copy?: string; support_email?: string; location?: string };
type FooterCategory = { name: string; slug: string };

export function StorefrontChrome({
  children,
  announcement,
  cartBadge,
  footer = {},
  footerCategories = [],
}: {
  children: React.ReactNode;
  announcement: React.ReactNode;
  cartBadge: React.ReactNode;
  footer?: FooterSettings;
  footerCategories?: FooterCategory[];
}) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);

  // Close search drawer on route changes
  useEffect(() => {
    setSearchOpen(false);
  }, [pathname]);

  // Focus input when search opens
  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  // Escape key closes search drawer and restores focus
  useEffect(() => {
    if (!searchOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchOpen(false);
        searchTriggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen]);

  if (pathname.startsWith("/admin")) return <>{children}</>;
  const isAuthRoute = ["/login", "/signup", "/forgot-password", "/update-password"].includes(pathname);
  const shopLinks =
    footerCategories.length > 0
      ? footerCategories.slice(0, 3)
      : [
          { name: "Current Drops", slug: "drops" },
          { name: "San Roque Collection", slug: "san-roque" },
          { name: "1968 Classics", slug: "classics" },
        ];

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {!isAuthRoute && announcement}

      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="brand-logo min-h-11" aria-label="1968 Clothing — Home">
            <BrandLogo variant="header" priority />
          </Link>

          <nav className={isAuthRoute ? "primary-nav invisible" : "primary-nav"} aria-label="Primary">
            <Link
              href="/products"
              className={`nav-link${pathname === "/products" ? " active" : ""}`}
              aria-current={pathname === "/products" ? "page" : undefined}
            >
              Shop
            </Link>
            <Link
              href="/size-guide"
              className={`nav-link${pathname === "/size-guide" ? " active" : ""}`}
              aria-current={pathname === "/size-guide" ? "page" : undefined}
            >
              Size Guide
            </Link>
            <Link href="/#story" className="nav-link">
              Story
            </Link>
            <Link
              href="/orders"
              className={`nav-link${pathname === "/orders" ? " active" : ""}`}
              aria-current={pathname === "/orders" ? "page" : undefined}
            >
              Track Order
            </Link>
          </nav>

          <div className="header-actions">
            {!isAuthRoute && (
              <button
                ref={searchTriggerRef}
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                className="icon-btn min-h-11 min-w-11"
                aria-label={searchOpen ? "Close search" : "Search products"}
                aria-expanded={searchOpen}
                aria-controls="header-search-drawer"
                title="Search"
              >
                <SearchIcon size={18} aria-hidden="true" />
              </button>
            )}

            {!isAuthRoute && <Link href="/account" className="icon-btn min-h-11 min-w-11" aria-label="Account" title="Account">
              <UserIcon size={18} aria-hidden="true" />
            </Link>}

            {cartBadge}

            {!isAuthRoute && <MobileNav />}
          </div>
        </div>

        {/* ── Expandable Search Bar Shell ─────────────────────────── */}
        {!isAuthRoute && searchOpen && (
          <div id="header-search-drawer" className="header-search-drawer" role="region" aria-label="Product search">
            <PredictiveSearch
              inputRef={searchInputRef}
              onClose={() => {
                setSearchOpen(false);
                searchTriggerRef.current?.focus();
              }}
            />
          </div>
        )}
      </header>

      {children}

      <footer className="site-footer" id="footer">
        <div className="footer-container">
          <div className="footer-col">
            <div className="footer-logo">
              <BrandLogo variant="footer" />
            </div>
            <p>{footer.brand_copy || "Independent clothing made for everyday wear."}</p>
          </div>

          <div className="footer-col">
            <nav aria-label="Shop">
              <span className="footer-nav-heading">Shop</span>
              <ul>
                <li><Link href="/products">All Products</Link></li>
                {shopLinks.map((category) => (
                  <li key={category.slug}>
                    <Link href={`/categories/${category.slug}`}>{category.name}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="footer-col">
            <nav aria-label="Customer Care">
              <span className="footer-nav-heading">Customer Care</span>
              <ul>
                <li><Link href="/size-guide">Size Guide</Link></li>
                <li><Link href="/orders">Track Order</Link></li>
                <li><Link href="/account">Account Settings</Link></li>
              </ul>
            </nav>
          </div>

          <div className="footer-col">
            <span className="footer-nav-heading">Contact</span>
            <ul>
              <li>
                <a href={`mailto:${footer.support_email || "1968clothing.official@gmail.com"}`}>
                  {footer.support_email || "1968clothing.official@gmail.com"}
                </a>
              </li>
              {footer.location ? (
                <li>
                  <span className="text-[13px] text-[var(--ink-secondary)]">
                    {footer.location}
                  </span>
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} 1968 Clothing. All rights reserved.</p>
          <p>Independent clothing for everyday wear.</p>
        </div>
      </footer>
    </>
  );
}
