"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  CreditCard,
  RotateCcw,
  Box,
  Store,
  Users,
  MessageSquare,
  ShieldCheck,
  Settings,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  superAdminOnly?: boolean;
}

const navigationGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: "Commerce",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
      { href: "/admin/payments", label: "Payments", icon: CreditCard },
      { href: "/admin/returns", label: "Returns", icon: RotateCcw },
    ],
  },
  {
    label: "Merchandise",
    items: [
      { href: "/admin/catalog", label: "Catalog", icon: Box },
    ],
  },
  {
    label: "Retail",
    items: [
      { href: "/admin/pos", label: "Point of Sale", icon: Store },
    ],
  },
  {
    label: "Customers",
    items: [
      { href: "/admin/customers", label: "Customers", icon: Users },
      { href: "/admin/support", label: "Support", icon: MessageSquare },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin/users", label: "Staff & Roles", icon: UserCheck },
      { href: "/admin/audit", label: "Audit Log", icon: ShieldCheck },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

interface AdminSidebarProps {
  email: string;
  role: "cashier" | "admin" | "super_admin";
  aal: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  className?: string;
}

export function AdminSidebar({
  role,
  isCollapsed = false,
  onToggleCollapse,
  onNavigate,
  className,
}: AdminSidebarProps) {
  const pathname = usePathname();

  const isRouteActive = (href: string, exact = false) => {
    if (exact || href === "/admin") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-card transition-all duration-200 select-none",
        isCollapsed ? "w-20" : "w-64",
        className
      )}
      aria-label="Admin sidebar"
    >
      {/* Brand Logo Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
        <Link
          href="/admin"
          onClick={onNavigate}
          aria-label="1968 Operations Dashboard"
          className="inline-flex min-h-11 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {isCollapsed ? (
            <span className="font-mono text-sm font-black tracking-widest text-foreground">
              1968
            </span>
          ) : (
            <BrandLogo variant="admin" priority />
          )}
        </Link>

        {onToggleCollapse && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="size-8 text-muted-foreground hover:text-foreground hidden md:flex"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="size-4" aria-hidden="true" />
            ) : (
              <ChevronLeft className="size-4" aria-hidden="true" />
            )}
          </Button>
        )}
      </div>

      {/* Nav List */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Main Navigation">
        {navigationGroups.map((group) => {
          if (group.superAdminOnly && role !== "super_admin") {
            return null;
          }

          return (
            <div key={group.label} className="space-y-1">
              {!isCollapsed ? (
                <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {group.label}
                </p>
              ) : (
                <div className="my-2 border-t border-border/50" />
              )}

              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active = isRouteActive(item.href, item.exact);
                  const Icon = item.icon;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        title={isCollapsed ? item.label : undefined}
                        className={cn(
                          "group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active
                            ? "bg-foreground text-background shadow-xs font-semibold"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          isCollapsed && "justify-center px-0"
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4 shrink-0 transition-transform group-hover:scale-105",
                            active ? "text-background" : "text-muted-foreground group-hover:text-foreground"
                          )}
                          aria-hidden="true"
                        />
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Collapse Footer Toggle (Desktop) */}
      {onToggleCollapse && (
        <div className="hidden md:flex border-t border-border p-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className={cn(
              "w-full justify-start gap-2.5 text-xs text-muted-foreground hover:text-foreground",
              isCollapsed && "justify-center px-0"
            )}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="size-4" aria-hidden="true" />
            ) : (
              <>
                <ChevronLeft className="size-4" aria-hidden="true" />
                <span>Collapse menu</span>
              </>
            )}
          </Button>
        </div>
      )}
    </aside>
  );
}
