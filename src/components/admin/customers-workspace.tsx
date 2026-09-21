"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  ShoppingBag,
  TrendingUp,
  Calendar,
  MessageSquare,
  ArrowUpRight,
  ExternalLink,
  MapPin,
} from "lucide-react";

import { CustomerRow, CustomerGrowthMetrics, CustomerDetail } from "@/lib/customers/queries";
import { formatMinorUnitsToPHP } from "@/lib/money";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/admin/search-field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CustomersWorkspaceProps {
  customers: CustomerRow[];
  metrics: CustomerGrowthMetrics;
}

export function CustomersWorkspace({ customers, metrics }: CustomersWorkspaceProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "has_orders" | "open_support" | "this_month">("all");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<CustomerDetail | null>(null);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return customers.filter((c) => {
      // Search matching
      const matchesSearch =
        !term ||
        c.display_name.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        (c.phone && c.phone.toLowerCase().includes(term)) ||
        c.id.toLowerCase().includes(term);

      if (!matchesSearch) return false;

      // Filter matching
      if (filter === "has_orders") return c.order_count > 0;
      if (filter === "open_support") return c.open_support_count > 0;
      if (filter === "this_month") return new Date(c.created_at).getTime() >= startOfMonth;

      return true;
    });
  }, [customers, search, filter]);

  // Load customer detail
  const handleOpenDetail = async (customerId: string) => {
    setSelectedCustomerId(customerId);
    setDetailLoading(true);

    try {
      const res = await fetch(`/api/admin/customers/${customerId}`);
      if (res.ok) {
        const data = await res.json();
        setDetailData(data);
      }
    } catch {
      // fallback
    } finally {
      setDetailLoading(false);
    }
  };

  // Compute maximum signups for the trend chart height scaling
  const maxTrend = Math.max(...(metrics.signup_trend.map((t) => t.signups) || [1]), 1);

  return (
    <div className="space-y-8">
      {/* 1. Growth Analytics Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs text-muted-foreground flex items-center justify-between">
              Total Customers
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold font-mono">{metrics.total_customers}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              +{metrics.new_this_week} this week · +{metrics.new_this_month} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs text-muted-foreground flex items-center justify-between">
              Purchasing Customers
              <ShoppingBag className="w-3.5 h-3.5 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold font-mono">{metrics.customers_with_orders}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {metrics.total_customers > 0
                ? `${Math.round((metrics.customers_with_orders / metrics.total_customers) * 100)}% conversion`
                : "0%"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs text-muted-foreground flex items-center justify-between">
              Returning Buyers
              <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold font-mono">{metrics.returning_customers}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Placed 2 or more orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs text-muted-foreground flex items-center justify-between">
              New Today
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold font-mono">{metrics.new_today}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Organic account creations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 2. 14-Day Signup Trend Chart */}
      {metrics.signup_trend && metrics.signup_trend.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              14-Day Customer Acquisition Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="h-20 flex items-end gap-1 sm:gap-2 pt-2 border-b border-muted">
              {metrics.signup_trend.map((day) => {
                const heightPct = Math.max(Math.round((day.signups / maxTrend) * 100), 6);
                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center gap-1 group relative cursor-pointer"
                  >
                    <div
                      style={{ height: `${heightPct}%` }}
                      className="w-full rounded-t bg-foreground/80 group-hover:bg-foreground transition-colors"
                    />
                    <div className="absolute -top-7 opacity-0 group-hover:opacity-100 bg-popover text-popover-foreground text-[10px] px-1.5 py-0.5 rounded shadow border whitespace-nowrap pointer-events-none transition-opacity">
                      {day.date}: {day.signups} signup{day.signups === 1 ? "" : "s"}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 font-mono">
              <span>{metrics.signup_trend[0]?.date}</span>
              <span>{metrics.signup_trend[metrics.signup_trend.length - 1]?.date}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex-1 max-w-sm">
          <SearchField
            placeholder="Search customer name, phone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
            className="h-11 text-sm"
            aria-label="Search customers"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
            className="text-xs h-8"
          >
            All ({customers.length})
          </Button>
          <Button
            variant={filter === "has_orders" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("has_orders")}
            className="text-xs h-8"
          >
            Has Orders ({customers.filter((c) => c.order_count > 0).length})
          </Button>
          <Button
            variant={filter === "open_support" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("open_support")}
            className="text-xs h-8"
          >
            Open Support ({customers.filter((c) => c.open_support_count > 0).length})
          </Button>
          <Button
            variant={filter === "this_month" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("this_month")}
            className="text-xs h-8"
          >
            New This Month
          </Button>
        </div>
      </div>

      {/* 4. Customer Data Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-center">Orders</TableHead>
                <TableHead>Paid Spend</TableHead>
                <TableHead>Latest Order</TableHead>
                <TableHead>Support</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-xs text-muted-foreground">
                    No matching customer records found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((c) => (
                  <TableRow key={c.id} className="text-xs">
                    <TableCell>
                      <div className="font-semibold">{c.display_name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[180px]">
                        {c.id}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.phone || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap text-[11px]">
                      {new Date(c.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-center font-mono font-medium">
                      {c.order_count}
                    </TableCell>
                    <TableCell className="font-mono font-semibold">
                      {formatMinorUnitsToPHP(c.paid_spend_minor)}
                    </TableCell>
                    <TableCell>
                      {c.latest_order_number ? (
                        <div className="space-y-0.5">
                          <div className="font-mono text-[11px]">{c.latest_order_number}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {c.latest_order_date ? new Date(c.latest_order_date).toLocaleDateString() : ""}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">No orders</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.open_support_count > 0 ? (
                        <Badge variant="destructive" className="text-[10px] gap-1">
                          <MessageSquare className="w-3 h-3" /> {c.open_support_count} Open
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">Clean</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDetail(c.id)}
                        className="h-8 text-xs gap-1"
                      >
                        View <ArrowUpRight className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 5. Customer Detail Dialog */}
      <Dialog
        open={Boolean(selectedCustomerId)}
        onOpenChange={(open) => !open && setSelectedCustomerId(null)}
      >
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-base">
              <span>Customer Profile</span>
              <span className="font-mono text-xs text-muted-foreground font-normal">
                {selectedCustomerId}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Historical activity and customer context for operations.
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Loading customer record...
            </div>
          ) : detailData ? (
            <div className="space-y-6 text-xs py-2">
              {/* Profile Overview */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-muted/40 rounded-lg border">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-medium">Name</div>
                  <div className="font-semibold text-sm mt-0.5">{detailData.display_name}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-medium">Phone</div>
                  <div className="mt-0.5">{detailData.phone || "Not provided"}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-medium">Joined Date</div>
                  <div className="mt-0.5">{new Date(detailData.created_at).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-medium">Total Orders</div>
                  <div className="mt-0.5 font-mono font-medium">{detailData.orders.length}</div>
                </div>
              </div>

              {/* Saved Addresses */}
              <div>
                <h4 className="font-semibold text-xs mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  Saved Addresses ({detailData.addresses.length})
                </h4>
                {detailData.addresses.length === 0 ? (
                  <p className="text-muted-foreground text-[11px]">No saved shipping addresses.</p>
                ) : (
                  <div className="space-y-2">
                    {detailData.addresses.map((addr) => (
                      <div key={addr.id} className="p-2.5 rounded border bg-card text-[11px] space-y-0.5">
                        <div className="font-medium flex items-center justify-between">
                          <span>{addr.recipient_name} ({addr.phone})</span>
                          {addr.is_default && <Badge variant="secondary" className="text-[9px]">Default</Badge>}
                        </div>
                        <div className="text-muted-foreground">
                          {addr.address_line1}, {addr.city_municipality}, {addr.province} {addr.postal_code}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Order History */}
              <div>
                <h4 className="font-semibold text-xs mb-2 flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-muted-foreground" />
                  Recent Orders ({detailData.orders.length})
                </h4>
                {detailData.orders.length === 0 ? (
                  <p className="text-muted-foreground text-[11px]">No orders placed yet.</p>
                ) : (
                  <div className="space-y-2">
                    {detailData.orders.slice(0, 5).map((ord) => (
                      <div key={ord.id} className="p-2.5 rounded border bg-card flex items-center justify-between text-[11px]">
                        <div>
                          <div className="font-mono font-medium">{ord.order_number}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(ord.created_at).toLocaleDateString()} · {ord.fulfillment_method}
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <div>
                            <div className="font-mono font-semibold">{formatMinorUnitsToPHP(ord.total_minor)}</div>
                            <Badge variant="outline" className="text-[9px] uppercase">{ord.status}</Badge>
                          </div>
                          <Link href={`/admin/orders/${ord.id}`} className="p-1 hover:bg-muted rounded">
                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Support Threads */}
              <div>
                <h4 className="font-semibold text-xs mb-2 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                  Support Threads ({detailData.support_conversations.length})
                </h4>
                {detailData.support_conversations.length === 0 ? (
                  <p className="text-muted-foreground text-[11px]">No support conversations on record.</p>
                ) : (
                  <div className="space-y-2">
                    {detailData.support_conversations.map((sc) => (
                      <div key={sc.id} className="p-2.5 rounded border bg-card flex items-center justify-between text-[11px]">
                        <div>
                          <div className="font-medium uppercase text-[10px]">{sc.category.replace("_", " ")}</div>
                          <div className="text-[10px] text-muted-foreground">
                            Last message: {new Date(sc.last_message_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={sc.status === "RESOLVED" ? "outline" : "default"} className="text-[9px]">
                            {sc.status}
                          </Badge>
                          <Link href={`/admin/support?id=${sc.id}`} className="p-1 hover:bg-muted rounded">
                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
