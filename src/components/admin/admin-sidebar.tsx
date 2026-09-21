"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  Box,
  CreditCard,
  LayoutDashboard,
  RotateCcw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Users,
  MessageSquare,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = { email: string; role: "admin" | "super_admin"; aal: string; onNavigate?: () => void };

export function AdminSidebar({ email, role, aal, onNavigate }: Props) {
  const pathname = usePathname();

  const groups = [
    {
      label: "Workspace",
      items: [{ href: "/admin", label: "Overview", icon: LayoutDashboard }],
    },
    {
      label: "Sales",
      items: [
        { href: "/admin/pos", label: "Point of sale", icon: Store },
        { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
        { href: "/admin/payments", label: "Payments", icon: CreditCard },
        { href: "/admin/returns", label: "Returns", icon: RotateCcw },
      ],
    },
    {
      label: "Customers",
      items: [
        { href: "/admin/customers", label: "Customers", icon: Users },
        { href: "/admin/support", label: "Support inbox", icon: MessageSquare },
      ],
    },
    {
      label: "Merchandise",
      items: [{ href: "/admin/catalog", label: "Catalog", icon: Box }],
    },
    {
      label: "System",
      items: [
        { href: "/admin/settings", label: "Settings", icon: Settings },
        { href: "/admin/settings/ai", label: "AI & Automation", icon: Sparkles },
        { href: "/admin/audit", label: "Audit log", icon: ShieldCheck },
      ],
    },
  ];

  const isActive = (href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));
  const itemClass = (active: boolean) =>
    cn(
      "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
      active && "bg-foreground text-background shadow-sm hover:bg-foreground hover:text-background"
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Admin navigation">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={itemClass(active)}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {role === "super_admin" && (
          <div>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Governance
            </p>
            <Link
              href="/admin/users"
              onClick={onNavigate}
              aria-current={isActive("/admin/users") ? "page" : undefined}
              className={itemClass(isActive("/admin/users"))}
            >
              <UserCheck className="size-4" aria-hidden="true" />
              <span>Staff & Roles</span>
            </Link>
          </div>
        )}
      </nav>

      <div className="border-t p-3">
        <Link
          href="/"
          onClick={onNavigate}
          className="mb-3 flex min-h-11 items-center justify-between rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>View storefront</span>
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
        <div className="rounded-xl border bg-muted/30 p-3">
          <p className="truncate text-sm font-medium" title={email}>
            {email}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
              {role === "super_admin" ? "Super admin" : "Admin"}
            </Badge>
            {aal === "aal2" && <Badge variant="outline" className="text-[10px]">MFA verified</Badge>}
          </div>
        </div>
      </div>
    </div>
  );
}
