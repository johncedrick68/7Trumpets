import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AccountSection = "profile" | "orders" | "addresses" | "security";

const items: Array<{ id: AccountSection; href: string; label: string }> = [
  { id: "profile", href: "/account", label: "Profile" },
  { id: "orders", href: "/orders", label: "Orders" },
  { id: "addresses", href: "/account/addresses", label: "Addresses" },
  { id: "security", href: "/update-password", label: "Password" },
];

export function AccountNavigation({ current }: { current: AccountSection }) {
  return (
    <nav className="mb-8 grid grid-cols-2 gap-1 rounded-lg bg-muted/50 p-1 sm:grid-cols-4" aria-label="Account navigation">
      {items.map((item) => {
        const active = current === item.id;
        return (
          <Button
            key={item.id}
            variant="ghost"
            size="sm"
            className={cn(
              "min-h-11 min-w-0 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
              active
                ? "bg-neutral-950 text-white hover:bg-neutral-900 hover:text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
            asChild
          >
            <Link href={item.href} aria-current={active ? "page" : undefined}>{item.label}</Link>
          </Button>
        );
      })}
    </nav>
  );
}
