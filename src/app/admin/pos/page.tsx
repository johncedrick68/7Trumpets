import { AlertCircle, CheckCircle2, Lock, Store, Unlock } from "lucide-react";

import { requireAdminAal2 } from "@/lib/admin/auth";
import { formatMinorUnitsToPHP } from "@/lib/money";
import { openRegisterSessionAction, closeRegisterSessionAction } from "@/lib/pos/actions";
import { logServerError } from "@/lib/server-log";
import { createServiceClient } from "@/lib/supabase/server";
import { getStoreSetting } from "@/lib/settings/queries";
import { PosTerminal, PosProduct, PosCategory, ActiveSessionInfo } from "@/components/admin/pos-terminal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

interface SearchParams {
  notice?: string;
  error?: string;
  order_number?: string;
  change_minor?: string;
}

export default async function AdminPosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const adminCtx = await requireAdminAal2("/admin/pos");
  const { notice, error, order_number, change_minor } = await searchParams;

  const serviceClient = createServiceClient();

  // Load products, categories, and active register session in parallel
  const [productsRes, categoriesRes, activeSessionRes, paymentSetting] = await Promise.all([
    serviceClient
      .from("products")
      .select(`
        id,
        name,
        slug,
        category_id,
        status,
        product_variants (
          id,
          sku,
          name,
          price_minor,
          status,
          inventory (
            on_hand,
            reserved,
            safety_stock
          )
        ),
        product_images (
          storage_path,
          alt_text,
          position
        )
      `)
      .eq("status", "published")
      .order("name", { ascending: true }),
    serviceClient
      .from("categories")
      .select("id, name, slug")
      .order("name", { ascending: true }),
    serviceClient
      .from("register_sessions")
      .select("id, opening_cash_minor, expected_cash_minor, opened_at, status")
      .eq("cashier_id", adminCtx.userId)
      .eq("status", "OPEN")
      .maybeSingle(),
    getStoreSetting("payment", {
      gcash_enabled: false,
      gcash_number: "",
      gcash_account_name: "",
    }),
  ]);

  if (productsRes.error || categoriesRes.error) {
    logServerError("admin.pos.load", "database_failure");
    throw new Error("POS_UNAVAILABLE");
  }

  // Format products for PosTerminal
  const products: PosProduct[] = (productsRes.data || []).map((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawVariants = (p.product_variants as any[]) || [];
    const variants = rawVariants
      .filter((v) => v.status === "active")
      .map((v) => {
        const inv = Array.isArray(v.inventory) ? v.inventory[0] : v.inventory;
        const onHand = inv?.on_hand ?? 0;
        const reserved = inv?.reserved ?? 0;
        const safetyStock = inv?.safety_stock ?? 0;
        const available = Math.max(0, onHand - reserved - safetyStock);

        return {
          id: v.id,
          sku: v.sku,
          title: v.name || v.sku,
          price_minor: v.price_minor,
          is_active: v.status === "active",
          available_count: available,
        };
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const images = (p.product_images as any[]) || [];
    images.sort((a, b) => a.position - b.position);
    const primaryImage = images[0]?.storage_path || null;

    return {
      id: p.id,
      title: p.name,
      slug: p.slug,
      category_id: p.category_id,
      image_url: primaryImage,
      variants,
    };
  });

  const categories: PosCategory[] = categoriesRes.data || [];
  const activeSession: ActiveSessionInfo | null = activeSessionRes.data || null;

  const completedSaleInfo = order_number ? {
    orderNumber: order_number,
    changeMinor: parseInt(change_minor || "0", 10),
  } : null;

  const errorMessages: Record<string, string> = {
    empty_cart: "Add at least one item before completing the sale.",
    invalid_cart_payload: "The sale ticket could not be read. Clear the ticket and try again.",
    sale_processing_failed: "The sale was not completed. Check stock and tender details, then try again.",
    invalid_opening_cash: "Enter a valid non-negative opening float.",
    failed_to_open_register: "The register could not be opened. Refresh and try again.",
    invalid_closing_cash: "Enter a valid counted cash amount.",
    failed_to_close_register: "The register could not be closed. Refresh and try again.",
    register_session_required: "Register session required. Open your register before completing a sale.",
    register_session_closed: "This register session is no longer open. Open a register and try again.",
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Counter Operations · Register Shift
          </p>
          <h1 className="admin-h1 text-foreground flex items-center gap-2 mt-1">
            <Store className="size-7 text-primary" />
            Point of Sale
          </h1>
          <p className="text-muted-foreground text-sm">
            Cashier: <strong className="text-foreground">{adminCtx.email}</strong> · In-person checkout, cash drawer reconciliation &amp; instant stock deduction.
          </p>
        </div>

        {/* Register Session Controls */}
        <div className="flex items-center gap-2">
          {activeSession ? (
            <details className="relative">
              <summary className="list-none cursor-pointer">
                <Button variant="outline" size="sm" className="min-h-11 gap-1.5 border-emerald-600/30 bg-emerald-50 font-mono text-xs text-emerald-800 hover:bg-emerald-100 lg:min-h-8">
                  <Lock className="size-3.5" />
                  Close Shift ({formatMinorUnitsToPHP(activeSession.expected_cash_minor)})
                </Button>
              </summary>
              <div className="absolute right-0 mt-2 w-80 p-4 bg-background border border-border shadow-xl rounded-lg z-30 animate-in fade-in zoom-in-95 space-y-3">
                <h3 className="font-bold text-sm">Close Cashier Shift</h3>
                <p className="text-xs text-muted-foreground">
                  Expected cash in drawer based on float and sales: <strong>{formatMinorUnitsToPHP(activeSession.expected_cash_minor)}</strong>.
                </p>
                <form action={closeRegisterSessionAction} className="space-y-3">
                  <input type="hidden" name="session_id" value={activeSession.id} />
                  <div>
                    <Label htmlFor="close_actual_cash" className="text-xs">Counted Cash in Drawer (Centavos)</Label>
                    <Input
                      id="close_actual_cash"
                      name="actual_cash_minor"
                      type="number"
                      defaultValue={activeSession.expected_cash_minor}
                      className="h-8 text-xs font-mono mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="close_notes" className="text-xs">Shift Close Notes</Label>
                    <Input
                      id="close_notes"
                      name="notes"
                      placeholder="e.g. Shift balanced clean"
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <Button type="submit" variant="destructive" size="sm" className="w-full text-xs">
                    Confirm Close Register Drawer
                  </Button>
                </form>
              </div>
            </details>
          ) : (
            <details className="relative">
              <summary className="list-none cursor-pointer">
                <Button size="sm" className="min-h-11 gap-1.5 font-mono text-xs shadow-xs lg:min-h-8">
                  <Unlock className="size-3.5" />
                  Open Register Drawer
                </Button>
              </summary>
              <div className="absolute right-0 mt-2 w-80 p-4 bg-background border border-border shadow-xl rounded-lg z-30 animate-in fade-in zoom-in-95 space-y-3">
                <h3 className="font-bold text-sm">Open Register Shift</h3>
                <p className="text-xs text-muted-foreground">
                  Enter the starting petty cash float in the drawer.
                </p>
                <form action={openRegisterSessionAction} className="space-y-3">
                  <div>
                    <Label htmlFor="open_cash_minor" className="text-xs">Starting Float (Centavos, e.g. 200000 = ₱2,000)</Label>
                    <Input
                      id="open_cash_minor"
                      name="opening_cash_minor"
                      type="number"
                      defaultValue="200000"
                      className="h-8 text-xs font-mono mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="open_notes" className="text-xs">Notes (Optional)</Label>
                    <Input
                      id="open_notes"
                      name="notes"
                      placeholder="e.g. Morning shift float"
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <Button type="submit" size="sm" className="w-full text-xs">
                    Start Shift &amp; Open Drawer
                  </Button>
                </form>
              </div>
            </details>
          )}
        </div>
      </header>

      {notice === "register_opened" && (
        <div className="p-4 rounded-lg bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 flex items-center gap-2 text-sm">
          <CheckCircle2 className="size-4" />
          Register drawer successfully opened for cashier shift!
        </div>
      )}

      {notice === "register_closed" && (
        <div className="p-4 rounded-lg bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 flex items-center gap-2 text-sm">
          <CheckCircle2 className="size-4" />
          Register drawer successfully closed and cash tallied.
        </div>
      )}

      {notice === "sale_completed" && (
        <div className="p-4 rounded-lg bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 flex items-center gap-2 text-sm">
          <CheckCircle2 className="size-4" />
          Sale completed successfully! Order #{order_number} recorded with change {formatMinorUnitsToPHP(parseInt(change_minor || "0", 10))}.
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-2 text-sm">
          <AlertCircle className="size-4" />
          {errorMessages[error] || "Something prevented this action. Refresh and try again."}
        </div>
      )}

      <PosTerminal
        products={products}
        categories={categories}
        cashierEmail={adminCtx.email}
        activeSession={activeSession}
        gcashAccount={{
          enabled: paymentSetting.gcash_enabled,
          number: paymentSetting.gcash_number,
          accountName: paymentSetting.gcash_account_name,
        }}
        completedSaleInfo={completedSaleInfo}
      />
    </div>
  );
}
