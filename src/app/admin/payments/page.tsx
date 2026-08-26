import { redirect } from "next/navigation";

import { getAdminAuthContext } from "@/lib/admin/auth";
import { approveGcashSubmission, rejectGcashSubmission } from "@/lib/admin/actions";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import Link from "next/link";
import { logServerError } from "@/lib/server-log";
import { createServiceClient } from "@/lib/supabase/server";

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

  // Fetch pending submissions and recent payment history
  const { data: submissions, error: submissionsError } = await serviceClient
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
    .limit(50);

  if (submissionsError) {
    logServerError("admin.payments.list", "database_failure");
    throw new Error("ADMIN_PAYMENTS_UNAVAILABLE");
  }
  const submissionList = submissions || [];

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1>Payment Verification Queue</h1>
        <p className="subtle-text">Review and verify Manual GCash payments using canonical transactional RPCs.</p>
      </header>

      {notice && (
        <div className="notice" role="status" style={{ marginBottom: "1.5rem" }}>
          {notice === "gcash_approved" && "GCash payment approved successfully. Reservations consumed and payment transitioned to PAID."}
          {notice === "gcash_rejected" && "GCash payment rejected. Customer may resubmit while reservation remains active."}
          {notice === "cod_settled" && "COD payment marked settled as PAID."}
        </div>
      )}

      {error && (
        <div className="error" role="alert" style={{ marginBottom: "1.5rem" }}>
          Error: {error}
        </div>
      )}

      <div className="admin-card">
        <h2>Manual GCash Submissions ({submissionList.length})</h2>

        {submissionList.length === 0 ? (
          <p className="subtle-text" style={{ padding: "1.5rem 0" }}>
            No payment submissions found in queue.
          </p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Submitted At</th>
                  <th>Claimed Amount</th>
                  <th>Ref No.</th>
                  <th>Receipt Proof</th>
                  <th>Review Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissionList.map((sub) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const payment = sub.payments as any;
                  const order = payment?.orders;
                  const isPending = sub.review_status === "PENDING" || sub.review_status === "VERIFYING";

                  return (
                    <tr key={sub.id}>
                      <td>
                        <strong>{order?.order_number || "Order"}</strong>
                        <div className="subtle-text small-text">{order?.customer_email}</div>
                      </td>
                      <td>{new Date(sub.created_at).toLocaleString()}</td>
                      <td><strong>{formatMinorUnitsToPHP(sub.claimed_amount_minor)}</strong></td>
                      <td><code>{sub.reference_number || "None"}</code></td>
                      <td>
                        {sub.receipt_storage_path ? (
                          <Link
                            href={`/admin/payments/receipts/${sub.id}`}
                            className="btn btn-secondary small-btn"
                          >
                            View Receipt &rarr;
                          </Link>
                        ) : (
                          <span className="subtle-text small-text">No image</span>
                        )}
                      </td>
                      <td>
                        <span className={`status-pill status-${sub.review_status.toLowerCase()}`}>
                          {sub.review_status}
                        </span>
                      </td>
                      <td>
                        {isPending ? (
                          <div className="admin-action-forms" style={{ display: "flex", gap: "0.5rem" }}>
                            <form action={approveGcashSubmission}>
                              <input type="hidden" name="payment_id" value={sub.payment_id} />
                              <input type="hidden" name="submission_id" value={sub.id} />
                              <button type="submit" className="btn btn-primary small-btn">
                                Approve (PAID)
                              </button>
                            </form>

                            <form action={rejectGcashSubmission} style={{ display: "flex", gap: "0.25rem" }}>
                              <input type="hidden" name="payment_id" value={sub.payment_id} />
                              <input type="hidden" name="submission_id" value={sub.id} />
                              <input
                                type="text"
                                name="rejection_reason"
                                placeholder="Rejection reason..."
                                required
                                className="small-input"
                              />
                              <button type="submit" className="btn btn-secondary small-btn btn-danger-tone">
                                Reject
                              </button>
                            </form>
                          </div>
                        ) : (
                          <span className="subtle-text small-text">Completed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
