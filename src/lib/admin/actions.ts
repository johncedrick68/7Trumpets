"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminAal2 } from "@/lib/admin/auth";
import { logServerError } from "@/lib/server-log";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { inspectReceiptImage } from "@/lib/payments/image";
import {
  executeAdjustInventory,
  executeDeleteProductImage,
  executeSaveCategory,
  executeSaveOptionValue,
  executeSaveProduct,
  executeSaveProductImage,
  executeSaveProductOption,
  executeSaveVariant,
  executeSetVariantOptionValue,
  type CatalogActionAdapter,
} from "@/lib/admin/catalog-input";

export interface CatalogActionDeps {
  requireAdminAal2?: (returnTo?: string) => Promise<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createClient?: () => Promise<any> | any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createServiceClient?: () => any;
  inspectReceiptImage?: (buffer: Buffer) => { mime: string } | null;
  redirect?: (url: string) => never;
  revalidatePath?: (path: string) => void;
}

function getCatalogAdapter(deps?: CatalogActionDeps): CatalogActionAdapter {
  return {
    requireAdminAal2: deps?.requireAdminAal2 ?? requireAdminAal2,
    getSupabase: deps?.createClient ?? createClient,
    getServiceClient: deps?.createServiceClient ?? createServiceClient,
    inspectImage: deps?.inspectReceiptImage ?? inspectReceiptImage,
    redirect: (url: string): never => {
      if (deps?.redirect) return deps.redirect(url) as never;
      return redirect(url);
    },
    revalidatePath: deps?.revalidatePath ?? revalidatePath,
    logServerError,
  };
}

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

/**
 * Save / Update category. Requires AAL2 admin.
 * Preserves omitted fields on edits while applying explicit empty/false/0 values.
 */
export async function saveCategory(formData: FormData, deps?: CatalogActionDeps) {
  if (deps?.requireAdminAal2) {
    await deps.requireAdminAal2("/admin/catalog");
  } else {
    await requireAdminAal2("/admin/catalog");
  }
  return executeSaveCategory(formData, getCatalogAdapter(deps));
}

/**
 * Save / Update product. Requires AAL2 admin.
 * Preserves omitted fields on edits while applying explicit clear values.
 */
export async function saveProduct(formData: FormData, deps?: CatalogActionDeps) {
  if (deps?.requireAdminAal2) {
    await deps.requireAdminAal2("/admin/catalog");
  } else {
    await requireAdminAal2("/admin/catalog");
  }
  return executeSaveProduct(formData, getCatalogAdapter(deps));
}

/**
 * Save / Update product variant. Requires AAL2 admin.
 * Converts decimal price input to integer minor units (PHP centavos).
 * Locks product on edit and validates existing relationship before calling RPC.
 */
export async function saveVariant(formData: FormData, deps?: CatalogActionDeps) {
  if (deps?.requireAdminAal2) {
    await deps.requireAdminAal2("/admin/catalog");
  } else {
    await requireAdminAal2("/admin/catalog");
  }
  return executeSaveVariant(formData, getCatalogAdapter(deps));
}

export async function saveProductOption(formData: FormData, deps?: CatalogActionDeps) {
  if (deps?.requireAdminAal2) {
    await deps.requireAdminAal2("/admin/catalog");
  } else {
    await requireAdminAal2("/admin/catalog");
  }
  return executeSaveProductOption(formData, getCatalogAdapter(deps));
}

export async function saveOptionValue(formData: FormData, deps?: CatalogActionDeps) {
  if (deps?.requireAdminAal2) {
    await deps.requireAdminAal2("/admin/catalog");
  } else {
    await requireAdminAal2("/admin/catalog");
  }
  return executeSaveOptionValue(formData, getCatalogAdapter(deps));
}

export async function setVariantOptionValue(formData: FormData, deps?: CatalogActionDeps) {
  if (deps?.requireAdminAal2) {
    await deps.requireAdminAal2("/admin/catalog");
  } else {
    await requireAdminAal2("/admin/catalog");
  }
  return executeSetVariantOptionValue(formData, getCatalogAdapter(deps));
}

export async function saveProductImage(formData: FormData, deps?: CatalogActionDeps) {
  if (deps?.requireAdminAal2) {
    await deps.requireAdminAal2("/admin/catalog");
  } else {
    await requireAdminAal2("/admin/catalog");
  }
  return executeSaveProductImage(formData, getCatalogAdapter(deps));
}

export async function deleteProductImage(formData: FormData, deps?: CatalogActionDeps) {
  if (deps?.requireAdminAal2) {
    await deps.requireAdminAal2("/admin/catalog");
  } else {
    await requireAdminAal2("/admin/catalog");
  }
  return executeDeleteProductImage(formData, getCatalogAdapter(deps));
}

/**
 * Adjust stock for a variant. Requires AAL2 admin.
 */
export async function adjustInventory(formData: FormData, deps?: CatalogActionDeps) {
  if (deps?.requireAdminAal2) {
    await deps.requireAdminAal2("/admin/catalog");
  } else {
    await requireAdminAal2("/admin/catalog");
  }
  return executeAdjustInventory(formData, getCatalogAdapter(deps));
}

/**
 * Finalize an expired unresolved MANUAL_GCASH payment/order and release active inventory reservations.
 * Atomically transitions reservations to expired, restores available inventory, fails unpaid payment
 * (or closes window on rejected), cancels order, and writes immutable audit/movement ledgers.
 * Strictly enforces AAL2 and derives the idempotency key server-side.
 */
export async function expireGcashPayment(formData: FormData) {
  const returnTo = "/admin/payments";
  await requireAdminAal2(returnTo);

  const paymentId = (formData.get("payment_id") as string)?.trim();
  const reason = (formData.get("reason") as string)?.trim() || "Payment window expired without verified receipt";

  if (!paymentId) {
    redirect(`${returnTo}?error=missing_payment_id`);
  }

  const idempotencyKey = `gcash_expire_${paymentId}`;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: rpcError } = await (supabase.rpc as any)("close_expired_gcash_payment", {
    p_payment_id: paymentId,
    p_idempotency_key: idempotencyKey,
    p_reason: reason,
  });

  if (rpcError) {
    logServerError("payment.expire", "database_rejection");
    redirect(`${returnTo}?error=expiration_failed`);
  }

  revalidatePath("/admin/payments");
  revalidatePath("/admin/orders");
  revalidatePath("/orders");
  redirect(`${returnTo}?notice=gcash_expired`);
}
