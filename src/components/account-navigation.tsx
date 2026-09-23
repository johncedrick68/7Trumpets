import Link from "next/link";

import { cn } from "@/lib/utils";

export type AccountSection = "profile" | "orders" | "addresses" | "support" | "security";

const items: Array<{ id: AccountSection; href: string; label: string }> = [
  { id: "profile", href: "/account", label: "Profile" },
  { id: "orders", href: "/orders", label: "Orders" },
  { id: "addresses", href: "/account/addresses", label: "Addresses" },
  { id: "support", href: "/account/support", label: "Support" },
  { id: "security", href: "/update-password", label: "Password" },
];

export function AccountNavigation({ current }: { current: AccountSection }) {
  return (
    <nav className="account-tabs" aria-label="Account navigation">
      {items.map((item) => {
        const active = current === item.id;
        return (
          <Link
            key={item.id}
            className={cn(
              "account-tab",
              active && "account-tab-active"
            )}
            href={item.href}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
