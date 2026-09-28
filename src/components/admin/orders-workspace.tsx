"use client";

import * as React from "react";
import Link from "next/link";
import { 
  ArrowRight, 
  ExternalLink, 
  Eye, 
  Phone, 
  User, 
  Truck,
  CreditCard,
  Package,
} from "lucide-react";

import { formatMinorUnitsToPHP } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/admin/search-field";
import {
  AdminTableContainer,
  AdminTable,
  AdminTableHeader,
  AdminTableBody,
  AdminTableRow,
  AdminTableHead,
  AdminTableCell,
  AdminTableEmpty,
  AdminTablePagination,
} from "@/components/admin/admin-table";
import { StatusBadge, type StatusVariant } from "@/components/admin/status-badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AdminToolbar } from "@/components/admin/admin-toolbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

function getFulfillmentStatusVariant(status: string): StatusVariant {
  switch (status) {
    case "COMPLETED":
    case "DELIVERED":
      return "success";
    case "CANCELLED":
    case "DELIVERY_FAILED":
      return "danger";
    case "READY_FOR_SHIPMENT":
      return "warning";
    case "CONFIRMED":
    case "PROCESSING":
    case "PACKING":
    case "SHIPPED":
    case "IN_TRANSIT":
    case "OUT_FOR_DELIVERY":
      return "info";
    default:
      return "neutral";
  }
}

function getPaymentStatusVariant(status: string): StatusVariant {
  switch (status) {
    case "PAID":
      return "success";
    case "SUBMITTED":
      return "warning";
    case "FAILED":
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
  }
}

function getNextActionHint(status: string, paymentMethod?: string, paymentStatus?: string) {
  if (paymentMethod === "MANUAL_GCASH" && paymentStatus === "SUBMITTED") {
    return { label: "Review GCash", variant: "warning" as StatusVariant };
  }
  switch (status) {
    case "CONFIRMED":
      return { label: "Pack Order", variant: "info" as StatusVariant };
    case "PROCESSING":
    case "PACKING":
      return { label: "Prepare Dispatch", variant: "info" as StatusVariant };
    case "READY_FOR_SHIPMENT":
      return { label: "Courier Dispatch", variant: "warning" as StatusVariant };
    case "DELIVERY_FAILED":
      return { label: "Inspect Handover", variant: "danger" as StatusVariant };
    default:
      return null;
  }
}

const PAGE_SIZE = 15;

