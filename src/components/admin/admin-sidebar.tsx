"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Box, CreditCard, LayoutDashboard, ShieldCheck, ShoppingBag, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AdminSidebarProps = { email: string; role: "admin" | "super_admin"; aal: string };

const items = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/catalog", label: "Catalog", icon: Box },
  { href: "/admin/audit", label: "Audit", icon: ShieldCheck },
] as const;

export function AdminSidebar({ email, role, aal }: AdminSidebarProps) {
  const pathname = usePathname();
  const isActive = (href: string) => href === "/admin" ? pathname === href : pathname.startsWith(href);
  const navButtonClass = (active: boolean) => cn(
    "h-11 shrink-0 justify-start gap-3 whitespace-nowrap px-3",
    active && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
  );

  return (
    <>
      <div className="mb-5 space-y-2 rounded-lg border border-border bg-muted/30 p-3 md:mb-8 md:p-4">
        <p className="truncate font-mono text-xs font-medium text-foreground/80" title={email}>{email}</p>
        <div className="flex flex-wrap gap-2">
          <Badge variant={role === "super_admin" ? "default" : "secondary"} className="font-mono text-[10px] tracking-widest">{role === "super_admin" ? "SUPER ADMIN" : "ADMIN"}</Badge>
          {aal === "aal2" && <Badge variant="outline" className="border-primary/20 font-mono text-[10px] text-primary">MFA verified</Badge>}
        </div>
      </div>
      <nav className="flex flex-1 gap-2 overflow-x-auto pb-2 md:flex-col md:overflow-visible md:pb-0" aria-label="Admin navigation">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return <Button key={href} variant={active ? "secondary" : "ghost"} className={navButtonClass(active)} asChild>
            <Link href={href} aria-current={active ? "page" : undefined}><Icon size={16} aria-hidden="true" className={active ? "" : "text-muted-foreground"} /><span>{label}</span></Link>
          </Button>;
        })}
        {role === "super_admin" && (() => {
          const active = isActive("/admin/users");
          return <Button variant={active ? "secondary" : "ghost"} className={navButtonClass(active)} asChild>
            <Link href="/admin/users" aria-current={active ? "page" : undefined}><Users size={16} aria-hidden="true" className={active ? "" : "text-muted-foreground"} /><span>Staff</span></Link>
          </Button>;
        })()}
        <div className="hidden w-full bg-border md:my-4 md:block md:h-px" />
        <Button variant="outline" className="h-11 shrink-0 justify-start gap-3 whitespace-nowrap px-3 shadow-sm md:mt-auto" asChild>
          <Link href="/"><ArrowLeft size={16} aria-hidden="true" className="text-muted-foreground" /><span>Storefront</span></Link>
        </Button>
      </nav>
    </>
  );
}
