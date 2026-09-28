import { CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import Link from "next/link";
import { requireAdminAal2 } from "@/lib/admin/auth";
import { formatMinorUnitsToPHP } from "@/lib/money";
import { processReturnRequest, issueRefund } from "@/lib/returns/actions";
import { logServerError } from "@/lib/server-log";
import { createServiceClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AdminTableContainer,
  AdminTable,
  AdminTableHeader,
  AdminTableBody,
  AdminTableRow,
  AdminTableHead,
  AdminTableCell,
  AdminTableEmpty,
} from "@/components/admin/admin-table";
import { StatusBadge, type StatusVariant } from "@/components/admin/status-badge";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminToolbar } from "@/components/admin/admin-toolbar";

export const dynamic = "force-dynamic";

interface ReturnRequestRow {
  id: string;
  order_id: string;
  user_id: string;
  type: string;
  status: string;
  reason: string;
  reason_details: string | null;
  requested_refund_minor: number;
  approved_refund_minor: number;
  admin_notes: string | null;
  created_at: string;
  orders: {
    id: string;
    order_number: string;
    total_minor: number;
    customer_email: string;
    recipient_name: string;
  } | null;
}

interface SearchParams {
  status?: string;
  notice?: string;
  error?: string;
}

function getReturnStatusVariant(status: string): StatusVariant {
  switch (status) {
    case "APPROVED":
    case "COMPLETED":
      return "success";
    case "REJECTED":
      return "danger";
    case "REQUESTED":
      return "warning";
    case "ITEMS_RECEIVED":
      return "info";
    default:
      return "neutral";
  }
}

