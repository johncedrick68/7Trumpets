"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminAal2 } from "@/lib/admin/auth";
import { logServerError } from "@/lib/server-log";
import { createClient } from "@/lib/supabase/server";

export interface AdminActionResult {
  error?: string;
  success?: boolean;
}

/**
 * Approve a MANUAL_GCASH payment submission using canonical private.approve_gcash_submission RPC.
 * Atomically consumes inventory reservations, updates payment to PAID, and records audit logs.
 */
export async function approveGcashSubmission(formData: FormData) {
  await requireAdminAal2("/admin/payments");

  const paymentId = formData.get("payment_id") as string;
  const submissionId = formData.get("submission_id") as string;
  const reason = (formData.get("reason") as string)?.trim() || undefined;

  if (!paymentId || !submissionId) {
    redirect("/admin/payments?error=missing_parameters");
  }

  const idempotencyKey = `gcash_appr_${paymentId}_${submissionId}_${Date.now()}_${randomUUID().replace(/-/g, "")}`;
  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("approve_gcash_submission", {
    p_payment_id: paymentId,
    p_submission_id: submissionId,
    p_idempotency_key: idempotencyKey,
    p_reason: reason,
  });

  if (rpcError) {
    logServerError("payment.approve", "database_rejection");
    redirect("/admin/payments?error=approval_failed");
  }

  revalidatePath("/admin/payments");
  revalidatePath("/admin/orders");
  redirect("/admin/payments?notice=gcash_approved");
}

/**
 * Reject a MANUAL_GCASH payment submission using canonical private.reject_gcash_submission RPC.
 * Preserves the order in CONFIRMED and allows customer resubmission while reservation deadline permits.
 */
export async function rejectGcashSubmission(formData: FormData) {
  await requireAdminAal2("/admin/payments");

  const paymentId = formData.get("payment_id") as string;
  const submissionId = formData.get("submission_id") as string;
  const reason = (formData.get("rejection_reason") as string)?.trim();

  if (!paymentId || !submissionId || !reason) {
    redirect("/admin/payments?error=rejection_reason_required");
  }

  const idempotencyKey = `gcash_rej_${paymentId}_${submissionId}_${Date.now()}_${randomUUID().replace(/-/g, "")}`;
  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("reject_gcash_submission", {
    p_payment_id: paymentId,
    p_submission_id: submissionId,
    p_rejection_reason: reason,
    p_idempotency_key: idempotencyKey,
  });

  if (rpcError) {
    logServerError("payment.reject", "database_rejection");
    redirect("/admin/payments?error=rejection_failed");
  }

  revalidatePath("/admin/payments");
  revalidatePath("/admin/orders");
  redirect("/admin/payments?notice=gcash_rejected");
}

/**
 * Settle a COD payment upon doorstep delivery using canonical private.settle_cod_payment RPC.
 * Requires that order reservations were consumed.
 */
export async function settleCodPayment(formData: FormData) {
  await requireAdminAal2("/admin/orders");

  const paymentId = formData.get("payment_id") as string;
  const orderId = formData.get("order_id") as string;
  const reason = (formData.get("reason") as string)?.trim() || "COD cash collected upon delivery";

  if (!paymentId) {
    redirect("/admin/payments?error=missing_payment_id");
  }

  const idempotencyKey = `cod_settle_${paymentId}_${Date.now()}_${randomUUID().replace(/-/g, "")}`;
  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("settle_cod_payment", {
    p_payment_id: paymentId,
    p_reason: reason,
    p_idempotency_key: idempotencyKey,
    p_metadata: {},
  });

  if (rpcError) {
    logServerError("payment.cod_settle", "database_rejection");
    redirect(`/admin/orders/${orderId || ""}?error=settlement_failed`);
  }

  revalidatePath("/admin/payments");
  revalidatePath("/admin/orders");
  redirect(`/admin/orders/${orderId || ""}?notice=cod_settled`);
}

/**
 * Transition order status along the canonical fulfillment lifecycle using public.transition_order RPC.
 */
export async function transitionOrderStatus(formData: FormData) {
  await requireAdminAal2("/admin/orders");

  const orderId = formData.get("order_id") as string;
  const toStatus = formData.get("to_status") as string;
  const note = (formData.get("note") as string)?.trim() || `Status updated to ${toStatus} by staff`;

  if (!orderId || !toStatus) {
    redirect(`/admin/orders/${orderId || ""}?error=missing_parameters`);
  }

  const idempotencyKey = `ord_trans_${orderId}_${toStatus}_${Date.now()}_${randomUUID().replace(/-/g, "")}`;
  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("admin_transition_order", {
    p_order_id: orderId,
    p_to_status: toStatus,
    p_note: note,
    p_source: "admin_dashboard",
    p_idempotency_key: idempotencyKey,
    p_metadata: {},
  });

  if (rpcError) {
    logServerError("order.transition", "database_rejection");
    redirect(`/admin/orders/${orderId}?error=invalid_transition`);
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  redirect(`/admin/orders/${orderId}?notice=status_updated`);
}

/**
 * Super-admin role assignment and revocation utilizing public.manage_user_role.
 * STRICTLY requires active AAL2 authentication level and super_admin role.
 */
export async function manageUserRole(formData: FormData) {
  const adminCtx = await requireAdminAal2("/admin/users");

  if (adminCtx.role !== "super_admin") {
    redirect("/admin/users?error=super_admin_required");
  }

  const targetUserId = formData.get("target_user_id") as string;
  const targetRole = formData.get("target_role") as string;
  const assign = formData.get("assign") === "true";

  if (!targetUserId || !targetRole || !["admin", "super_admin"].includes(targetRole)) {
    redirect("/admin/users?error=invalid_role_parameters");
  }

  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("manage_user_role", {
    p_user_id: targetUserId,
    p_role: targetRole,
    p_assign: assign,
  });

  if (rpcError) {
    logServerError("role.manage", "database_rejection");
    redirect("/admin/users?error=role_management_failed");
  }

  revalidatePath("/admin/users");
  redirect("/admin/users?notice=role_updated");
}