export function OrdersWorkspace({ orders, initialStatusFilter }: OrdersWorkspaceProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedStatus, setSelectedStatus] = React.useState<string>(initialStatusFilter || "ALL");
  const [paymentFilter, setPaymentFilter] = React.useState<string>("ALL");
  const [selectedOrderId, setSelectedOrderId] = React.useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);

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

      // Status filter
      if (selectedStatus !== "ALL") {
        if (selectedStatus === "PROCESSING") {
          if (order.status !== "PROCESSING" && order.status !== "PACKING") return false;
        } else if (selectedStatus === "IN_TRANSIT") {
          if (!["SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(order.status)) return false;
        } else if (selectedStatus === "COMPLETED") {
          if (!["DELIVERED", "COMPLETED"].includes(order.status)) return false;
        } else if (order.status !== selectedStatus) {
          return false;
        }
      }

      // Payment filter
      if (paymentFilter !== "ALL") {
        const primaryPayment = order.payments?.[0];
        if (paymentFilter === "PAID" && primaryPayment?.status !== "PAID") return false;
        if (paymentFilter === "SUBMITTED" && primaryPayment?.status !== "SUBMITTED") return false;
        if (paymentFilter === "UNPAID" && (primaryPayment?.status === "PAID" || primaryPayment?.status === "SUBMITTED")) return false;
      }

      return true;
    });
  }, [orders, selectedStatus, paymentFilter, searchQuery]);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatus, paymentFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const paginatedOrders = React.useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, currentPage]);

  const openDrawer = (orderId: string) => {
    setSelectedOrderId(orderId);
    setIsSheetOpen(true);
  };

  const hasActiveFilters = searchQuery !== "" || selectedStatus !== "ALL" || paymentFilter !== "ALL";

  return (
    <div className="space-y-4">
      {/* ── TailAdmin Operational Toolbar ── */}
      <AdminToolbar className="flex-col md:flex-row gap-3">
        <div className="flex-1 w-full md:max-w-md">
          <SearchField
            placeholder="Search order #, customer, phone, tracking, reference…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery("")}
            aria-label="Search orders"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Filter */}
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="h-9 text-xs w-[170px]" aria-label="Filter by order status">
              <SelectValue placeholder="Fulfillment Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="CONFIRMED">Confirmed</SelectItem>
              <SelectItem value="PROCESSING">Processing / Packing</SelectItem>
              <SelectItem value="READY_FOR_SHIPMENT">Ready for Shipment</SelectItem>
              <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
              <SelectItem value="DELIVERY_FAILED">Delivery Failed</SelectItem>
              <SelectItem value="COMPLETED">Delivered / Completed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          {/* Payment Filter */}
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="h-9 text-xs w-[150px]" aria-label="Filter by payment status">
              <SelectValue placeholder="Payment Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Payments</SelectItem>
              <SelectItem value="PAID">Paid Only</SelectItem>
              <SelectItem value="SUBMITTED">Awaiting Review</SelectItem>
              <SelectItem value="UNPAID">Unpaid (COD)</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedStatus("ALL");
                setPaymentFilter("ALL");
              }}
              className="h-9 text-xs text-muted-foreground hover:text-foreground"
            >
              Reset Filters
            </Button>
          )}
        </div>
      </AdminToolbar>

      {/* ── Main Orders Data Table ── */}
      <AdminTableContainer>
        <AdminTable>
          <AdminTableHeader>
            <AdminTableRow>
              <AdminTableHead align="left" className="w-[130px]">Order #</AdminTableHead>
              <AdminTableHead align="left">Customer</AdminTableHead>
              <AdminTableHead align="left">Placed</AdminTableHead>
              <AdminTableHead align="left">Payment</AdminTableHead>
              <AdminTableHead align="left">Fulfillment</AdminTableHead>
              <AdminTableHead align="left">Next Action</AdminTableHead>
              <AdminTableHead align="right">Total</AdminTableHead>
              <AdminTableHead align="right" className="w-[140px]">Actions</AdminTableHead>
            </AdminTableRow>
          </AdminTableHeader>
          <AdminTableBody>
            {paginatedOrders.length === 0 ? (
              <AdminTableEmpty
                colSpan={8}
                title="No orders found"
                description={
                  hasActiveFilters
                    ? "No orders match your active search or status criteria. Try resetting filters."
                    : "No orders have been recorded in the system yet."
                }
                action={
                  hasActiveFilters ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedStatus("ALL");
                        setPaymentFilter("ALL");
                      }}
                    >
                      Clear active filters
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              paginatedOrders.map((order) => {
                const payment = order.payments?.[0];
                const actionHint = getNextActionHint(order.status, payment?.method, payment?.status);

                return (
                  <AdminTableRow
                    key={order.id}
                    onClick={() => openDrawer(order.id)}
                    className="cursor-pointer"
                  >
                    {/* Order # */}
                    <AdminTableCell align="left">
                      <span className="font-mono font-bold text-sm text-foreground">
                        #{order.order_number}
                      </span>
                    </AdminTableCell>

                    {/* Customer Info */}
                    <AdminTableCell align="left">
                      <div className="font-semibold text-sm text-foreground">
                        {order.recipient_name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {order.customer_email}
                      </div>
                    </AdminTableCell>

                    {/* Placed Date */}
                    <AdminTableCell align="left">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(order.placed_at).toLocaleDateString("en-PH", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </AdminTableCell>

                    {/* Payment Info */}
                    <AdminTableCell align="left">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-foreground">
                          {payment?.method === "MANUAL_GCASH" ? "Manual GCash" : "Cash on Delivery"}
                        </span>
                        <StatusBadge
                          variant={getPaymentStatusVariant(payment?.status ?? "UNPAID")}
                          dot={false}
                          className="w-fit text-[10px]"
                        >
                          {payment?.status ?? "UNPAID"}
                        </StatusBadge>
                      </div>
                    </AdminTableCell>

                    {/* Fulfillment Status */}
                    <AdminTableCell align="left">
                      <StatusBadge variant={getFulfillmentStatusVariant(order.status)}>
                        {order.status.replace(/_/g, " ")}
                      </StatusBadge>
                    </AdminTableCell>

                    {/* Action Needed */}
                    <AdminTableCell align="left">
                      {actionHint ? (
                        <StatusBadge variant={actionHint.variant} dot={false} className="text-[10px]">
                          {actionHint.label}
                        </StatusBadge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </AdminTableCell>

                    {/* Total Amount */}
                    <AdminTableCell align="right">
                      <span className="font-mono font-bold text-sm text-foreground">
                        {formatMinorUnitsToPHP(order.total_minor)}
                      </span>
                    </AdminTableCell>

                    {/* Action Buttons */}
                    <AdminTableCell align="right">
                      <div
                        className="flex items-center justify-end gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openDrawer(order.id)}
                          className="h-8 px-2 text-xs"
                          aria-label={`Quick view order ${order.order_number}`}
                        >
                          <Eye className="size-3.5" aria-hidden="true" />
                          <span className="sr-only sm:not-sr-only sm:ml-1">View</span>
                        </Button>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-xs font-semibold"
                        >
                          <Link href={`/admin/orders/${order.id}`}>
                            <span>Manage</span>
                            <ArrowRight className="size-3 ml-1" aria-hidden="true" />
                          </Link>
                        </Button>
                      </div>
                    </AdminTableCell>
                  </AdminTableRow>
                );
              })
            )}
          </AdminTableBody>
        </AdminTable>

        {filteredOrders.length > 0 && (
          <AdminTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredOrders.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        )}
      </AdminTableContainer>

      {/* ── Order Detail Drawer / Sheet (Accessible Sheet Primitive) ── */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto p-6 space-y-6">
          {activeOrder && (
            <>
              <SheetHeader className="pb-4 border-b border-border">
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge variant={getFulfillmentStatusVariant(activeOrder.status)}>
                    {activeOrder.status.replace(/_/g, " ")}
                  </StatusBadge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(activeOrder.placed_at).toLocaleString()}
                  </span>
                </div>
                <SheetTitle className="text-xl font-bold mt-2">
                  Order #{activeOrder.order_number}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Operational overview and customer fulfillment details.
                </SheetDescription>
              </SheetHeader>

              {/* Customer Contact & Address */}
              <div className="space-y-3 p-4 bg-muted/30 rounded-xl border border-border text-sm">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <User className="size-4 text-foreground" />
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-foreground text-xs uppercase tracking-wider font-mono">
                    <CreditCard className="size-3.5" />
                    <span>Payment Status</span>
                  </div>
                  <StatusBadge
                    variant={getPaymentStatusVariant(activeOrder.payments?.[0]?.status ?? "UNPAID")}
                    dot={false}
                    className="text-[10px]"
                  >
                    {activeOrder.payments?.[0]?.status ?? "UNPAID"}
                  </StatusBadge>
                </div>
                <p className="text-xs text-foreground font-medium">
                  Method: {activeOrder.payments?.[0]?.method === "MANUAL_GCASH" ? "Manual GCash" : "Cash on Delivery"}
                </p>
              </div>

              {/* Shipment & Tracking Details */}
              {activeOrder.shipments && activeOrder.shipments.length > 0 && activeOrder.shipments[0].tracking_number && (
                <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-2 text-sm">
                  <div className="flex items-center gap-2 font-bold text-foreground text-xs uppercase tracking-wider font-mono">
                    <Truck className="size-3.5" />
                    <span>Courier Dispatch ({activeOrder.shipments[0].provider})</span>
                  </div>
                  <p className="font-mono font-bold text-sm text-foreground select-all">
                    {activeOrder.shipments[0].tracking_number}
                  </p>
                </div>
              )}

              {/* Items List */}
              {activeOrder.order_items && activeOrder.order_items.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground font-bold">
                    <Package className="size-3.5" />
                    <span>Items ({activeOrder.order_items.length})</span>
                  </div>
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
                <Button asChild size="lg" className="w-full font-bold h-11 gap-2">
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
