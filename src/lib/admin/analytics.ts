export type AnalyticsOrder = {
  id: string;
  placed_at: string;
  total_minor: number;
  user_id: string | null;
  status: string;
  payments?: Array<{ status: string; paid_at: string | null }> | { status: string; paid_at: string | null } | null;
  order_items?: Array<{
    product_id: string | null;
    variant_id: string | null;
    product_name: string;
    variant_name: string | null;
    quantity: number;
    line_total_minor: number;
  }> | null;
};

export type PeriodSummary = {
  revenueMinor: number;
  orderCount: number;
  itemsSold: number;
  averageOrderMinor: number;
  uniqueCustomers: number;
};

export function isPaidOrder(order: AnalyticsOrder) {
  const payments = Array.isArray(order.payments) ? order.payments : order.payments ? [order.payments] : [];
  return payments.some((payment) => payment.status === "PAID");
}

export function summarizePeriod(orders: AnalyticsOrder[], start: Date, end: Date): PeriodSummary {
  const paid = orders.filter((order) => {
    const placed = new Date(order.placed_at);
    return placed >= start && placed < end && isPaidOrder(order);
  });
  const revenueMinor = paid.reduce((sum, order) => sum + order.total_minor, 0);
  const itemsSold = paid.reduce(
    (sum, order) => sum + (order.order_items ?? []).reduce((lineSum, item) => lineSum + item.quantity, 0),
    0,
  );
  return {
    revenueMinor,
    orderCount: paid.length,
    itemsSold,
    averageOrderMinor: paid.length ? Math.round(revenueMinor / paid.length) : 0,
    uniqueCustomers: new Set(paid.map((order) => order.user_id).filter(Boolean)).size,
  };
}

export function percentChange(current: number, previous: number) {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export function buildDailyRevenue(orders: AnalyticsOrder[], start: Date, days: number) {
  const points = Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    return { key: date.toISOString().slice(0, 10), revenueMinor: 0 };
  });
  const byDate = new Map(points.map((point) => [point.key, point]));
  for (const order of orders) {
    if (!isPaidOrder(order)) continue;
    const point = byDate.get(order.placed_at.slice(0, 10));
    if (point) point.revenueMinor += order.total_minor;
  }
  return points;
}

export function aggregateProducts(orders: AnalyticsOrder[], start: Date, end: Date) {
  const products = new Map<string, { productId: string | null; name: string; units: number; revenueMinor: number }>();
  for (const order of orders) {
    const placed = new Date(order.placed_at);
    if (placed < start || placed >= end || !isPaidOrder(order)) continue;
    for (const item of order.order_items ?? []) {
      const key = item.product_id ?? item.product_name;
      const current = products.get(key) ?? { productId: item.product_id, name: item.product_name, units: 0, revenueMinor: 0 };
      current.units += item.quantity;
      current.revenueMinor += item.line_total_minor;
      products.set(key, current);
    }
  }
  return [...products.values()].sort((a, b) => b.units - a.units || b.revenueMinor - a.revenueMinor);
}
