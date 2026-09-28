"use client";

import * as React from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

interface AdminShellProps {
  children: React.ReactNode;
  email: string;
  role: "cashier" | "admin" | "super_admin";
  aal: string;
}

export function AdminShell({ children, email, role, aal }: AdminShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  return (
    <div className="min-h-screen bg-muted/20 text-foreground flex">
      {/* Desktop Fixed Sidebar */}
      <div className="hidden md:flex shrink-0">
        <AdminSidebar
          email={email}
          role={role}
          aal={aal}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          className={cn(
            "fixed inset-y-0 left-0 z-30",
            sidebarCollapsed ? "w-20" : "w-64"
          )}
        />
      </div>

      {/* Mobile Drawer (Accessible Sheet with Focus Trap & Escape) */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[min(85vw,18rem)] p-0 gap-0" showCloseButton={false}>
          <SheetHeader className="flex h-16 shrink-0 flex-row items-center border-b border-border px-5 py-0">
            <SheetTitle className="sr-only">Operations Navigation</SheetTitle>
            <SheetDescription className="sr-only">
              Navigate 1968 administration workspaces.
            </SheetDescription>
            <div className="flex items-center">
              <BrandLogo variant="admin" priority />
            </div>
          </SheetHeader>
          <AdminSidebar
            email={email}
            role={role}
            aal={aal}
            isCollapsed={false}
            onNavigate={() => setMobileNavOpen(false)}
            className="w-full border-r-0 h-[calc(100vh-4rem)]"
          />
        </SheetContent>
      </Sheet>

      {/* Main Layout Area */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 transition-all duration-200",
          sidebarCollapsed ? "md:pl-20" : "md:pl-64"
        )}
      >
        {/* Unified Topbar */}
        <AdminHeader
          email={email}
          role={role}
          aal={aal}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />

        {/* Content Container */}
        <main id="main-admin-content" tabIndex={-1} className="flex-1 outline-none">
          <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 xl:p-10 space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
