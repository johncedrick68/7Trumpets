import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  CreditCard,
  MessageSquare,
  Package,
  PhilippinePeso,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Truck,
} from "lucide-react";

import { getAdminAuthContext } from "@/lib/admin/auth";
import {
  calculateAvailableStock,
  isInventoryOutOfStock,
  isInventoryLowStock,
} from "@/lib/inventory/stock";
import {
  aggregateProducts,
  buildDailyRevenue,
  percentChange,
  summarizePeriod,
  type AnalyticsOrder,
} from "@/lib/admin/analytics";
import { formatMinorUnitsToPHP } from "@/lib/money";
import { logServerError } from "@/lib/server-log";
import { createServiceClient } from "@/lib/supabase/server";
import { relationToMany, relationToOne } from "@/lib/data/relations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";

export const dynamic = "force-dynamic";

type InventoryInsightRow = {
  variant_id: string;
  on_hand: number;
  reserved: number;
  safety_stock: number;
  product_variants: {
    id: string;
    name: string | null;
    sku: string;
    status: string;
    products: { id: string; name: string; slug: string; status: string } | null;
  } | null;
};

function Change({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-xs text-muted-foreground">No prior-period baseline</span>;
  }
  const up = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${
        up ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
      }`}
    >
      {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
      {Math.abs(value).toFixed(1)}% vs previous 30 days
    </span>
  );
}

function SalesChart({ points }: { points: Array<{ key: string; revenueMinor: number }> }) {
  const max = Math.max(...points.map((point) => point.revenueMinor), 1);
  const line = points
    .map(
      (point, index) =>
        `${(index / Math.max(points.length - 1, 1)) * 100},${88 - (point.revenueMinor / max) * 76}`
    )
    .join(" ");
  const total = points.reduce((sum, point) => sum + point.revenueMinor, 0);

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Paid sales · rolling 30 days
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {formatMinorUnitsToPHP(total)}
          </p>
        </div>
        <StatusBadge variant="neutral" dot={false}>
          Last 30 Days
        </StatusBadge>
      </div>

      {total === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl bg-muted/40 px-6 text-center text-sm text-muted-foreground border border-dashed border-border">
          No paid sales recorded in this period. The chart will populate after orders settle.
        </div>
      ) : (
        <figure aria-label="Daily paid sales for the last 30 days">
          <svg
            viewBox="0 0 100 92"
            role="img"
            aria-labelledby="sales-chart-title"
            className="h-48 w-full overflow-visible"
          >
            <title id="sales-chart-title">Daily paid sales for the last 30 days</title>
            <line x1="0" y1="88" x2="100" y2="88" stroke="currentColor" className="text-border" strokeWidth="0.5" />
            <polyline
              points={line}
              fill="none"
              stroke="currentColor"
              className="text-foreground"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
          <figcaption className="flex justify-between text-xs text-muted-foreground pt-2">
            <span>{points[0]?.key}</span>
            <span>{points.at(-1)?.key}</span>
          </figcaption>
        </figure>
      )}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const adminCtx = await getAdminAuthContext();
  if (!adminCtx) redirect("/login?next=/admin");

  const now = new Date();
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const currentStart = new Date(periodEnd);
  currentStart.setUTCDate(currentStart.getUTCDate() - 30);
  const previousStart = new Date(currentStart);
  previousStart.setUTCDate(previousStart.getUTCDate() - 30);

  const supabase = createServiceClient();
  const [
    ordersRes,
    inventoryRes,
    pendingRes,
    failedRes,
    readyRes,
    auditRes,
    returnsRes,
    confirmedRes,
    supportRes,
    registerRes,
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, placed_at, total_minor, user_id, status, sales_channel, fulfillment_method, payments(status, paid_at), order_items(product_id, variant_id, product_name, variant_name, quantity, line_total_minor)"
      )
      .gte("placed_at", previousStart.toISOString()),
    supabase
      .from("inventory")
      .select(
        "variant_id, on_hand, reserved, safety_stock, product_variants(id, name, sku, status, products(id, name, slug, status))"
      ),
    supabase
      .from("payments")
      .select("id, created_at", { count: "exact" })
      .eq("method", "MANUAL_GCASH")
      .eq("status", "SUBMITTED")
      .order("created_at", { ascending: true })
      .limit(1),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "DELIVERY_FAILED"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "READY_FOR_SHIPMENT"),
    supabase
      .from("audit_logs")
      .select("id, action, entity, actor_role, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("return_requests").select("id", { count: "exact", head: true }).eq("status", "REQUESTED"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "CONFIRMED"),
    supabase.from("support_conversations").select("id", { count: "exact", head: true }).in("status", ["OPEN", "WAITING_FOR_STAFF"]),
    supabase.from("register_sessions").select("id, status").eq("status", "OPEN").maybeSingle(),
  ]);

  const queryErrors = {
    orders: Boolean(ordersRes.error),
    inventory: Boolean(inventoryRes.error),
    payments: Boolean(pendingRes.error),
    deliveryFailures: Boolean(failedRes.error),
    readyToShip: Boolean(readyRes.error),
    audit: Boolean(auditRes.error),
    returns: Boolean(returnsRes.error),
    register: Boolean(registerRes.error),
  };

  if (Object.values(queryErrors).some(Boolean)) {
    logServerError("admin.dashboard", "partial_database_failure");
  }

  const orders: Array<AnalyticsOrder & { sales_channel?: string }> = (ordersRes.data ?? []).map((order) => ({
    ...order,
    payments: relationToMany(order.payments),
    order_items: relationToMany(order.order_items),
  }));

  const current = summarizePeriod(orders, currentStart, periodEnd);
  const previous = summarizePeriod(orders, previousStart, currentStart);
  const products = aggregateProducts(orders, currentStart, periodEnd);
  const daily = buildDailyRevenue(orders, currentStart, 30);

  const inventory: InventoryInsightRow[] = (inventoryRes.data ?? []).map((row) => {
    const variant = relationToOne(row.product_variants);
    return {
      ...row,
      product_variants: variant
        ? { ...variant, products: relationToOne(variant.products) }
        : null,
    };
  });

  const lowStock = inventory.filter((row) => isInventoryLowStock(row));
  const outOfStock = inventory.filter((row) => isInventoryOutOfStock(row));

  const pendingCount = pendingRes.count ?? 0;
  const returnsCount = returnsRes.count ?? 0;
  const readyCount = readyRes.count ?? 0;
  const failedCount = failedRes.count ?? 0;
  const confirmedCount = confirmedRes.count ?? 0;
  const openSupportCount = supportRes.count ?? 0;
  const oldestPending = pendingRes.data?.[0]?.created_at
    ? Math.max(0, Math.floor((now.getTime() - new Date(pendingRes.data[0].created_at).getTime()) / 3_600_000))
    : null;

  // Channel breakdown
  const paidOrdersInWindow = orders.filter((o) => {
    const placed = new Date(o.placed_at);
    return placed >= currentStart && placed < periodEnd && o.payments.some((payment) => payment.status === "PAID");
  });
  const storefrontRevenueMinor = paidOrdersInWindow
    .filter((o) => o.sales_channel !== "POS")
    .reduce((sum, o) => sum + o.total_minor, 0);
  const posRevenueMinor = paidOrdersInWindow
    .filter((o) => o.sales_channel === "POS")
    .reduce((sum, o) => sum + o.total_minor, 0);

  return (
    <div className="space-y-8 pb-8">
      {/* Canonical Page Header */}
      <AdminPageHeader
        eyebrow="1968 Operations"
        title="Control Center"
        description="A truthful, database-backed view of sales, payment verifications, fulfillment queues, and stock health."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/orders">View Orders</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/pos">Open POS</Link>
            </Button>
          </div>
        }
      />

      {/* Early Sales Warning If History Is Sparse */}
      {!queryErrors.orders && current.orderCount < 5 && (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-sm text-foreground shadow-xs">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-xs sm:text-sm text-muted-foreground">
            <strong className="font-semibold text-foreground">Early operational baseline.</strong> Performance metrics reflect early transaction records. Signals will calibrate continuously as daily order volume grows.
          </p>
        </div>
      )}

      {/* SECTION 1: WHAT NEEDS ATTENTION? (Operational Priority Grid) */}
      <section aria-labelledby="attention-title" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <h2 id="attention-title" className="text-sm font-bold uppercase tracking-wider text-foreground">
              What Needs Attention
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Link
              href="/admin/orders?status=CONFIRMED"
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              Confirmed ({confirmedCount})
            </Link>
            <Link
              href="/admin/orders?status=PROCESSING"
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              Processing
            </Link>
            {failedCount > 0 && (
              <Link
                href="/admin/orders?status=DELIVERY_FAILED"
                className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-foreground underline underline-offset-4"
              >
                Delivery Exceptions ({failedCount})
              </Link>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {/* 1. GCash Review Queue */}
          <StatCard
            title="GCash Verification"
            value={queryErrors.payments ? "—" : pendingCount}
            subtitle={queryErrors.payments ? "Queue unavailable" : oldestPending === null ? "No waiting submissions" : `Oldest waiting ${oldestPending}h`}
            icon={CreditCard}
            href="/admin/payments"
            tone={pendingCount > 0 ? "warning" : "neutral"}
          />

          {/* 2. Ready to Ship Queue */}
          <StatCard
            title="Ready to Ship"
            value={queryErrors.readyToShip ? "—" : readyCount}
            subtitle={queryErrors.readyToShip ? "Queue unavailable" : "Dispatch handover queue"}
            icon={Truck}
            href="/admin/orders?status=READY_FOR_SHIPMENT"
            tone={readyCount > 0 ? "info" : "neutral"}
          />

          {/* 3. Returns to Inspect */}
          <StatCard
            title="Returns Queue"
            value={queryErrors.returns ? "—" : returnsCount}
            subtitle={queryErrors.returns ? "Queue unavailable" : returnsCount === 0 ? "All inspected" : `${returnsCount} awaiting review`}
            icon={RotateCcw}
            href="/admin/returns?status=REQUESTED"
            tone={returnsCount > 0 ? "warning" : "neutral"}
          />

          {/* 4. Open Customer Support */}
          <StatCard
            title="Open Support"
            value={openSupportCount}
            subtitle={openSupportCount === 0 ? "Inbox cleared" : `${openSupportCount} awaiting staff`}
            icon={MessageSquare}
            href="/admin/support"
            tone={openSupportCount > 0 ? "warning" : "neutral"}
          />

          {/* 5. Inventory Risks (Low/Out of Stock based on real safety_stock) */}
          <StatCard
            title="Inventory Risks"
            value={queryErrors.inventory ? "—" : lowStock.length + outOfStock.length}
            subtitle={queryErrors.inventory ? "Inventory unavailable" : `${outOfStock.length} Out of Stock · ${lowStock.length} Low Stock`}
            icon={Package}
            href="/admin/catalog"
            tone={outOfStock.length > 0 ? "danger" : lowStock.length > 0 ? "warning" : "neutral"}
          />

          {/* 6. Register Session Status */}
          <StatCard
            title="Register Status"
            value={queryErrors.register ? "—" : registerRes.data ? "OPEN" : "CLOSED"}
            subtitle={queryErrors.register ? "Status unavailable" : registerRes.data ? "Active register shift" : "Register closed · Open POS"}
            icon={ShoppingBag}
            href="/admin/pos"
            tone={registerRes.data ? "success" : "neutral"}
          />
        </div>
      </section>

      {/* SECTION 2: 30-DAY PERFORMANCE TRUTH (No Fake SaaS Trends) */}
      <section aria-labelledby="performance-title" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="performance-title" className="text-sm font-bold uppercase tracking-wider text-foreground">
            30-Day Verified Performance
          </h2>
          <span className="text-xs text-muted-foreground">
            Calculated authoritatively from PostgreSQL settled payments
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard
            title="Paid Revenue"
            value={queryErrors.orders ? "Unavailable" : formatMinorUnitsToPHP(current.revenueMinor)}
            subtitle={<Change value={queryErrors.orders ? null : percentChange(current.revenueMinor, previous.revenueMinor)} />}
            icon={PhilippinePeso}
          />
          <StatCard
            title="Paid Orders"
            value={queryErrors.orders ? "Unavailable" : String(current.orderCount)}
            subtitle={<Change value={queryErrors.orders ? null : percentChange(current.orderCount, previous.orderCount)} />}
            icon={ShoppingBag}
          />
          <StatCard
            title="Average Order"
            value={queryErrors.orders ? "Unavailable" : formatMinorUnitsToPHP(current.averageOrderMinor)}
            subtitle="Authoritative basket average"
            icon={BarChart3}
          />
          <StatCard
            title="Pieces Sold"
            value={queryErrors.orders ? "Unavailable" : String(current.itemsSold)}
            subtitle="Physical inventory moved"
            icon={Package}
          />
        </div>

        <p className="text-xs text-muted-foreground tabular-nums">
          Sales Channel Split: Online Storefront <strong className="font-semibold text-foreground">{formatMinorUnitsToPHP(storefrontRevenueMinor)}</strong> · POS Counter <strong className="font-semibold text-foreground">{formatMinorUnitsToPHP(posRevenueMinor)}</strong>
        </p>
      </section>

      {/* SECTION 3: REVENUE TIMELINE & PRODUCT PERFORMANCE */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        {/* Real Daily Sales Curve */}
        <Card className="shadow-xs border-border bg-card">
          <CardContent className="p-5 sm:p-6">
            <SalesChart points={daily} />
          </CardContent>
        </Card>

        {/* Product Sales Ranking */}
        <Card className="shadow-xs border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Top Performing Pieces</CardTitle>
            <CardDescription className="text-xs">Paid volume in the rolling 30-day window.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {products.length ? (
              products.slice(0, 5).map((product, index) => (
                <div
                  key={product.productId ?? product.name}
                  className="flex items-center gap-3 border-b border-border pb-3 last:border-0"
                >
                  <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.units} units · {formatMinorUnitsToPHP(product.revenueMinor)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-xl bg-muted/40 p-4 text-center text-xs text-muted-foreground">
                No paid orders recorded yet to rank merchandise.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SECTION 4: INVENTORY HEALTH & RECENT AUDIT TRAIL */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Inventory Safety Stock Warnings */}
        <Card className="shadow-xs border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Inventory Health</CardTitle>
                <CardDescription className="text-xs">
                  Available stock = on-hand minus reserved minus safety stock.
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/catalog">Catalog</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[...outOfStock, ...lowStock].slice(0, 5).map((row) => {
              const variant = row.product_variants;
              const available = calculateAvailableStock(row);
              const isOut = isInventoryOutOfStock(row);
              return (
                <div
                  key={row.variant_id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {variant?.products?.name ?? "Product"} · {variant?.name ?? variant?.sku}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.reserved} reserved · safety threshold {row.safety_stock}
                    </p>
                  </div>
                  <StatusBadge variant={isOut ? "danger" : "warning"}>
                    {available} available
                  </StatusBadge>
                </div>
              );
            })}

            {lowStock.length + outOfStock.length === 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-emerald-50/50 dark:bg-emerald-950/20 p-4 text-xs text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>All product variants are currently above their safety stock threshold.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity Stream (Small useful subset for Overview; full audit is at /admin/audit) */}
        <Card className="shadow-xs border-border bg-card">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
              <CardDescription className="text-xs">
                Latest immutable operations (showing 5 most recent).
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/audit">View Full Audit Log</Link>
            </Button>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {(auditRes.data ?? []).slice(0, 5).map((log) => (
              <div key={log.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="size-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                  <Clock3 className="size-3.5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground">{log.action}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {log.entity} · Role: {log.actor_role ?? "system"}
                  </p>
                </div>
                <time className="text-[11px] text-muted-foreground shrink-0">
                  {new Date(log.created_at).toLocaleDateString("en-PH", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Note: Conversion rates, cart abandonment funnel drops, and visitor impressions are not displayed because this system avoids untrusted client analytics cookies and adheres to PostgreSQL transactional truth.
      </p>
    </div>
  );
}
