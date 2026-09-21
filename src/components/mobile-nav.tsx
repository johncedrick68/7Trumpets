"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";

const NAV_LINKS = [
  { href: "/products", label: "Shop / Collection" },
  { href: "/#story", label: "Story" },
  { href: "/orders", label: "Orders" },
  { href: "/account", label: "Account" },
  { href: "/cart", label: "Bag" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Body scroll lock + focus management on open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setTimeout(() => firstLinkRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Escape key closes + restores focus
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  function handleClose() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <>
      {/* Hamburger — shown in header, hidden on desktop */}
      <button
        ref={triggerRef}
        className="menu-toggle"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-nav-overlay"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

      {/* Full-screen overlay */}
      <div
        id="mobile-nav-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
        aria-hidden={!open}
        className={`mobile-nav-overlay${open ? " open" : ""}`}
      >
        {/* Overlay header: logo + close */}
        <div className="mobile-nav-overlay-header">
          <Link
            href="/"
            className="brand-logo"
            aria-label="1968 Clothing — Home"
            onClick={handleClose}
            tabIndex={open ? 0 : -1}
          >
            <BrandLogo variant="header-sm" className="invert-0" />
          </Link>

          <button
            type="button"
            onClick={handleClose}
            className="mobile-nav-close"
            aria-label="Close menu"
            tabIndex={open ? 0 : -1}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {/* Nav links */}
        <nav className="mobile-nav-inner" aria-label="Mobile navigation">
          {NAV_LINKS.map((link, idx) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/" &&
                link.href !== "/#story" &&
                !!pathname?.startsWith(link.href));

            return (
              <Link
                key={link.href}
                href={link.href}
                ref={idx === 0 ? firstLinkRef : undefined}
                className={`mobile-nav-link${isActive ? " active" : ""}`}
                onClick={handleClose}
                tabIndex={open ? 0 : -1}
                aria-current={isActive ? "page" : undefined}
              >
                <span>{link.label}</span>
                <span aria-hidden="true" className="mobile-nav-arrow">→</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="mobile-nav-footer">
          1968 Clothing · Manila, Philippines
        </div>
      </div>
    </>
  );
}
