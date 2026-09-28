"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShieldCheck, LogOut, ChevronRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { StatusBadge } from "@/components/admin/status-badge";

interface AdminHeaderProps {
  email: string;
  role: "cashier" | "admin" | "super_admin";
  aal: string;
  onOpenMobileNav?: () => void;
}

const routeMap: Record<string, { title: string; category: string }> = {
  "/admin": { title: "Overview", category: "Workspace" },
  "/admin/orders": { title: "Orders", category: "Commerce" },
  "/admin/payments": { title: "Payments", category: "Commerce" },
  "/admin/returns": { title: "Returns", category: "Commerce" },
  "/admin/catalog": { title: "Catalog", category: "Merchandise" },
  "/admin/inventory": { title: "Inventory", category: "Merchandise" },
  "/admin/pos": { title: "Point of Sale", category: "Retail" },
  "/admin/customers": { title: "Customers", category: "Customers" },
  "/admin/support": { title: "Support Inbox", category: "Customers" },
  "/admin/users": { title: "Staff & Roles", category: "Administration" },
  "/admin/audit": { title: "Audit Log", category: "Administration" },
  "/admin/settings": { title: "Settings", category: "Administration" },
};

function getRouteContext(pathname: string) {
  const matchingKey = Object.keys(routeMap)
    .sort((a, b) => b.length - a.length)
    .find((key) => (key === "/admin" ? pathname === key : pathname.startsWith(key)));

  return matchingKey ? routeMap[matchingKey] : { title: "Operations", category: "Admin" };
}

export function AdminHeader({
  email,
  role,
  aal,
  onOpenMobileNav,
}: AdminHeaderProps) {
  const pathname = usePathname();
  const { title, category } = getRouteContext(pathname);

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-border bg-background/95 px-4 sm:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* Left: Mobile Toggle + Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenMobileNav}
          className="size-10 md:hidden shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" aria-hidden="true" />
        </Button>

        {/* TailAdmin Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="min-w-0 flex items-center gap-1.5 text-xs">
          <Link
            href="/admin"
            className="text-muted-foreground hover:text-foreground font-medium transition-colors hidden sm:inline"
          >
            1968
          </Link>
          <ChevronRight className="size-3 text-muted-foreground shrink-0 hidden sm:inline" aria-hidden="true" />
          <span className="text-muted-foreground font-medium truncate hidden md:inline">
            {category}
          </span>
          <ChevronRight className="size-3 text-muted-foreground shrink-0 hidden md:inline" aria-hidden="true" />
          <span className="font-semibold text-foreground truncate">
            {title}
          </span>
        </nav>
      </div>

      {/* Right: Security Badge, User Profile & Actions */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {/* AAL2 Assurance Status */}
        {aal === "aal2" ? (
          <div className="hidden lg:flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            <span>AAL2 Verified</span>
          </div>
        ) : (
          <div className="hidden lg:flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
            <span>AAL1 Session</span>
          </div>
        )}

        {/* Staff Identity */}
        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <div className="size-8 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground shrink-0">
            <User className="size-4" aria-hidden="true" />
          </div>
          <div className="hidden xl:flex flex-col text-left">
            <span className="text-xs font-semibold text-foreground truncate max-w-[140px]">
              {email}
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
              {role.replace("_", " ")}
            </span>
          </div>
          <StatusBadge
            variant={role === "super_admin" ? "info" : "neutral"}
            dot={false}
            className="hidden sm:inline-flex text-[10px] py-0 px-2 uppercase font-bold"
          >
            {role.replace("_", " ")}
          </StatusBadge>
        </div>

        {/* Sign Out Button */}
        <form action={signOut}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="h-9 px-2 sm:px-3 text-xs text-muted-foreground hover:text-foreground gap-1.5"
            aria-label="Sign out"
          >
            <LogOut className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
