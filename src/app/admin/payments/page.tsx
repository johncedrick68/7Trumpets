import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, ShieldCheck, XCircle } from "lucide-react";

import { getAdminAuthContext } from "@/lib/admin/auth";
import { approveGcashSubmission, expireGcashPayment, rejectGcashSubmission } from "@/lib/admin/actions";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import { logServerError } from "@/lib/server-log";
import { createClient, createServiceClient } from "@/lib/supabase/server";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

interface SearchParams {
  notice?: string;
  error?: string;
}

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
      .limit(50),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.rpc as any)("list_expired_gcash_payments"),
  ]);

  if (submissionsRes.error) {
    logServerError("admin.payments.list", "database_failure");
    throw new Error("ADMIN_PAYMENTS_UNAVAILABLE");
  }

  const submissionList = submissionsRes.data || [];
  const pendingCount = submissionList.filter((submission) => submission.review_status === "PENDING" || submission.review_status === "VERIFYING").length;

  const expiredList = (expiredRes.data || []) as Array<{
    payment_id: string;
    order_id: string;
    order_number: string;
    customer_email: string;
    recipient_name: string;
    amount_minor: number;
    payment_status: string;
    reservation_expires_at: string;
    active_reservation_count: number;
  }>;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">Operations · AAL2 required</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Payment Verification</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Verify evidence before approving. A receipt is customer-provided evidence, not proof of payment on its own.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {expiredList.length > 0 && (
            <Badge variant="destructive" className="w-fit font-mono text-xs">{expiredList.length} expired unresolved</Badge>
          )}
          <Badge variant={pendingCount > 0 ? "default" : "secondary"} className="w-fit font-mono text-xs">{pendingCount} awaiting review</Badge>
        </div>
      </header>

      {notice && (
        <div className="p-4 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {notice === "gcash_approved" && "GCash payment approved successfully. Reservations consumed and payment transitioned to PAID."}
          {notice === "gcash_rejected" && "GCash payment rejected. Customer may resubmit while reservation remains active."}
          {notice === "gcash_expired" && "Expired Manual GCash order resolved. Inventory reservations released and order cancelled."}
          {notice === "cod_settled" && "COD payment marked settled as PAID."}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-md bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-2">
          <XCircle className="w-4 h-4" />
          Error: {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            Manual GCash Submissions
            <Badge variant="secondary" className="ml-2 font-mono">{submissionList.length}</Badge>
          </CardTitle>
          <CardDescription>Verify customer-submitted GCash reference numbers and receipts.</CardDescription>
        </CardHeader>
        
        {submissionList.length === 0 ? (
          <CardContent className="border-t border-dashed py-12 text-center text-muted-foreground">
            No Manual GCash submissions have been received yet.
          </CardContent>
        ) : (
          <>
          <div className="divide-y border-t md:hidden">
            {submissionList.map((sub) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const payment = sub.payments as any;
              const order = payment?.orders;
              const isPending = sub.review_status === "PENDING" || sub.review_status === "VERIFYING";
              const reviewVariant = sub.review_status === "APPROVED" ? "default" : sub.review_status === "REJECTED" ? "destructive" : "secondary";
              return <article key={sub.id} className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3"><div><Link href={`/admin/orders/${order?.id}`} className="font-mono text-sm font-semibold underline-offset-4 hover:underline">Order {order?.order_number || "—"}</Link><p className="mt-1 text-sm text-muted-foreground">{order?.recipient_name || order?.customer_email || "Customer unavailable"}</p></div><Badge variant={reviewVariant} className="text-[10px] uppercase">{sub.review_status}</Badge></div>
                <div className="grid grid-cols-2 gap-3 border-y py-3 text-sm"><div><p className="text-xs text-muted-foreground">Claimed amount</p><p className="font-mono font-semibold">{formatMinorUnitsToPHP(sub.claimed_amount_minor)}</p></div><div><p className="text-xs text-muted-foreground">Reference no.</p><p className="break-all font-mono text-xs font-medium">{sub.reference_number || "Not provided"}</p></div></div>
                <p className="text-xs text-muted-foreground">Submitted {new Date(sub.created_at).toLocaleString()}</p>
                {sub.receipt_storage_path ? <Button asChild variant="outline" className="w-full"><Link href={`/admin/payments/receipts/${sub.id}`}>Review receipt <ArrowRight className="ml-2 size-4" aria-hidden="true" /></Link></Button> : <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No receipt image was provided.</p>}
                {isPending ? <div className="space-y-3 rounded-md bg-muted/40 p-3"><p className="text-sm font-medium">Decision</p><form action={approveGcashSubmission}><input type="hidden" name="payment_id" value={sub.payment_id} /><input type="hidden" name="submission_id" value={sub.id} /><Button type="submit" className="w-full">Approve payment as PAID</Button></form><form action={rejectGcashSubmission} className="space-y-2"><input type="hidden" name="payment_id" value={sub.payment_id} /><input type="hidden" name="submission_id" value={sub.id} /><Input type="text" name="rejection_reason" placeholder="Reason for rejection" required /><Button type="submit" variant="destructive" className="w-full">Reject submission</Button></form></div> : <p className="text-sm text-muted-foreground">Review complete — no further action available.</p>}
              </article>;
            })}
          </div>
          <div className="hidden border-t md:block md:overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Order</TableHead>
                  <TableHead>Submitted At</TableHead>
                  <TableHead className="text-right">Claimed Amount</TableHead>
                  <TableHead className="font-mono">Ref No.</TableHead>
                  <TableHead>Receipt Proof</TableHead>
                  <TableHead>Review Status</TableHead>
                  <TableHead className="text-center min-w-[200px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissionList.map((sub) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const payment = sub.payments as any;
                  const order = payment?.orders;
                  const isPending = sub.review_status === "PENDING" || sub.review_status === "VERIFYING";

                  return (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <Link href={`/admin/orders/${order?.id}`} className="font-medium hover:underline text-primary">
                          {order?.order_number || "Order"}
                        </Link>
                        <div className="text-xs text-muted-foreground">{order?.customer_email}</div>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {new Date(sub.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMinorUnitsToPHP(sub.claimed_amount_minor)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {sub.reference_number || "None"}
                      </TableCell>
                      <TableCell>
                        {sub.receipt_storage_path ? (
                          <Button asChild variant="outline" size="sm" className="h-8 text-xs">
                            <Link href={`/admin/payments/receipts/${sub.id}`}>
                              View Receipt <ArrowRight className="w-3 h-3 ml-1" />
                            </Link>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">No image</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          sub.review_status === "APPROVED" ? "default" :
                          sub.review_status === "REJECTED" ? "destructive" :
                          "secondary"
                        } className="capitalize">
                          {sub.review_status.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isPending ? (
                          <div className="flex flex-col gap-2">
                            <form action={approveGcashSubmission}>
                              <input type="hidden" name="payment_id" value={sub.payment_id} />
                              <input type="hidden" name="submission_id" value={sub.id} />
                            <Button type="submit" size="sm" className="h-9 w-full text-xs">
                                Approve (PAID)
                              </Button>
                            </form>

                            <form action={rejectGcashSubmission} className="flex gap-2">
                              <input type="hidden" name="payment_id" value={sub.payment_id} />
                              <input type="hidden" name="submission_id" value={sub.id} />
                              <Input
                                type="text"
                                name="rejection_reason"
                                placeholder="Reason..."
                                required
                                className="h-9 min-w-[120px] flex-1 text-xs"
                              />
                              <Button type="submit" variant="destructive" size="sm" className="h-9 text-xs">
                                Reject
                              </Button>
                            </form>
                          </div>
                        ) : (
                          <div className="text-center text-sm text-muted-foreground italic">Completed</div>
                        )}
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
                    <input type="hidden" name="return_to" value="/admin/payments" />
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
                          <input type="hidden" name="return_to" value="/admin/payments" />
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
