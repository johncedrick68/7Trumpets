"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAdminAuthContext } from "@/lib/admin/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export interface AdminActionResult {
  error?: string;
  success?: boolean;
}

/**
 * Approve a MANUAL_GCASH payment submission using canonical private.approve_gcash_submission RPC.
 * Atomically consumes inventory reservations, updates payment to PAID, and records audit logs.
 */
export async function approveGcashSubmission(formData: FormData) {
  const adminCtx = await getAdminAuthContext();
  if (!adminCtx) {
    redirect("/login?next=/admin");
  }

  const paymentId = formData.get("payment_id") as string;
  const submissionId = formData.get("submission_id") as string;
  const reason = (formData.get("reason") as string)?.trim() || undefined;

  if (!paymentId || !submissionId) {
    redirect("/admin/payments?error=missing_parameters");
  }

  const idempotencyKey = `gcash_appr_${paymentId}_${submissionId}_${Date.now()}_${randomUUID().replace(/-/g, "")}`;
  const serviceClient = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: rpcError } = await (serviceClient as any).rpc("approve_gcash_submission", {
    p_payment_id: paymentId,
    p_submission_id: submissionId,
    p_reviewer_id: adminCtx.userId,
    p_idempotency_key: idempotencyKey,
    p_reason: reason,
  });

  if (rpcError) {
    redirect(`/admin/payments?error=${encodeURIComponent(rpcError.message || "approval_failed")}`);
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
  const adminCtx = await getAdminAuthContext();
  if (!adminCtx) {
    redirect("/login?next=/admin");
  }

  const paymentId = formData.get("payment_id") as string;
  const submissionId = formData.get("submission_id") as string;
  const reason = (formData.get("rejection_reason") as string)?.trim();

  if (!paymentId || !submissionId || !reason) {
    redirect("/admin/payments?error=rejection_reason_required");
  }

  const idempotencyKey = `gcash_rej_${paymentId}_${submissionId}_${Date.now()}_${randomUUID().replace(/-/g, "")}`;
  const serviceClient = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: rpcError } = await (serviceClient as any).rpc("reject_gcash_submission", {
    p_payment_id: paymentId,
    p_submission_id: submissionId,
    p_reviewer_id: adminCtx.userId,
    p_rejection_reason: reason,
    p_idempotency_key: idempotencyKey,
  });

  if (rpcError) {
    redirect(`/admin/payments?error=${encodeURIComponent(rpcError.message || "rejection_failed")}`);
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
  const adminCtx = await getAdminAuthContext();
  if (!adminCtx) {
    redirect("/login?next=/admin");
  }

  const paymentId = formData.get("payment_id") as string;
  const reason = (formData.get("reason") as string)?.trim() || "COD cash collected upon delivery";

  if (!paymentId) {
    redirect("/admin/payments?error=missing_payment_id");
  }

  const idempotencyKey = `cod_settle_${paymentId}_${Date.now()}_${randomUUID().replace(/-/g, "")}`;
  const serviceClient = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: rpcError } = await (serviceClient as any).rpc("settle_cod_payment", {
    p_payment_id: paymentId,
    p_actor_id: adminCtx.userId,
    p_reason: reason,
    p_idempotency_key: idempotencyKey,
    p_metadata: {},
  });

  if (rpcError) {
    redirect(`/admin/payments?error=${encodeURIComponent(rpcError.message || "settlement_failed")}`);
  }

  revalidatePath("/admin/payments");
  revalidatePath("/admin/orders");
  redirect("/admin/payments?notice=cod_settled");
}

/**
 * Transition order status along the canonical fulfillment lifecycle using public.transition_order RPC.
 */
export async function transitionOrderStatus(formData: FormData) {
  const adminCtx = await getAdminAuthContext();
  if (!adminCtx) {
    redirect("/login?next=/admin");
  }

  const orderId = formData.get("order_id") as string;
  const toStatus = formData.get("to_status") as string;
  const note = (formData.get("note") as string)?.trim() || `Status updated to ${toStatus} by staff`;

  if (!orderId || !toStatus) {
    redirect(`/admin/orders/${orderId || ""}?error=missing_parameters`);
  }

  const idempotencyKey = `ord_trans_${orderId}_${toStatus}_${Date.now()}_${randomUUID().replace(/-/g, "")}`;
  const serviceClient = createServiceClient();

  // If transitioning from CONFIRMED to PROCESSING, ensure reservations are consumed if needed
  // For GCash, approve_gcash_submission already consumed reservations when payment became PAID.
  // For COD, reservations need to be consumed prior to PROCESSING as required by database constraints.
  if (toStatus === "PROCESSING") {
    // Check payment method
    const { data: payment } = await serviceClient
      .from("payments")
      .select("method, status")
      .eq("order_id", orderId)
      .single();

    if (payment?.method === "COD") {
      // Find active reservations and consume them for COD processing
      const { data: reservations } = await serviceClient
        .from("inventory_reservations")
        .select("id")
        .eq("order_id", orderId)
        .eq("status", "active");

      if (reservations && reservations.length > 0) {
        for (const res of reservations) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (serviceClient as any).rpc("transition_inventory_reservation", {
            p_reservation_id: res.id,
            p_to_status: "consumed",
            p_idempotency_key: `cod_consume_${res.id}_${Date.now()}`,
            p_actor_id: adminCtx.userId,
            p_reason: "COD order preparation started",
          });
        }
      }
    }
  }

  const { error: rpcError } = await serviceClient.rpc("transition_order", {
    p_order_id: orderId,
    p_to_status: toStatus,
    p_note: note,
    p_source: "admin_dashboard",
    p_changed_by: adminCtx.userId,
    p_idempotency_key: idempotencyKey,
    p_metadata: {},
  });

  if (rpcError) {
    redirect(`/admin/orders/${orderId}?error=${encodeURIComponent(rpcError.message || "transition_failed")}`);
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
  const adminCtx = await getAdminAuthContext();
  if (!adminCtx) {
    redirect("/login?next=/admin/users");
  }

  if (adminCtx.role !== "super_admin") {
    redirect("/admin/users?error=super_admin_required");
  }

  if (adminCtx.aal !== "aal2") {
    redirect("/admin/users?error=aal2_required");
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
    redirect(`/admin/users?error=${encodeURIComponent(rpcError.message || "role_management_failed")}`);
  }

  revalidatePath("/admin/users");
  redirect("/admin/users?notice=role_updated");
}
