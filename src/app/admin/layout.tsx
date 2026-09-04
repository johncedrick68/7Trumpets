import Link from "next/link";
import Image from "next/image";

import { requireAdminAal2 } from "@/lib/admin/auth";
import { Badge } from "@/components/ui/badge";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const adminCtx = await requireAdminAal2("/admin");

  return (
    <div className="flex min-h-screen flex-col bg-muted/10 md:flex-row">
      <aside className="z-10 flex w-full shrink-0 flex-col border-b border-border bg-background p-4 md:sticky md:top-0 md:h-screen md:w-64 md:overflow-y-auto md:border-r md:border-b-0 md:p-6">
        <div className="mb-5 flex items-center justify-between md:mb-8 md:justify-start">
          <Link href="/admin" aria-label="1968 Clothing Operations Portal" className="transition-opacity hover:opacity-80">
            <Image src="/images/1968%20Clothing%20Logo%20transparent.webp" alt="1968 Clothing" width={120} height={28} priority className="h-7 w-auto object-contain dark:invert" />
          </Link>
          <Badge variant="outline" className="font-mono text-[10px] md:hidden">ADMIN</Badge>
        </div>
        <AdminSidebar email={adminCtx.email} role={adminCtx.role} aal={adminCtx.aal} />
      </aside>
      <main className="w-full flex-1 overflow-x-hidden p-4 md:p-8 xl:p-12">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
