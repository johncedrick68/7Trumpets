"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/products", label: "Collection" },
  { href: "/#story", label: "Story" },
  { href: "/orders", label: "Orders" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
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

      <div
        id="mobile-nav-overlay"
        className={`mobile-nav-overlay${open ? " open" : ""}`}
        aria-hidden={!open}
        role="dialog"
        aria-label="Site navigation"
      >
        <nav className="mobile-nav-inner" aria-label="Mobile navigation">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="mobile-nav-link"
              onClick={() => setOpen(false)}
            >
              <span>{link.label}</span>
              <span aria-hidden="true" style={{ fontSize: "20px", opacity: 0.3 }}>→</span>
            </Link>
          ))}
        </nav>
        <div className="mobile-nav-footer">
          1968 Clothing · Manila, Philippines
        </div>
      </div>
    </>
  );
}
