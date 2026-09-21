"use client";

import * as React from "react";
import Link from "next/link";
import { 
  AlertCircle, 
  AlertTriangle, 
  Check, 
  CheckCircle2, 
  Copy, 
  ExternalLink, 
  FileText, 
  RotateCw, 
  ShieldAlert, 
  ShieldCheck, 
  X, 
  XCircle, 
  ZoomIn, 
  ZoomOut 
} from "lucide-react";

import { formatMinorUnitsToPHP } from "@/lib/money";
import { approveGcashSubmission, rejectGcashSubmission, expireGcashPayment } from "@/lib/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchField } from "@/components/admin/search-field";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface PaymentSubmissionItem {
  id: string;
  payment_id: string;
  submitted_by: string | null;
  claimed_amount_minor: number;
  reference_number: string | null;
  receipt_storage_path: string;
  review_status: string;
  created_at: string;
  payments: {
    id: string;
    order_id: string;
    method: string;
    status: string;
    amount_minor: number;
    orders: {
      id: string;
      order_number: string;
      customer_email: string;
      recipient_name: string;
    } | null;
  } | null;
}

export interface ExpiredPaymentItem {
  payment_id: string;
  order_id: string;
  order_number: string;
  customer_email: string;
  recipient_name: string;
  amount_minor: number;
  payment_status: string;
  reservation_expires_at: string;
  active_reservation_count: number;
}

interface PaymentReviewWorkspaceProps {
  submissions: PaymentSubmissionItem[];
  expiredPayments: ExpiredPaymentItem[];
}

