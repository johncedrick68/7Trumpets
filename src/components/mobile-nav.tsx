"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
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

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          className="menu-toggle"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          type="button"
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[200] bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[201] flex flex-col bg-[#0a0a0a] text-white overflow-y-auto outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">
            Navigation Menu
          </DialogPrimitive.Title>

          {/* Overlay header: logo + close */}
          <div className="mobile-nav-overlay-header">
            <Link
              href="/"
              className="brand-logo"
              aria-label="1968 Clothing — Home"
              onClick={() => setOpen(false)}
            >
              <BrandLogo variant="header-sm" className="invert-0" />
            </Link>

            <DialogPrimitive.Close
              type="button"
              className="mobile-nav-close"
              aria-label="Close navigation menu"
            >
              <span aria-hidden="true">✕</span>
            </DialogPrimitive.Close>
          </div>

          {/* Mobile search form */}
          <div className="mobile-nav-search-container">
            <form
              method="GET"
              action="/products"
              className="mobile-nav-search-form"
              onSubmit={() => setOpen(false)}
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
                  onClick={() => setOpen(false)}
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
            1968 Clothing
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