export default async function AdminReturnsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdminAal2("/admin/returns");
  const { status: filterStatus = "ALL", notice, error } = await searchParams;

  const serviceClient = createServiceClient();
  let query = serviceClient
    .from("return_requests")
    .select(`
      id,
      order_id,
      user_id,
      type,
      status,
      reason,
      reason_details,
      requested_refund_minor,
      approved_refund_minor,
      admin_notes,
      created_at,
      orders (
        id,
        order_number,
        total_minor,
        customer_email,
        recipient_name
      )
    `)
    .order("created_at", { ascending: false });

  if (filterStatus !== "ALL") {
    query = query.eq("status", filterStatus);
  }

  const { data: rawRequests, error: fetchError } = await query;
  if (fetchError) {
    logServerError("admin.returns.fetch", "database_failure");
    throw new Error("ADMIN_RETURNS_UNAVAILABLE");
  }
  const requests = (rawRequests || []) as unknown as ReturnRequestRow[];

  const statusFilters = [
    { label: "All Requests", value: "ALL" },
    { label: "Needs Inspection", value: "REQUESTED" },
    { label: "Approved", value: "APPROVED" },
    { label: "Items Received", value: "ITEMS_RECEIVED" },
    { label: "Completed", value: "COMPLETED" },
    { label: "Rejected", value: "REJECTED" },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Customer Assurance · Operations"
        title="Returns & Exchanges"
        description="Inspect customer return submissions, verify returned garment condition, and issue refunds."
      />

      {notice === "decision_saved" && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400 flex items-center gap-2 text-xs">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>Return request decision recorded successfully.</span>
        </div>
      )}

      {notice === "refund_issued" && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400 flex items-center gap-2 text-xs">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>Financial refund ledger entry recorded and completed!</span>
        </div>
      )}

      {error && (
        <div role="alert" className="p-3.5 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-2 text-xs">
          <XCircle className="size-4 shrink-0" />
          <span>The return operation could not be completed. Refresh the request and try again.</span>
        </div>
      )}

      {/* Filter Tabs Toolbar */}
      <AdminToolbar>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs w-full">
          {statusFilters.map((tab) => (
            <Button
              key={tab.value}
              variant={filterStatus === tab.value ? "default" : "outline"}
              size="sm"
              asChild
              className="h-8 text-xs font-medium"
            >
              <Link href={`/admin/returns?status=${tab.value}`}>
                {tab.label}
              </Link>
            </Button>
          ))}
        </div>
      </AdminToolbar>

      {/* Table of Return Requests */}
      <AdminTableContainer>
        <AdminTable>
          <AdminTableHeader>
            <AdminTableRow>
              <AdminTableHead align="left" className="w-[180px]">Order / Customer</AdminTableHead>
              <AdminTableHead align="left">Type &amp; Reason</AdminTableHead>
              <AdminTableHead align="right">Requested Value</AdminTableHead>
              <AdminTableHead align="left">Status</AdminTableHead>
              <AdminTableHead align="left">Submitted</AdminTableHead>
              <AdminTableHead align="right" className="w-[120px]">Actions</AdminTableHead>
            </AdminTableRow>
          </AdminTableHeader>
          <AdminTableBody>
            {requests && requests.length > 0 ? (
              requests.map((req) => {
                const order = req.orders;
                return (
                  <AdminTableRow key={req.id}>
                    {/* Order & Customer */}
                    <AdminTableCell align="left">
                      <div className="font-mono font-bold text-sm text-foreground">
                        <Link href={`/admin/orders/${req.order_id}`} className="hover:underline">
                          #{order?.order_number || req.order_id.slice(0, 8)}
                        </Link>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">
                        {order?.recipient_name} · {order?.customer_email}
                      </div>
                    </AdminTableCell>

                    {/* Type & Reason */}
                    <AdminTableCell align="left">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge variant="neutral" dot={false} className="text-[10px] font-mono uppercase">
                          {req.type}
                        </StatusBadge>
                        <span className="text-xs font-semibold text-foreground">
                          {req.reason.replace(/_/g, " ")}
                        </span>
                      </div>
                      {req.reason_details && (
                        <p className="text-[11px] text-muted-foreground italic line-clamp-1 mt-1">
                          &ldquo;{req.reason_details}&rdquo;
                        </p>
                      )}
                    </AdminTableCell>

                    {/* Requested Value */}
                    <AdminTableCell align="right">
                      <span className="font-mono font-bold text-sm text-foreground">
                        {formatMinorUnitsToPHP(req.requested_refund_minor)}
                      </span>
                    </AdminTableCell>

                    {/* Status */}
                    <AdminTableCell align="left">
                      <StatusBadge variant={getReturnStatusVariant(req.status)}>
                        {req.status.replace(/_/g, " ")}
                      </StatusBadge>
                    </AdminTableCell>

                    {/* Date */}
                    <AdminTableCell align="left">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(req.created_at).toLocaleDateString("en-PH", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </AdminTableCell>

                    {/* Actions Menu */}
                    <AdminTableCell align="right">
                      <details className="relative inline-block text-left">
                        <summary className="list-none cursor-pointer">
                          <span className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-foreground shadow-xs hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <span>Manage</span>
                            <ChevronDown className="size-3 text-muted-foreground" aria-hidden="true" />
                          </span>
                        </summary>
                        <div className="absolute right-0 mt-2 w-80 p-4 bg-card border border-border shadow-xl rounded-xl z-30 space-y-3.5 text-left">
                          <div>
                            <h4 className="font-bold text-xs text-foreground">
                              Review Return #{req.id.slice(0, 8)}
                            </h4>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Evaluate garment condition and record transition.
                            </p>
                          </div>

                          {/* Decision Form */}
                          <form action={processReturnRequest} className="space-y-2.5 text-xs">
                            <input type="hidden" name="return_id" value={req.id} />
                            <div>
                              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Decision
                              </Label>
                              <select
                                name="decision"
                                defaultValue={req.status}
                                className="w-full h-8 rounded-lg border border-input bg-background px-2 text-xs mt-1"
                              >
                                <option value="APPROVED">Approve (Accept Return)</option>
                                <option value="ITEMS_RECEIVED">Items Received at Store</option>
                                <option value="COMPLETED">Mark Completed</option>
                                <option value="REJECTED">Reject Return</option>
                              </select>
                            </div>
                            <div>
                              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Notes to Customer
                              </Label>
                              <Input
                                name="admin_notes"
                                placeholder="Inspection notes or guidance..."
                                defaultValue={req.admin_notes || ""}
                                className="h-8 text-xs mt-1"
                              />
                            </div>
                            <Button type="submit" size="sm" className="w-full h-8 text-xs font-semibold">
                              Save Decision
                            </Button>
                          </form>

                          {/* Issue Refund Form if Approved */}
                          {(req.status === "APPROVED" || req.status === "ITEMS_RECEIVED") && (
                            <div className="pt-3 border-t border-border">
                              <h5 className="font-semibold text-xs text-foreground mb-2">
                                Issue Financial Refund
                              </h5>
                              <form action={issueRefund} className="space-y-2 text-xs">
                                <input type="hidden" name="order_id" value={req.order_id} />
                                <input type="hidden" name="return_request_id" value={req.id} />
                                <input type="hidden" name="amount_minor" value={req.requested_refund_minor.toString()} />
                                <div>
                                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    Refund Method
                                  </Label>
                                  <select
                                    name="method"
                                    defaultValue="MANUAL_GCASH"
                                    className="w-full h-8 rounded-lg border border-input bg-background px-2 text-xs mt-1"
                                  >
                                    <option value="MANUAL_GCASH">GCash Transfer</option>
                                    <option value="CASH">Counter Cash Refund</option>
                                  </select>
                                </div>
                                <div>
                                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    Reference No. / Receipt
                                  </Label>
                                  <Input
                                    name="reference_number"
                                    placeholder="e.g. GCash Ref 10029384"
                                    className="h-8 text-xs mt-1"
                                  />
                                </div>
                                <Button type="submit" variant="secondary" size="sm" className="w-full h-8 text-xs font-semibold">
                                  Issue {formatMinorUnitsToPHP(req.requested_refund_minor)} Refund
                                </Button>
                              </form>
                            </div>
                          )}
                        </div>
                      </details>
                    </AdminTableCell>
                  </AdminTableRow>
                );
              })
            ) : (
              <AdminTableEmpty
                colSpan={6}
                title="No return requests found"
                description={
                  filterStatus !== "ALL"
                    ? "No returns match your active status filter. Switch filters to inspect other queues."
                    : "No return or exchange requests have been submitted by customers yet."
                }
              />
            )}
          </AdminTableBody>
        </AdminTable>
      </AdminTableContainer>
    </div>
  );
}
