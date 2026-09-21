"use client";

import * as React from "react";
import Link from "next/link";
import { 
  ArrowRight, 
  ExternalLink, 
  Eye, 
  Inbox, 
  Phone, 
  User, 
} from "lucide-react";

import { formatMinorUnitsToPHP } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SearchField } from "@/components/admin/search-field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

export interface OrderItemSummary {
  id: string;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  line_total_minor: number;
}

export interface AdminOrderSummary {
  id: string;
  order_number: string;
  customer_email: string;
  recipient_name: string;
  recipient_phone?: string | null;
  address_line1?: string | null;
  city_municipality?: string | null;
  province?: string | null;
  status: string;
  total_minor: number;
  placed_at: string;
  payments: Array<{
    method: string;
    status: string;
    payment_submissions?: Array<{
      reference_number: string | null;
    }> | null;
  }> | null;
  shipments?: Array<{
    tracking_number: string | null;
    provider: string;
  }> | null;
  order_items?: OrderItemSummary[];
}

interface OrdersWorkspaceProps {
  orders: AdminOrderSummary[];
  initialStatusFilter?: string;
}

export function OrdersWorkspace({ orders, initialStatusFilter }: OrdersWorkspaceProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedStatus, setSelectedStatus] = React.useState<string>(initialStatusFilter || "ALL");
  const [selectedOrderId, setSelectedOrderId] = React.useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  // Selected order details
  const activeOrder = React.useMemo(() => {
    return orders.find((o) => o.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  // Filter orders
  const filteredOrders = React.useMemo(() => {
    return orders.filter((order) => {
      const q = searchQuery.toLowerCase().trim();
      const trackingMatches = order.shipments?.some(
        (s) => s.tracking_number && s.tracking_number.toLowerCase().includes(q)
      );
      const referenceMatches = order.payments?.some(
        (p) => p.payment_submissions?.some(
          (sub) => sub.reference_number && sub.reference_number.toLowerCase().includes(q)
        )
      );

      const matchesSearch = !q ||
        order.order_number.toLowerCase().includes(q) ||
        order.customer_email.toLowerCase().includes(q) ||
        order.recipient_name.toLowerCase().includes(q) ||
        Boolean(order.recipient_phone && order.recipient_phone.toLowerCase().includes(q)) ||
        Boolean(trackingMatches) ||
        Boolean(referenceMatches);

      if (!matchesSearch) return false;

      if (selectedStatus === "ALL") return true;
      if (selectedStatus === "PROCESSING") {
        return order.status === "PROCESSING" || order.status === "PACKING";
      }
      if (selectedStatus === "IN_TRANSIT") {
        return order.status === "SHIPPED" || order.status === "IN_TRANSIT" || order.status === "OUT_FOR_DELIVERY";
      }
      if (selectedStatus === "COMPLETED") {
        return order.status === "DELIVERED" || order.status === "COMPLETED";
      }
      return order.status === selectedStatus;
    });
  }, [orders, selectedStatus, searchQuery]);

  const openDrawer = (orderId: string) => {
    setSelectedOrderId(orderId);
    setIsSheetOpen(true);
  };

  const getStatusVariant = (status: string) => {
    if (status === "COMPLETED" || status === "DELIVERED") return "default";
    if (status === "CANCELLED" || status === "DELIVERY_FAILED") return "destructive";
    if (status === "CONFIRMED") return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-6">
      {/* ── Filter & Search Toolbar ── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <SearchField
              placeholder="Search orders, customers, tracking…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery("")}
              aria-label="Search orders"
            />
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            { key: "ALL", label: "All Orders" },
            { key: "CONFIRMED", label: "Confirmed" },
            { key: "PROCESSING", label: "Processing / Packing" },
            { key: "READY_FOR_SHIPMENT", label: "Ready for Shipment" },
            { key: "IN_TRANSIT", label: "In Transit" },
            { key: "DELIVERY_FAILED", label: "Delivery Failed" },
            { key: "COMPLETED", label: "Delivered / Completed" },
          ].map((tab) => (
            <Button
              key={tab.key}
              type="button"
              variant={selectedStatus === tab.key ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus(tab.key)}
              className="h-10 text-xs rounded-lg shrink-0"
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {/* ── Main Orders Workspace ── */}
      <Card className="border-border shadow-xs">
        <CardHeader className="py-4 px-6 border-b border-border bg-muted/20 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Inbox className="size-5" />
              <span>Orders Queue</span>
              <Badge variant="secondary" className="font-mono text-xs ml-1">
                {filteredOrders.length}
              </Badge>
            </CardTitle>
            <CardDescription>Click any order to inspect details in the operational drawer.</CardDescription>
          </div>
        </CardHeader>

        {filteredOrders.length === 0 ? (
          <CardContent className="border-t border-dashed py-16 text-center text-muted-foreground">
            <Inbox className="size-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm font-medium">No orders match active filter</p>
            <p className="text-xs mt-1">Try switching status tabs or clearing your search.</p>
          </CardContent>
        ) : (
          <>
            {/* Mobile Cards (specialized mobile layout) */}
            <div className="divide-y border-t md:hidden">
              {filteredOrders.map((order) => {
                const payment = order.payments?.[0];
                return (
                  <article
                    key={order.id}
                    onClick={() => openDrawer(order.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openDrawer(order.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Inspect order ${order.order_number}`}
                    className="cursor-pointer space-y-3 p-4 text-left transition-colors hover:bg-muted/20 active:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs font-bold text-foreground">
                          #{order.order_number}
                        </p>
                        <p className="text-sm font-semibold mt-0.5">{order.recipient_name}</p>
                        <p className="text-xs text-muted-foreground">{order.customer_email}</p>
                      </div>
                      <Badge variant={getStatusVariant(order.status)} className="text-[10px] uppercase">
                        {order.status.replace(/_/g, " ")}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-y py-2.5 text-xs">
                      <div>
                        <p className="text-muted-foreground text-[10px]">Payment</p>
                        <p className="font-medium mt-0.5">
                          {payment?.method === "MANUAL_GCASH" ? "GCash" : "COD"} · {payment?.status ?? "UNPAID"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-[10px]">Total</p>
                        <p className="font-mono font-bold text-foreground mt-0.5">
                          {formatMinorUnitsToPHP(order.total_minor)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {new Date(order.placed_at).toLocaleDateString()}
                      </span>
                      <span className="inline-flex h-8 items-center gap-1 text-xs font-medium text-primary">
                        <span>Inspect</span>
                        <ArrowRight className="size-3" />
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Desktop / Tablet Table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Fulfillment Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Placed</TableHead>
                    <TableHead className="text-right w-[140px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => {
                    const payment = order.payments?.[0];
                    return (
                      <TableRow
                        key={order.id}
                        onClick={() => openDrawer(order.id)}
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                      >
                        <TableCell className="font-mono font-bold text-sm text-foreground">
                          #{order.order_number}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-sm">{order.recipient_name}</div>
                          <div className="text-xs text-muted-foreground">{order.customer_email}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(order.status)} className="text-[10px] uppercase">
                            {order.status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-medium">
                            {payment?.method === "MANUAL_GCASH" ? "Manual GCash" : "Cash on Delivery"}
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground">
                            {payment?.status ?? "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-sm">
                          {formatMinorUnitsToPHP(order.total_minor)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(order.placed_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDrawer(order.id);
                            }}
                            className="h-8 text-xs gap-1"
                          >
                            <Eye className="size-3.5" />
                            <span>Quick View</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>

      {/* ── Order Detail Drawer / Sheet ── */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto p-6 space-y-6">
          {activeOrder && (
            <>
              <SheetHeader className="pb-4 border-b border-border">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={getStatusVariant(activeOrder.status)} className="text-[10px] uppercase">
                    {activeOrder.status.replace(/_/g, " ")}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(activeOrder.placed_at).toLocaleString()}
                  </span>
                </div>
                <SheetTitle className="text-2xl font-extrabold mt-2">
                  Order #{activeOrder.order_number}
                </SheetTitle>
                <SheetDescription>
                  Operational overview and customer fulfillment details.
                </SheetDescription>
              </SheetHeader>

              {/* Customer Contact & Address */}
              <div className="space-y-3 p-4 bg-muted/30 rounded-xl border border-border text-sm">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <User className="size-4 text-primary" />
                  <span>Customer &amp; Delivery</span>
                </div>
                <div className="text-xs space-y-1 text-muted-foreground">
                  <p className="font-semibold text-foreground text-sm">{activeOrder.recipient_name}</p>
                  <p>{activeOrder.customer_email}</p>
                  {activeOrder.recipient_phone && (
                    <p className="flex items-center gap-1.5 font-mono">
                      <Phone className="size-3" />
                      {activeOrder.recipient_phone}
                    </p>
                  )}
                  {activeOrder.address_line1 && (
                    <p className="mt-2 text-foreground font-medium">
                      {activeOrder.address_line1}
                      {activeOrder.city_municipality && `, ${activeOrder.city_municipality}`}
                      {activeOrder.province && `, ${activeOrder.province}`}
                    </p>
                  )}
                </div>
              </div>

              {/* Payment Info */}
              <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-2 text-sm">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-bold">
                  Payment Status
                </p>
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {activeOrder.payments?.[0]?.method === "MANUAL_GCASH" ? "Manual GCash" : "Cash on Delivery"}
                  </span>
                  <Badge variant="outline" className="font-mono text-xs uppercase">
                    {activeOrder.payments?.[0]?.status ?? "UNPAID"}
                  </Badge>
                </div>
              </div>

              {/* Shipment & Tracking Details */}
              {activeOrder.shipments && activeOrder.shipments.length > 0 && activeOrder.shipments[0].tracking_number && (
                <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-2 text-sm">
                  <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-bold">
                    Courier Dispatch ({activeOrder.shipments[0].provider})
                  </p>
                  <p className="font-mono font-bold text-sm text-foreground select-all">
                    {activeOrder.shipments[0].tracking_number}
                  </p>
                </div>
              )}

              {/* Items List */}
              {activeOrder.order_items && activeOrder.order_items.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-bold">
                    Items ({activeOrder.order_items.length})
                  </p>
                  <div className="divide-y divide-border border rounded-xl overflow-hidden text-sm">
                    {activeOrder.order_items.map((item) => (
                      <div key={item.id} className="p-3 flex justify-between items-center bg-card">
                        <div>
                          <p className="font-medium text-foreground">{item.product_name}</p>
                          <p className="text-xs font-mono text-muted-foreground">
                            {item.variant_name || "Standard"} × {item.quantity}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-xs">
                          {formatMinorUnitsToPHP(item.line_total_minor)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Financial Totals */}
              <div className="pt-4 border-t border-border flex justify-between items-end">
                <span className="font-bold text-base">Grand Total</span>
                <span className="font-mono font-black text-2xl text-foreground">
                  {formatMinorUnitsToPHP(activeOrder.total_minor)}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-border flex flex-col gap-2">
                <Button asChild size="lg" className="w-full font-bold h-12 gap-2 shadow-md">
                  <Link href={`/admin/orders/${activeOrder.id}`}>
                    <span>Open Full Order Operations</span>
                    <ExternalLink className="size-4" />
                  </Link>
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
