import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, BarChart3, CheckCircle2, Clock3, Package, PhilippinePeso, ShoppingBag, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

import { getAdminAuthContext } from "@/lib/admin/auth";
import { aggregateProducts, buildDailyRevenue, percentChange, summarizePeriod, type AnalyticsOrder } from "@/lib/admin/analytics";
import { formatMinorUnitsToPHP } from "@/lib/money";
import { logServerError } from "@/lib/server-log";
import { createServiceClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  if (value === null) return <span className="text-xs text-muted-foreground">No prior-period baseline</span>;
  const up = value >= 0;
  return <span className={`inline-flex items-center gap-1 text-xs font-medium ${up ? "text-emerald-700" : "text-rose-700"}`}>{up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}{Math.abs(value).toFixed(1)}% vs previous 30 days</span>;
}

function SalesChart({ points }: { points: Array<{ key: string; revenueMinor: number }> }) {
  const max = Math.max(...points.map((point) => point.revenueMinor), 1);
  const line = points.map((point, index) => `${(index / Math.max(points.length - 1, 1)) * 100},${88 - (point.revenueMinor / max) * 76}`).join(" ");
  const total = points.reduce((sum, point) => sum + point.revenueMinor, 0);
  return <div><div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">Paid sales · rolling 30 days</p><p className="mt-1 text-2xl font-semibold tracking-tight">{formatMinorUnitsToPHP(total)}</p></div><Badge variant="outline">30D</Badge></div>{total === 0 ? <div className="flex h-48 items-center justify-center rounded-xl bg-muted/50 px-6 text-center text-sm text-muted-foreground">No paid sales in this period. The chart will populate after payments settle.</div> : <figure aria-label="Daily paid sales for the last 30 days"><svg viewBox="0 0 100 92" role="img" aria-labelledby="sales-chart-title" className="h-48 w-full overflow-visible"><title id="sales-chart-title">Daily paid sales for the last 30 days</title><line x1="0" y1="88" x2="100" y2="88" stroke="currentColor" className="text-border" strokeWidth="0.5" /><polyline points={line} fill="none" stroke="var(--brand)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" /></svg><figcaption className="flex justify-between text-xs text-muted-foreground"><span>{points[0]?.key}</span><span>{points.at(-1)?.key}</span></figcaption></figure>}</div>;
}

