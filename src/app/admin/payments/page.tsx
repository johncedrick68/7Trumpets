import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

import { getAdminAuthContext } from "@/lib/admin/auth";
import { expireGcashPayment } from "@/lib/admin/actions";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import { logServerError } from "@/lib/server-log";
import { createClient, createServiceClient } from "@/lib/supabase/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  PaymentReviewWorkspace, 
  PaymentSubmissionItem, 
  ExpiredPaymentItem 
} from "@/components/admin/payment-review-workspace";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export const dynamic = "force-dynamic";

interface SearchParams {
  notice?: string;
  error?: string;
}

const paymentErrorMessages: Record<string, string> = {
  missing_parameters: "The payment review request was incomplete. Refresh and try again.",
  approval_failed: "The payment could not be approved. Its state may have changed; refresh before retrying.",
  rejection_reason_required: "Add a clear rejection reason before rejecting this proof.",
  rejection_failed: "The payment proof could not be rejected. Refresh and confirm its current state.",
  missing_payment_id: "The payment record could not be identified.",
  expiration_failed: "The expired payment could not be resolved. Refresh and try again.",
};

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const adminCtx = await getAdminAuthContext();
  if (!adminCtx) {
    redirect("/login?next=/admin/payments");
  }

  const { notice, error } = await searchParams;
  const serviceClient = createServiceClient();
  const supabase = await createClient();

  // Fetch pending submissions and database-eligible expired GCash payments
  const [submissionsRes, expiredRes] = await Promise.all([
    serviceClient
      .from("payment_submissions")
      .select(`
        id,
        payment_id,
        submitted_by,
        claimed_amount_minor,
        reference_number,
        receipt_storage_path,
        review_status,
        created_at,
        payments!inner (
          id,
          order_id,
          method,
          status,
          amount_minor,
          orders (
            id,
            order_number,
            customer_email,
            recipient_name
          )
        )
      `)
      .order("created_at", { ascending: false })
      .limit(100),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.rpc as any)("list_expired_gcash_payments"),
  ]);

  if (submissionsRes.error) {
    logServerError("admin.payments.list", "database_failure");
    throw new Error("ADMIN_PAYMENTS_UNAVAILABLE");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawSubmissions = (submissionsRes.data || []) as any[];
  const submissionList: PaymentSubmissionItem[] = rawSubmissions.map((s) => ({
    id: s.id,
    payment_id: s.payment_id,
    submitted_by: s.submitted_by,
    claimed_amount_minor: s.claimed_amount_minor,
    reference_number: s.reference_number,
    receipt_storage_path: s.receipt_storage_path,
    review_status: s.review_status,
    created_at: s.created_at,
    payments: s.payments,
  }));

  const pendingCount = submissionList.filter(
    (submission) => submission.review_status === "PENDING" || submission.review_status === "VERIFYING"
  ).length;

  const expiredList = (expiredRes.data || []) as ExpiredPaymentItem[];

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Operations · AAL2 required"
        title="Payment Verification"
        description="Compare claimed amounts, inspect receipts, and verify GCash transfers before approving."
        actions={<>
          {expiredList.length > 0 && (
            <Badge variant="destructive" className="w-fit font-mono text-xs">
              {expiredList.length} expired unresolved
            </Badge>
          )}
          <Badge variant={pendingCount > 0 ? "default" : "secondary"} className="w-fit font-mono text-xs">
            {pendingCount} awaiting review
          </Badge>
        </>}
      />

      {notice && (
        <div className="p-4 rounded-lg bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400 flex items-center gap-2 text-sm">
          <CheckCircle2 className="size-4 shrink-0" />
          {notice === "gcash_approved" && "GCash payment approved successfully. Reservations consumed and payment transitioned to PAID."}
          {notice === "gcash_rejected" && "GCash payment rejected. Customer may resubmit while reservation remains active."}
          {notice === "gcash_expired" && "Expired Manual GCash order resolved. Inventory reservations released and order cancelled."}
          {notice === "cod_settled" && "COD payment marked settled as PAID."}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-2 text-sm">
          <XCircle className="size-4 shrink-0" />
          {paymentErrorMessages[error] ?? "The payment operation could not be completed. Refresh and try again."}
        </div>
      )}

      {/* Split-Pane Verification Workspace */}
      <PaymentReviewWorkspace
        submissions={submissionList}
        expiredPayments={expiredList}
      />

      {/* Database-Authoritative Expired Unresolved GCash Orders Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Expired Unresolved GCash Orders
            <Badge variant={expiredList.length > 0 ? "destructive" : "secondary"} className="ml-2 font-mono">
              {expiredList.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            Orders with active inventory reservations that have expired without proof or after rejection. Expiring releases stock and cancels the order.
          </CardDescription>
        </CardHeader>

        {expiredList.length === 0 ? (
          <CardContent className="border-t border-dashed py-8 text-center text-sm text-muted-foreground">
            No expired unresolved GCash orders awaiting resolution.
          </CardContent>
        ) : (
          <>
            <div className="divide-y border-t md:hidden">
              {expiredList.map((exp) => (
                <article key={exp.payment_id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/admin/orders/${exp.order_id}`} className="font-mono text-sm font-semibold underline-offset-4 hover:underline">
                        Order {exp.order_number}
                      </Link>
                      <p className="mt-1 text-sm text-muted-foreground">{exp.recipient_name || exp.customer_email}</p>
                    </div>
                    <Badge variant="destructive" className="text-[10px] uppercase">
                      Expired ({exp.payment_status})
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 border-y py-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Amount</p>
                      <p className="font-mono font-semibold">{formatMinorUnitsToPHP(exp.amount_minor)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Active Holds</p>
                      <p className="font-mono text-xs">{exp.active_reservation_count} item(s)</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Expired {new Date(exp.reservation_expires_at).toLocaleString()}
                  </p>
                  <form action={expireGcashPayment} className="pt-1">
                    <input type="hidden" name="payment_id" value={exp.payment_id} />
                    <Button type="submit" variant="destructive" size="sm" className="w-full text-xs">
                      Expire &amp; Release Stock
                    </Button>
                  </form>
                </article>
              ))}
            </div>
            <div className="hidden border-t md:block md:overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Payment State</TableHead>
                    <TableHead>Expired At</TableHead>
                    <TableHead className="text-center">Active Holds</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiredList.map((exp) => (
                    <TableRow key={exp.payment_id}>
                      <TableCell>
                        <Link href={`/admin/orders/${exp.order_id}`} className="font-medium hover:underline text-primary font-mono text-sm">
                          {exp.order_number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{exp.recipient_name}</div>
                        <div className="text-xs text-muted-foreground">{exp.customer_email}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMinorUnitsToPHP(exp.amount_minor)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {exp.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(exp.reservation_expires_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs">
                        {exp.active_reservation_count} item(s)
                      </TableCell>
                      <TableCell className="text-right">
                        <form action={expireGcashPayment}>
                          <input type="hidden" name="payment_id" value={exp.payment_id} />
                          <Button type="submit" variant="destructive" size="sm" className="h-8 text-xs">
                            Expire &amp; Release Stock
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