export function PaymentReviewWorkspace({
  submissions,
  expiredPayments,
}: PaymentReviewWorkspaceProps) {
  const [selectedSubmissionId, setSelectedSubmissionId] = React.useState<string | null>(
    submissions.find((submission) => submission.review_status === "PENDING" || submission.review_status === "VERIFYING")?.id || null
  );
  const [selectedExpiredPaymentId, setSelectedExpiredPaymentId] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string>("PENDING");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [zoomLevel, setZoomLevel] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [copiedRef, setCopiedRef] = React.useState(false);

  // Dialog states for confirmations
  const [confirmApproveOpen, setConfirmApproveOpen] = React.useState(false);
  const [confirmRejectOpen, setConfirmRejectOpen] = React.useState(false);
  const [confirmExpireOpen, setConfirmExpireOpen] = React.useState(false);
  const [rejectionReason, setRejectionReason] = React.useState("");

  // Filter submissions
  const filteredSubmissions = React.useMemo(() => {
    return submissions.filter((sub) => {
      const payment = sub.payments;
      const order = payment?.orders;
      const q = searchQuery.toLowerCase().trim();

      const matchesSearch = !q ||
        order?.order_number?.toLowerCase().includes(q) ||
        order?.customer_email?.toLowerCase().includes(q) ||
        order?.recipient_name?.toLowerCase().includes(q) ||
        sub.reference_number?.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (statusFilter === "ALL") return true;
      if (statusFilter === "PENDING") {
        return sub.review_status === "PENDING" || sub.review_status === "VERIFYING";
      }
      return sub.review_status === statusFilter;
    });
  }, [submissions, statusFilter, searchQuery]);

  React.useEffect(() => {
    if (selectedExpiredPaymentId) return;
    if (filteredSubmissions.some((submission) => submission.id === selectedSubmissionId)) return;
    setSelectedSubmissionId(filteredSubmissions[0]?.id ?? null);
  }, [filteredSubmissions, selectedExpiredPaymentId, selectedSubmissionId]);

  // Selected submission details
  const selectedSubmission = React.useMemo(() => {
    return submissions.find((s) => s.id === selectedSubmissionId) || null;
  }, [submissions, selectedSubmissionId]);

  // Selected expired item
  const selectedExpired = React.useMemo(() => {
    return expiredPayments.find((p) => p.payment_id === selectedExpiredPaymentId) || null;
  }, [expiredPayments, selectedExpiredPaymentId]);

  const activeMode = selectedExpiredPaymentId ? "EXPIRED" : "SUBMISSION";

  const handleCopyRef = (refNo: string) => {
    navigator.clipboard.writeText(refNo);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const pendingCount = submissions.filter(
    (s) => s.review_status === "PENDING" || s.review_status === "VERIFYING"
  ).length;
  const approvedCount = submissions.filter((s) => s.review_status === "APPROVED").length;
  const rejectedCount = submissions.filter((s) => s.review_status === "REJECTED").length;
  const totalSubmissionsCount = submissions.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* ── Left Column: Payment Queue (5 cols) ── */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        {/* Search & Status Filter */}
        <div className="space-y-3">
          <div>
            <SearchField
              placeholder="Search orders, references, customers…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery("")}
              aria-label="Search payment submissions"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Button
              type="button"
              variant={statusFilter === "PENDING" && !selectedExpiredPaymentId ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setStatusFilter("PENDING");
                setSelectedExpiredPaymentId(null);
              }}
              className="h-9 text-xs rounded-lg shrink-0 gap-1.5"
            >
              <span>Awaiting</span>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono">
                {pendingCount}
              </Badge>
            </Button>

            <Button
              type="button"
              variant={statusFilter === "ALL" && !selectedExpiredPaymentId ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setStatusFilter("ALL");
                setSelectedExpiredPaymentId(null);
              }}
              className="h-9 text-xs rounded-lg shrink-0 gap-1.5"
            >
              <span>All</span>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono">
                {totalSubmissionsCount}
              </Badge>
            </Button>

            <Button
              type="button"
              variant={statusFilter === "APPROVED" && !selectedExpiredPaymentId ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setStatusFilter("APPROVED");
                setSelectedExpiredPaymentId(null);
              }}
              className="h-9 text-xs rounded-lg shrink-0 gap-1.5"
            >
              <span>Approved</span>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono">
                {approvedCount}
              </Badge>
            </Button>

            <Button
              type="button"
              variant={statusFilter === "REJECTED" && !selectedExpiredPaymentId ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setStatusFilter("REJECTED");
                setSelectedExpiredPaymentId(null);
              }}
              className="h-9 text-xs rounded-lg shrink-0 gap-1.5"
            >
              <span>Rejected</span>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono">
                {rejectedCount}
              </Badge>
            </Button>

            {expiredPayments.length > 0 && (
              <Button
                type="button"
                variant={selectedExpiredPaymentId ? "destructive" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedExpiredPaymentId(expiredPayments[0].payment_id);
                }}
                className="h-9 text-xs rounded-lg shrink-0 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                <span>Expired</span>
                <Badge variant="destructive" className="px-1.5 py-0 text-[10px] font-mono">
                  {expiredPayments.length}
                </Badge>
              </Button>
            )}
          </div>
        </div>

        {/* Expired Unresolved Queue Cards */}
        {selectedExpiredPaymentId && (
          <div className="space-y-2">
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-bold">
              Expired Unresolved Queue ({expiredPayments.length})
            </p>
            {expiredPayments.map((exp) => {
              const isSelected = exp.payment_id === selectedExpiredPaymentId;
              return (
                <div
                  key={exp.payment_id}
                  onClick={() => setSelectedExpiredPaymentId(exp.payment_id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedExpiredPaymentId(exp.payment_id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Review expired payment for order ${exp.order_number}`}
                  className={`cursor-pointer rounded-xl border-2 p-4 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring ${
                    isSelected
                      ? "border-destructive bg-destructive/5 shadow-xs"
                      : "border-border bg-card hover:border-foreground/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-foreground">
                        Order #{exp.order_number}
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5">{exp.customer_email}</p>
                    </div>
                    <Badge variant="destructive" className="font-mono text-[10px]">
                      EXPIRED
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-border">
                    <span className="font-mono font-bold text-foreground">
                      {formatMinorUnitsToPHP(exp.amount_minor)}
                    </span>
                    <span className="text-muted-foreground font-mono text-[10px]">
                      Reservations: {exp.active_reservation_count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Submissions Queue Cards */}
        {!selectedExpiredPaymentId && (
          <div className="space-y-2.5 lg:max-h-[calc(100vh-280px)] lg:overflow-y-auto lg:pr-1">
            {filteredSubmissions.map((sub) => {
              const isSelected = sub.id === selectedSubmissionId;
              const payment = sub.payments;
              const order = payment?.orders;

              return (
                <div
                  key={sub.id}
                  onClick={() => setSelectedSubmissionId(sub.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedSubmissionId(sub.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Review payment submission for order ${order?.order_number || "unknown"}`}
                  className={`cursor-pointer rounded-xl border-2 p-4 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring ${
                    isSelected
                      ? "border-foreground bg-muted/40 shadow-xs"
                      : "border-border bg-card hover:border-foreground/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-bold text-foreground block truncate">
                        Order #{order?.order_number || "—"}
                      </span>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {order?.recipient_name || order?.customer_email}
                      </p>
                    </div>
                    <Badge
                      variant={
                        sub.review_status === "APPROVED"
                          ? "default"
                          : sub.review_status === "REJECTED"
                          ? "destructive"
                          : "secondary"
                      }
                      className="font-mono text-[10px] shrink-0 uppercase tracking-wide"
                    >
                      {sub.review_status}
                    </Badge>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-border">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Claimed</p>
                      <p className="font-mono font-bold text-foreground">
                        {formatMinorUnitsToPHP(sub.claimed_amount_minor)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground">Reference</p>
                      <p className="font-mono text-xs text-foreground font-medium truncate max-w-[120px]">
                        {sub.reference_number || "None"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredSubmissions.length === 0 && (
              <div className="p-8 text-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
                <CheckCircle2 className="size-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm font-medium">No submissions match active filter</p>
                <p className="text-xs mt-1">Try switching tabs or clearing your search query.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right Column: Active Inspection & Decision Workspace (7 cols) ── */}
      <div className="lg:col-span-7">
        {/* If viewing expired payment */}
        {activeMode === "EXPIRED" && selectedExpired && (
          <Card className="border-border shadow-md">
            <CardHeader className="py-4 px-6 border-b border-border bg-destructive/5 flex flex-row items-center justify-between">
              <div>
                <Badge variant="destructive" className="font-mono text-xs">EXPIRED TIMEOUT</Badge>
                <CardTitle className="text-xl font-bold mt-1">Order #{selectedExpired.order_number}</CardTitle>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/orders/${selectedExpired.order_id}`}>
                  View Full Order <ExternalLink className="size-3.5 ml-1" />
                </Link>
              </Button>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-xl border border-border">
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-bold">{selectedExpired.recipient_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedExpired.customer_email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Expected Amount</p>
                  <p className="font-mono font-black text-lg text-foreground">
                    {formatMinorUnitsToPHP(selectedExpired.amount_minor)}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <ShieldAlert className="size-4" />
                  <span>Expired Reservation Hold</span>
                </div>
                <p className="text-xs leading-relaxed opacity-90">
                  This Manual GCash order had a 2-hour payment window that has expired without an approved receipt. 
                  Finalizing timeout will return reserved inventory to active stock and transition the order to CANCELLED.
                </p>
              </div>

              <Button
                type="button"
                variant="destructive"
                size="lg"
                onClick={() => setConfirmExpireOpen(true)}
                className="w-full h-12 text-sm font-bold uppercase tracking-wide gap-2 shadow-md"
              >
                <XCircle className="size-4" />
                <span>Finalize & Cancel Expired Order</span>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* If viewing submission review */}
        {activeMode === "SUBMISSION" && selectedSubmission && (
          <Card className="border-border shadow-md">
            <CardHeader className="py-4 px-6 border-b border-border bg-muted/20 flex flex-row items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      selectedSubmission.review_status === "APPROVED"
                        ? "default"
                        : selectedSubmission.review_status === "REJECTED"
                        ? "destructive"
                        : "secondary"
                    }
                    className="font-mono text-[10px] uppercase"
                  >
                    {selectedSubmission.review_status}
                  </Badge>
                  <span className="text-xs font-mono text-muted-foreground">
                    {new Date(selectedSubmission.created_at).toLocaleString()}
                  </span>
                </div>
                <CardTitle className="text-xl font-bold mt-1">
                  Order #{selectedSubmission.payments?.orders?.order_number || "—"}
                </CardTitle>
              </div>

              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/orders/${selectedSubmission.payments?.orders?.id}`}>
                  Order Details <ExternalLink className="size-3.5 ml-1" />
                </Link>
              </Button>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Financial & Reference Comparison Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-muted/30 border border-border rounded-xl text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Expected Amount</p>
                  <p className="font-mono font-bold text-base text-foreground mt-0.5">
                    {formatMinorUnitsToPHP(selectedSubmission.payments?.amount_minor || 0)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Claimed Amount</p>
                  <p className="font-mono font-bold text-base text-foreground mt-0.5 flex items-center gap-1.5">
                    {formatMinorUnitsToPHP(selectedSubmission.claimed_amount_minor)}
                    {selectedSubmission.claimed_amount_minor === selectedSubmission.payments?.amount_minor ? (
                      <span title="Exact match">
                        <Check className="size-4 text-emerald-600" />
                      </span>
                    ) : (
                      <span title="Amount mismatch">
                        <AlertTriangle className="size-4 text-amber-500" />
                      </span>
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">GCash Reference No.</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <p className="font-mono text-sm font-bold text-foreground truncate">
                      {selectedSubmission.reference_number || "None"}
                    </p>
                    {selectedSubmission.reference_number && (
                      <button
                        type="button"
                        onClick={() => handleCopyRef(selectedSubmission.reference_number || "")}
                        className="text-muted-foreground hover:text-foreground p-1"
                        aria-label="Copy reference number"
                      >
                        {copiedRef ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Large Receipt Preview Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-mono text-xs uppercase tracking-wider text-muted-foreground font-bold">
                    Submitted Payment Screenshot
                  </h4>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setZoomLevel((prev) => Math.max(0.75, prev - 0.25))}
                      className="size-8"
                      aria-label="Zoom out"
                    >
                      <ZoomOut className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setZoomLevel((prev) => Math.min(2.5, prev + 0.25))}
                      className="size-8"
                      aria-label="Zoom in"
                    >
                      <ZoomIn className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setRotation((prev) => (prev + 90) % 360)}
                      className="size-8"
                      aria-label="Rotate"
                    >
                      <RotateCw className="size-3.5" />
                    </Button>
                    <Button asChild variant="outline" size="sm" className="h-8 text-xs ml-1">
                      <a
                        href={`/admin/payments/receipts/${selectedSubmission.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open Full ↗
                      </a>
                    </Button>
                  </div>
                </div>

                <div className="relative w-full h-[400px] sm:h-[480px] rounded-xl border-2 border-border bg-neutral-950 overflow-hidden flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/admin/payments/receipts/${selectedSubmission.id}`}
                    alt="Customer Receipt Proof"
                    style={{
                      transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                      transition: "transform 0.2s ease",
                    }}
                    className="max-h-full max-w-full object-contain cursor-grab active:cursor-grabbing"
                  />
                </div>
              </div>

              {/* Action Decision Controls (If pending) */}
              {(selectedSubmission.review_status === "PENDING" ||
                selectedSubmission.review_status === "VERIFYING") && (
                <div className="pt-4 border-t border-border flex flex-col sm:flex-row gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => setConfirmRejectOpen(true)}
                    className="h-12 text-destructive border-destructive/30 hover:bg-destructive/10 flex-1 font-bold text-xs uppercase"
                  >
                    <X className="size-4 mr-2" />
                    Reject Submission
                  </Button>

                  <Button
                    type="button"
                    variant="default"
                    size="lg"
                    onClick={() => setConfirmApproveOpen(true)}
                    className="h-12 flex-1 font-bold text-xs uppercase gap-2 shadow-md"
                  >
                    <ShieldCheck className="size-4" />
                    Approve Payment (PAID)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!selectedSubmission && !selectedExpired && filteredSubmissions.length > 0 && (
          <div className="p-16 text-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
            <FileText className="size-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-base font-bold">Select a payment</p>
            <p className="mt-1 text-xs">Choose a submission to inspect its receipt and verification details.</p>
          </div>
        )}
      </div>

      {/* ── Confirmation Dialog: Approve ── */}
      {selectedSubmission && (
        <Dialog open={confirmApproveOpen} onOpenChange={setConfirmApproveOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-600" />
                Approve GCash Payment
              </DialogTitle>
              <DialogDescription>
                Confirm that you have reviewed the customer receipt and verified the transaction in your merchant GCash app.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3 text-sm">
              <div className="flex justify-between p-3 bg-muted rounded-lg font-mono text-xs">
                <span>Order Total:</span>
                <span className="font-bold">{formatMinorUnitsToPHP(selectedSubmission.payments?.amount_minor || 0)}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This action will consume inventory reservations, transition payment status to <strong>PAID</strong>, and write an immutable audit log.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmApproveOpen(false)}>
                Cancel
              </Button>
              <form action={approveGcashSubmission}>
                <input type="hidden" name="payment_id" value={selectedSubmission.payment_id} />
                <input type="hidden" name="submission_id" value={selectedSubmission.id} />
                <Button type="submit" className="font-bold">
                  Confirm &amp; Mark as PAID
                </Button>
              </form>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Confirmation Dialog: Reject ── */}
      {selectedSubmission && (
        <Dialog open={confirmRejectOpen} onOpenChange={setConfirmRejectOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="size-5" />
                Reject GCash Proof
              </DialogTitle>
              <DialogDescription>
                Please provide a reason so the customer knows what to correct on their resubmission.
              </DialogDescription>
            </DialogHeader>

            <form action={rejectGcashSubmission} className="space-y-4">
              <input type="hidden" name="payment_id" value={selectedSubmission.payment_id} />
              <input type="hidden" name="submission_id" value={selectedSubmission.id} />

              <div className="space-y-2">
                <Label htmlFor="reject_reason" className="text-xs font-bold">
                  Rejection Reason *
                </Label>
                <Input
                  id="reject_reason"
                  name="rejection_reason"
                  placeholder="e.g. Unreadable screenshot / Reference number mismatch"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  required
                  className="h-10"
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setConfirmRejectOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" disabled={!rejectionReason.trim()}>
                  Confirm Rejection
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Confirmation Dialog: Expire ── */}
      {selectedExpired && (
        <Dialog open={confirmExpireOpen} onOpenChange={setConfirmExpireOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <XCircle className="size-5" />
                Finalize Expired GCash Payment
              </DialogTitle>
              <DialogDescription>
                This will release the active inventory reservations back to available stock and cancel Order #{selectedExpired.order_number}.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmExpireOpen(false)}>
                Cancel
              </Button>
              <form action={expireGcashPayment}>
                <input type="hidden" name="payment_id" value={selectedExpired.payment_id} />
                <Button type="submit" variant="destructive">
                  Release Stock &amp; Cancel Order
                </Button>
              </form>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
