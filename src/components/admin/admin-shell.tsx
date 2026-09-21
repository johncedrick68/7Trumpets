"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useState } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BrandLogo } from "@/components/brand-logo";
import { Ask1968Modal } from "@/components/admin/ask-1968-modal";

type Props = { children: React.ReactNode; email: string; role: "admin" | "super_admin"; aal: string };

const routeNames: Record<string, string> = {
  "/admin": "Overview",
  "/admin/pos": "Point of sale",
  "/admin/orders": "Orders",
  "/admin/payments": "Payments",
  "/admin/returns": "Returns",
  "/admin/customers": "Customers",
  "/admin/support": "Support inbox",
  "/admin/catalog": "Catalog",
  "/admin/settings/ai": "AI & Automation",
  "/admin/settings": "Settings",
  "/admin/audit": "Audit log",
  "/admin/users": "Staff & Roles",
};

function currentRouteName(pathname: string) {
  const route = Object.keys(routeNames)
    .sort((a, b) => b.length - a.length)
    .find((item) => (item === "/admin" ? pathname === item : pathname.startsWith(item)));
  return route ? routeNames[route] : "Operations";
}

function Brand() {
  return (
    <Link
      href="/admin"
      aria-label="1968 Clothing operations home"
      className="inline-flex min-h-11 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <BrandLogo variant="admin" priority />
    </Link>
  );
}

export function AdminShell({ children, email, role, aal }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-background md:flex">
        <div className="flex h-16 shrink-0 items-center border-b px-6">
          <Brand />
        </div>
        <AdminSidebar email={email} role={role} aal={aal} />
      </aside>

      {/* Mobile Top Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="size-11" aria-label="Open admin navigation">
              <Menu className="size-5" aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[min(88vw,20rem)] gap-0 p-0" showCloseButton={false}>
            <SheetHeader className="flex h-16 shrink-0 flex-row items-center border-b px-5 py-0">
              <SheetTitle className="sr-only">Admin navigation</SheetTitle>
              <SheetDescription className="sr-only">Navigate the 1968 Clothing operations workspace.</SheetDescription>
              <Brand />
            </SheetHeader>
            <AdminSidebar email={email} role={role} aal={aal} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Operations</p>
          <p className="truncate text-sm font-semibold">{currentRouteName(pathname)}</p>
        </div>
        <div className="ml-auto">
          <Ask1968Modal />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="min-w-0 md:pl-64">
        {/* Desktop Top Header Bar with Ask 1968 */}
        <header className="hidden md:flex h-16 items-center justify-between border-b bg-background/95 px-8 backdrop-blur sticky top-0 z-20">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Operations Workspace</p>
            <p className="text-sm font-bold tracking-tight text-foreground">{currentRouteName(pathname)}</p>
          </div>
          <div className="flex items-center gap-3">
            <Ask1968Modal />
          </div>
        </header>

        <main>
          <div className="admin-shell-container p-4 sm:p-6 lg:p-8 xl:p-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
