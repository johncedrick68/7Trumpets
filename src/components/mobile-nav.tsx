"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { SearchIcon } from "@/components/icons";

const NAV_LINKS = [
  { href: "/products", label: "Shop" },
  { href: "/size-guide", label: "Size Guide" },
  { href: "/#story", label: "Story" },
  { href: "/orders", label: "Track Order" },
  { href: "/account", label: "Account" },
  { href: "/cart", label: "Bag" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Body scroll lock + focus management on open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      // Focus the close button or first interactive element
      const timer = setTimeout(() => {
        firstFocusableRef.current?.focus();
      }, 50);
      return () => {
        clearTimeout(timer);
        document.body.style.overflow = "";
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [open]);

  // Trap focus & Escape key inside the open modal
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
        return;
      }

      if (e.key === "Tab" && overlayRef.current) {
        const focusableElements = overlayRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleClose]);

  return (
    <>
      {/* Hamburger — shown in header, hidden on desktop */}
      <button
        ref={triggerRef}
        className="menu-toggle"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
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
        ref={overlayRef}
        id="mobile-nav-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation Menu"
        className={`mobile-nav-overlay${open ? " open" : ""}`}
      >
        {/* Overlay header: logo + close */}
        <div className="mobile-nav-overlay-header">
          <Link
            href="/"
            className="brand-logo"
            aria-label="1968 Clothing — Home"
            onClick={handleClose}
          >
            <BrandLogo variant="header-sm" className="invert-0" />
          </Link>

          <button
            ref={firstFocusableRef}
            type="button"
            onClick={handleClose}
            className="mobile-nav-close"
            aria-label="Close navigation menu"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {/* Mobile search form */}
        <div className="mobile-nav-search-container">
          <form
            method="GET"
            action="/products"
            className="mobile-nav-search-form"
            onSubmit={handleClose}
            role="search"
          >
            <label htmlFor="mobile-search-input" className="sr-only">
              Search products
            </label>
            <div className="mobile-nav-search-wrap">
              <SearchIcon size={16} className="mobile-nav-search-icon" aria-hidden="true" />
              <input
                id="mobile-search-input"
                type="search"
                name="q"
                placeholder="Search products, collections…"
                autoComplete="off"
                enterKeyHint="search"
                className="mobile-nav-search-input"
              />
              <button type="submit" className="mobile-nav-search-btn">
                Search
              </button>
            </div>
          </form>
        </div>

        {/* Nav links */}
        <nav className="mobile-nav-inner" aria-label="Mobile primary navigation">
          {NAV_LINKS.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/" &&
                link.href !== "/#story" &&
                !!pathname?.startsWith(link.href));

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`mobile-nav-link${isActive ? " active" : ""}`}
                onClick={handleClose}
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
