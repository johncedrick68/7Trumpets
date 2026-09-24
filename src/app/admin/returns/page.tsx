import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import Link from "next/link";
import { requireAdminAal2 } from "@/lib/admin/auth";
import { formatMinorUnitsToPHP } from "@/lib/money";
import { processReturnRequest, issueRefund } from "@/lib/returns/actions";
import { logServerError } from "@/lib/server-log";
import { createServiceClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Customer Assurance · Operations
          </p>
          <h1 className="admin-h1 text-foreground flex items-center gap-2 mt-1">
            <RotateCcw className="size-7 text-primary" />
            Returns &amp; Exchanges
          </h1>
          <p className="text-muted-foreground text-sm">
            Inspect customer return submissions, verify returned garment condition, and issue refunds.
          </p>
        </div>
      </header>

      {notice === "decision_saved" && (
        <div className="p-4 rounded-lg bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 flex items-center gap-2 text-sm">
          <CheckCircle2 className="size-4" />
          Return request decision recorded successfully.
        </div>
      )}

      {notice === "refund_issued" && (
        <div className="p-4 rounded-lg bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 flex items-center gap-2 text-sm">
          <CheckCircle2 className="size-4" />
          Financial refund ledger entry recorded and completed!
        </div>
      )}

      {error && (
        <div role="alert" className="p-4 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-2 text-sm">
          <XCircle className="size-4" />
          The return operation could not be completed. Refresh the request and try again.
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {statusFilters.map((tab) => (
          <Button
            key={tab.value}
            variant={filterStatus === tab.value ? "default" : "outline"}
            size="sm"
            asChild
            className="h-8 text-xs font-mono"
          >
            <Link href={`/admin/returns?status=${tab.value}`}>
              {tab.label}
            </Link>
          </Button>
        ))}
      </div>

      {/* Table of Return Requests */}
      <Card className="border-border shadow-xs">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order / Customer</TableHead>
                <TableHead>Type &amp; Reason</TableHead>
                <TableHead>Requested Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests && requests.length > 0 ? (
                requests.map((req) => {
                  const order = req.orders;
                  return (
                    <TableRow key={req.id}>
                      <TableCell>
                        <div className="font-mono font-bold text-xs">
                          <Link href={`/admin/orders/${req.order_id}`} className="hover:underline">
                            #{order?.order_number || req.order_id.slice(0, 8)}
                          </Link>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {order?.recipient_name} · {order?.customer_email}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px] uppercase">
                          {req.type}
                        </Badge>
                        <div className="text-xs font-medium text-foreground mt-1">
                          {req.reason.replace(/_/g, " ")}
                        </div>
                        {req.reason_details && (
                          <div className="text-[11px] text-muted-foreground italic line-clamp-1">
                            &ldquo;{req.reason_details}&rdquo;
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="font-mono font-bold text-xs">
                        {formatMinorUnitsToPHP(req.requested_refund_minor)}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={
                            req.status === "APPROVED" || req.status === "COMPLETED"
                              ? "default"
                              : req.status === "REJECTED"
                              ? "destructive"
                              : "secondary"
                          }
                          className="font-mono text-[10px] uppercase"
                        >
                          {req.status}
                        </Badge>
                      </TableCell>

                      <TableCell className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {new Date(req.created_at).toLocaleDateString()}
                      </TableCell>

                      <TableCell className="text-right">
                        <details className="relative inline-block text-left">
                          <summary className="list-none cursor-pointer">
                            <span className="inline-flex h-7 items-center justify-center rounded-md border border-input bg-background px-3 font-mono text-xs font-medium shadow-xs hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                              Manage
                            </span>
                          </summary>
                          <div className="absolute right-0 mt-2 w-72 p-4 bg-background border border-border shadow-xl rounded-lg z-30 space-y-3">
                            <h4 className="font-bold text-xs">Review Return #{req.id.slice(0, 8)}</h4>

                            {/* Decision Form */}
                            <form action={processReturnRequest} className="space-y-2 text-xs">
                              <input type="hidden" name="return_id" value={req.id} />
                              <div>
                                <Label className="text-[10px]">Decision</Label>
                                <select
                                  name="decision"
                                  defaultValue={req.status}
                                  className="w-full h-8 rounded border border-input bg-background px-2 text-xs mt-0.5"
                                >
                                  <option value="APPROVED">Approve (Accept Return)</option>
                                  <option value="ITEMS_RECEIVED">Items Received at Store</option>
                                  <option value="COMPLETED">Mark Completed</option>
                                  <option value="REJECTED">Reject Return</option>
                                </select>
                              </div>
                              <div>
                                <Label className="text-[10px]">Notes to Customer</Label>
                                <Input
                                  name="admin_notes"
                                  placeholder="Inspection notes or guidance..."
                                  defaultValue={req.admin_notes || ""}
                                  className="h-7 text-xs mt-0.5"
                                />
                              </div>
                              <Button type="submit" size="sm" className="w-full h-7 text-xs">
                                Save Decision
                              </Button>
                            </form>

                            {/* Issue Refund Form if Approved */}
                            {(req.status === "APPROVED" || req.status === "ITEMS_RECEIVED") && (
                              <div className="pt-2 border-t border-border">
                                <h5 className="font-bold text-[11px] text-emerald-700 mb-1.5">Issue Financial Refund</h5>
                                <form action={issueRefund} className="space-y-2 text-xs">
                                  <input type="hidden" name="order_id" value={req.order_id} />
                                  <input type="hidden" name="return_request_id" value={req.id} />
                                  <input type="hidden" name="amount_minor" value={req.requested_refund_minor.toString()} />
                                  <div>
                                    <Label className="text-[10px]">Refund Method</Label>
                                    <select
                                      name="method"
                                      defaultValue="MANUAL_GCASH"
                                      className="w-full h-7 rounded border border-input bg-background px-2 text-xs mt-0.5"
                                    >
                                      <option value="MANUAL_GCASH">GCash Transfer</option>
                                      <option value="CASH">Counter Cash Refund</option>
                                    </select>
                                  </div>
                                  <div>
                                    <Label className="text-[10px]">Reference No. / Receipt</Label>
                                    <Input
                                      name="reference_number"
                                      placeholder="e.g. GCash Ref 10029384"
                                      className="h-7 text-xs mt-0.5"
                                    />
                                  </div>
                                  <Button type="submit" variant="secondary" size="sm" className="w-full h-7 text-xs font-bold">
                                    Issue {formatMinorUnitsToPHP(req.requested_refund_minor)} Refund
                                  </Button>
                                </form>
                              </div>
                            )}
                          </div>
                        </details>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <RotateCcw className="size-8 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="font-bold text-sm">No return requests found</p>
                    <p className="text-xs">Customer return and exchange submissions will appear in this workspace.</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