export default async function AdminDashboardPage() {
  const adminCtx = await getAdminAuthContext();
  if (!adminCtx) redirect("/login?next=/admin");
  const now = new Date();
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const currentStart = new Date(periodEnd); currentStart.setUTCDate(currentStart.getUTCDate() - 30);
  const previousStart = new Date(currentStart); previousStart.setUTCDate(previousStart.getUTCDate() - 30);
  const supabase = createServiceClient();
  const [ordersRes, inventoryRes, pendingRes, failedRes, readyRes, auditRes, returnsRes] = await Promise.all([
    supabase.from("orders").select("id, placed_at, total_minor, user_id, status, sales_channel, fulfillment_method, payments(status, paid_at), order_items(product_id, variant_id, product_name, variant_name, quantity, line_total_minor)").gte("placed_at", previousStart.toISOString()),
    supabase.from("inventory").select("variant_id, on_hand, reserved, safety_stock, product_variants(id, name, sku, status, products(id, name, slug, status))"),
    supabase.from("payments").select("id, created_at", { count: "exact" }).eq("method", "MANUAL_GCASH").eq("status", "SUBMITTED").order("created_at", { ascending: true }).limit(1),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "DELIVERY_FAILED"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "READY_FOR_SHIPMENT"),
    supabase.from("audit_logs").select("id, action, entity, actor_role, created_at").order("created_at", { ascending: false }).limit(6),
    supabase.from("return_requests").select("id", { count: "exact", head: true }).eq("status", "REQUESTED"),
  ]);
  if (ordersRes.error || inventoryRes.error || pendingRes.error || failedRes.error || readyRes.error || auditRes.error || returnsRes.error) { logServerError("admin.dashboard", "database_failure"); throw new Error("ADMIN_DASHBOARD_UNAVAILABLE"); }

  const orders = (ordersRes.data ?? []) as unknown as (AnalyticsOrder & { sales_channel?: string })[];
  const current = summarizePeriod(orders, currentStart, periodEnd);
  const previous = summarizePeriod(orders, previousStart, currentStart);
  const products = aggregateProducts(orders, currentStart, periodEnd);
  const daily = buildDailyRevenue(orders, currentStart, 30);
  const inventory = (inventoryRes.data ?? []) as unknown as InventoryInsightRow[];
  const lowStock = inventory.filter((row) => row.on_hand - row.reserved > 0 && row.on_hand - row.reserved <= row.safety_stock);
  const outOfStock = inventory.filter((row) => row.on_hand - row.reserved <= 0);
  const soldProductIds = new Set(products.map((product) => product.productId).filter(Boolean));
  const slowMoving = inventory.filter((row) => { const product = row.product_variants?.products; return row.on_hand - row.reserved > 0 && product?.status === "ACTIVE" && !soldProductIds.has(product.id); });
  const pendingCount = pendingRes.count ?? 0;
  const returnsCount = returnsRes.count ?? 0;
  const oldestPending = pendingRes.data?.[0]?.created_at ? Math.max(0, Math.floor((now.getTime() - new Date(pendingRes.data[0].created_at).getTime()) / 3_600_000)) : null;

  // Channel breakdown
  const paidOrdersInWindow = orders.filter((o) => {
    const placed = new Date(o.placed_at);
    const paymentObj = Array.isArray(o.payments) ? o.payments[0] : o.payments;
    return placed >= currentStart && placed < periodEnd && paymentObj?.status === "PAID";
  });
  const storefrontRevenueMinor = paidOrdersInWindow
    .filter((o) => o.sales_channel !== "POS")
    .reduce((sum, o) => sum + o.total_minor, 0);
  const posRevenueMinor = paidOrdersInWindow
    .filter((o) => o.sales_channel === "POS")
    .reduce((sum, o) => sum + o.total_minor, 0);

  const metricCards = [
    {
      label: "Paid sales",
      value: formatMinorUnitsToPHP(current.revenueMinor),
      change: percentChange(current.revenueMinor, previous.revenueMinor),
      icon: PhilippinePeso,
    },
    { label: "Paid orders", value: String(current.orderCount), change: percentChange(current.orderCount, previous.orderCount), icon: ShoppingBag },
    { label: "Average order", value: formatMinorUnitsToPHP(current.averageOrderMinor), change: null, icon: BarChart3 },
    { label: "Items sold", value: String(current.itemsSold), change: null, icon: Package },
  ];

  return <div className="space-y-6 pb-8">
    <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">1968 Control Center</p><h1 className="mt-2 admin-h1 text-foreground">What needs your attention</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">A truthful 30-day view of sales, channels, stock, payments, and fulfillment.</p></div><Badge variant="outline" className="w-fit px-3 py-1.5">Last 30 days · vs previous 30</Badge></header>
    {current.orderCount < 5 && <div className="flex gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm text-foreground"><Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><p><strong>Limited sales history.</strong> Treat performance signals as early indicators based on the selected period.</p></div>}
    <div><section aria-label="Performance summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">{metricCards.map(({ label, value, change, icon: Icon }) => <Card key={label} className="border-border bg-card shadow-none"><CardContent className="p-4 sm:p-5"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><Icon className="size-4 text-muted-foreground" /></div><p className="mt-3 text-xl font-semibold tracking-tight tabular-nums sm:mt-4 sm:text-3xl">{value}</p><div className="mt-2"><Change value={change} /></div></CardContent></Card>)}</section><p className="mt-3 text-xs leading-relaxed text-muted-foreground tabular-nums">Paid sales by channel: Online {formatMinorUnitsToPHP(storefrontRevenueMinor)} · POS {formatMinorUnitsToPHP(posRevenueMinor)}</p></div>
    <section aria-labelledby="attention-title" className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><AlertTriangle className="size-5 text-amber-700" /><h2 id="attention-title" className="admin-section text-foreground">Needs attention</h2></div><div className="flex items-center gap-2 text-xs"><Link href="/admin/orders?status=CONFIRMED" className="rounded-md bg-white/80 px-2 py-1 ring-1 ring-amber-200 hover:bg-white">Confirmed</Link><Link href="/admin/orders?status=PROCESSING" className="rounded-md bg-white/80 px-2 py-1 ring-1 ring-amber-200 hover:bg-white">Processing</Link></div></div><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
      <Link href="/admin/payments" className="rounded-xl bg-white p-4 ring-1 ring-amber-200 transition hover:ring-amber-400"><p className="text-2xl font-semibold">{pendingCount}</p><p className="mt-1 text-sm font-medium">GCash Verification</p><p className="mt-1 text-xs text-muted-foreground">{oldestPending === null ? "No waiting submissions" : `Oldest waiting ${oldestPending}h`}</p></Link>
      <Link href="/admin/orders?status=READY_FOR_SHIPMENT" className="rounded-xl bg-white p-4 ring-1 ring-amber-200 transition hover:ring-amber-400"><p className="text-2xl font-semibold">{readyRes.count ?? 0}</p><p className="mt-1 text-sm font-medium">Ready to ship</p><p className="mt-1 text-xs text-muted-foreground">Open the dispatch queue</p></Link>
      <Link href="/admin/returns?status=REQUESTED" className="rounded-xl bg-white p-4 ring-1 ring-amber-200 transition hover:ring-amber-400"><p className="text-2xl font-semibold">{returnsCount}</p><p className="mt-1 text-sm font-medium">Returns to inspect</p><p className="mt-1 text-xs text-muted-foreground">{returnsCount === 0 ? "All returns inspected" : `${returnsCount} awaiting review`}</p></Link>
      <Link href="/admin/catalog" className="rounded-xl bg-white p-4 ring-1 ring-amber-200 transition hover:ring-amber-400"><p className="text-2xl font-semibold">{lowStock.length + outOfStock.length}</p><p className="mt-1 text-sm font-medium">Inventory risks</p><p className="mt-1 text-xs text-muted-foreground">{outOfStock.length} Out of Stock · {lowStock.length} Low Stock</p></Link>
      <Link href="/admin/orders?status=DELIVERY_FAILED" className="rounded-xl bg-white p-4 ring-1 ring-amber-200 transition hover:ring-amber-400"><p className="text-2xl font-semibold">{failedRes.count ?? 0}</p><p className="mt-1 text-sm font-medium">Delivery failures</p><p className="mt-1 text-xs text-muted-foreground">Investigate exception orders</p></Link>
    </div></section>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]"><Card className="shadow-none"><CardContent className="p-5 sm:p-6"><SalesChart points={daily} /></CardContent></Card><Card className="shadow-none"><CardHeader><CardTitle>Product performance</CardTitle><CardDescription>Paid units in the selected period.</CardDescription></CardHeader><CardContent className="space-y-3">{products.length ? products.slice(0, 5).map((product, index) => <div key={product.productId ?? product.name} className="flex items-center gap-3 border-b border-border pb-3 last:border-0"><span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{product.name}</p><p className="text-xs text-muted-foreground">{product.units} units · {formatMinorUnitsToPHP(product.revenueMinor)}</p></div></div>) : <p className="rounded-xl bg-muted/50 p-5 text-sm text-muted-foreground">Not enough paid sales history to rank products.</p>}</CardContent></Card></div>
    <div className="grid gap-6 lg:grid-cols-2"><Card className="shadow-none"><CardHeader><CardTitle>Inventory health</CardTitle><CardDescription>Available stock is on-hand minus reserved.</CardDescription></CardHeader><CardContent className="space-y-3">{[...outOfStock, ...lowStock].slice(0, 5).map((row) => { const variant = row.product_variants; const available = row.on_hand - row.reserved; return <div key={row.variant_id} className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background p-3"><div><p className="text-sm font-semibold">{variant?.products?.name ?? "Product"} · {variant?.name ?? variant?.sku}</p><p className="text-xs text-muted-foreground">{row.reserved} reserved · safety stock {row.safety_stock}</p></div><Badge variant={available <= 0 ? "destructive" : "outline"}>{available} available</Badge></div>;})}{lowStock.length + outOfStock.length === 0 && <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-4 text-sm text-foreground"><CheckCircle2 className="size-4 text-emerald-700" /> No variants are at or below safety stock.</div>}<Button asChild variant="outline" className="w-full"><Link href="/admin/catalog">Open inventory <ArrowRight className="size-4" /></Link></Button></CardContent></Card>
    <Card className="shadow-none"><CardHeader><CardTitle>Merchandising opportunities</CardTitle><CardDescription>Evidence-based signals, not campaign attribution.</CardDescription></CardHeader><CardContent className="space-y-3">{products[0] && <div className="rounded-lg border border-border bg-background p-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Early product signal</p><p className="mt-2 text-sm font-semibold">{products[0].name} leads by paid units</p><p className="mt-1 text-xs text-muted-foreground">{products[0].units} units in the last 30 days. Protect availability before featuring it more heavily.</p></div>}{slowMoving.slice(0, 2).map((row) => <div key={row.variant_id} className="rounded-lg border border-border bg-background p-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Low sales activity</p><p className="mt-2 text-sm font-semibold">{row.product_variants?.products?.name} · {row.product_variants?.name ?? row.product_variants?.sku}</p><p className="mt-1 text-xs text-muted-foreground">{row.on_hand - row.reserved} available and no paid units in this period. Consider featuring or bundling after review.</p></div>)}{!products[0] && slowMoving.length === 0 && <p className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">Not enough product activity for a useful recommendation.</p>}</CardContent></Card></div>
    <Card className="shadow-none"><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Recent activity</CardTitle><CardDescription>Latest recorded system and staff actions.</CardDescription></div><Button asChild variant="outline" size="sm"><Link href="/admin/audit">Audit log</Link></Button></CardHeader><CardContent className="divide-y divide-border">{(auditRes.data ?? []).map((log) => <div key={log.id} className="flex items-center gap-3 py-3"><Clock3 className="size-4 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{log.action}</p><p className="text-xs text-muted-foreground">{log.entity} · {log.actor_role ?? "system"}</p></div><time className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time></div>)}</CardContent></Card>
    <p className="text-xs text-muted-foreground">Traffic, conversion, CTR, ROAS, and campaign attribution are not shown because this application does not currently record authoritative analytics events.</p>
  </div>;
}
