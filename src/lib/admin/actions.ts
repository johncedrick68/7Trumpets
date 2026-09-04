"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminAal2 } from "@/lib/admin/auth";
import { logServerError } from "@/lib/server-log";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { inspectReceiptImage } from "@/lib/payments/image";
import { parsePHPMinor } from "@/lib/money";

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
 */
export async function saveCategory(formData: FormData) {
  await requireAdminAal2("/admin/catalog");

  const id = (formData.get("id") as string)?.trim() || undefined;
  const name = (formData.get("name") as string)?.trim();
  const slug = (formData.get("slug") as string)?.trim().toLowerCase();
  const description = (formData.get("description") as string)?.trim() || undefined;
  const parentId = (formData.get("parent_id") as string)?.trim() || undefined;
  const position = parseInt((formData.get("position") as string) || "0", 10);
  const archived = formData.get("archived") === "true" || formData.get("archived") === "on";

  if (!name || !slug) {
    redirect("/admin/catalog?error=missing_category_fields");
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)("admin_save_category", {
    p_id: id,
    p_name: name,
    p_slug: slug,
    p_description: description,
    p_parent_id: parentId,
    p_position: position,
    p_archived: archived,
  });

  if (error) {
    logServerError("admin.saveCategory", "rpc_error");
    redirect("/admin/catalog?error=save_category_failed");
  }

  revalidatePath("/admin/catalog");
  revalidatePath("/categories");
  redirect("/admin/catalog?notice=category_saved");
}

/**
 * Save / Update product. Requires AAL2 admin.
 */
export async function saveProduct(formData: FormData) {
  await requireAdminAal2("/admin/catalog");

  const id = (formData.get("id") as string)?.trim() || undefined;
  const categoryId = (formData.get("category_id") as string)?.trim() || undefined;
  const name = (formData.get("name") as string)?.trim();
  const slug = (formData.get("slug") as string)?.trim().toLowerCase();
  const description = (formData.get("description") as string)?.trim() || undefined;
  const status = (formData.get("status") as string)?.trim() || "draft";

  if (!name || !slug) {
    redirect("/admin/catalog?error=missing_product_fields");
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)("admin_save_product", {
    p_id: id,
    p_category_id: categoryId,
    p_name: name,
    p_slug: slug,
    p_description: description,
    p_status: status,
  });

  if (error) {
    logServerError("admin.saveProduct", "rpc_error");
    redirect("/admin/catalog?error=save_product_failed");
  }

  revalidatePath("/admin/catalog");
  revalidatePath("/products");
  redirect("/admin/catalog?notice=product_saved");
}

/**
 * Save / Update product variant. Requires AAL2 admin.
 * Converts decimal price input to integer minor units (PHP centavos).
 */
export async function saveVariant(formData: FormData) {
  await requireAdminAal2("/admin/catalog");

  const id = (formData.get("id") as string)?.trim() || undefined;
  const productId = (formData.get("product_id") as string)?.trim();
  const sku = (formData.get("sku") as string)?.trim().toUpperCase();
  const name = (formData.get("name") as string)?.trim() || undefined;
  const priceRaw = (formData.get("price") as string)?.trim();
  const compareAtPriceRaw = (formData.get("compare_at_price") as string)?.trim() || undefined;
  const status = (formData.get("status") as string)?.trim() || "active";

  if (!productId || !sku || !priceRaw) {
    redirect("/admin/catalog?error=missing_variant_fields");
  }

  const priceMinor = parsePHPMinor(priceRaw);
  if (priceMinor === null) {
    redirect("/admin/catalog?error=invalid_price");
  }

  let compareAtPriceMinor: number | undefined = undefined;
  if (compareAtPriceRaw) {
    compareAtPriceMinor = parsePHPMinor(compareAtPriceRaw) ?? undefined;
    if (compareAtPriceMinor === undefined) redirect("/admin/catalog?error=invalid_compare_at_price");
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)("admin_save_variant", {
    p_id: id,
    p_product_id: productId,
    p_sku: sku,
    p_name: name,
    p_price_minor: priceMinor,
    p_compare_at_price_minor: compareAtPriceMinor,
    p_status: status,
  });

  if (error) {
    logServerError("admin.saveVariant", "rpc_error");
    redirect("/admin/catalog?error=save_variant_failed");
  }

  revalidatePath("/admin/catalog");
  revalidatePath("/products");
  redirect("/admin/catalog?notice=variant_saved");
}

export async function saveProductOption(formData: FormData) {
  await requireAdminAal2("/admin/catalog");
  const productId = String(formData.get("product_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const position = Number.parseInt(String(formData.get("position") ?? "0"), 10);
  if (!productId || !name || !Number.isInteger(position)) redirect("/admin/catalog?error=invalid_option");

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_product_option", {
    p_product_id: productId, p_name: name, p_position: position,
  });
  if (error) redirect("/admin/catalog?error=save_option_failed");
  revalidatePath("/admin/catalog");
  redirect("/admin/catalog?notice=option_saved");
}

export async function saveOptionValue(formData: FormData) {
  await requireAdminAal2("/admin/catalog");
  const productId = String(formData.get("product_id") ?? "").trim();
  const optionId = String(formData.get("option_id") ?? "").trim();
  const value = String(formData.get("value") ?? "").trim();
  const position = Number.parseInt(String(formData.get("position") ?? "0"), 10);
  if (!productId || !optionId || !value || !Number.isInteger(position)) redirect("/admin/catalog?error=invalid_option_value");

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_option_value", {
    p_product_id: productId, p_option_id: optionId, p_value: value, p_position: position,
  });
  if (error) redirect("/admin/catalog?error=save_option_value_failed");
  revalidatePath("/admin/catalog");
  redirect("/admin/catalog?notice=option_value_saved");
}

export async function setVariantOptionValue(formData: FormData) {
  await requireAdminAal2("/admin/catalog");
  const productId = String(formData.get("product_id") ?? "").trim();
  const variantId = String(formData.get("variant_id") ?? "").trim();
  const optionId = String(formData.get("option_id") ?? "").trim();
  const optionValueId = String(formData.get("option_value_id") ?? "").trim();
  if (!productId || !variantId || !optionId || !optionValueId) redirect("/admin/catalog?error=invalid_variant_option");

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_variant_option_value", {
    p_product_id: productId, p_variant_id: variantId, p_option_id: optionId, p_option_value_id: optionValueId,
  });
  if (error) redirect("/admin/catalog?error=set_variant_option_failed");
  revalidatePath("/admin/catalog");
  redirect("/admin/catalog?notice=variant_option_saved");
}

export async function saveProductImage(formData: FormData) {
  await requireAdminAal2("/admin/catalog");
  const productId = String(formData.get("product_id") ?? "").trim();
  const variantId = String(formData.get("variant_id") ?? "").trim() || undefined;
  const altText = String(formData.get("alt_text") ?? "").trim();
  const position = Number.parseInt(String(formData.get("position") ?? "0"), 10);
  const file = formData.get("image");
  if (!productId || !altText || !Number.isInteger(position) || !(file instanceof File) || file.size <= 0 || file.size > 5 * 1024 * 1024) {
    redirect("/admin/catalog?error=invalid_product_image");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const image = inspectReceiptImage(buffer);
  if (!image || image.mime !== "image/webp" || file.type !== image.mime) redirect("/admin/catalog?error=product_image_must_be_webp");

  const storagePath = `${productId}/${randomUUID()}.webp`;
  const serviceClient = createServiceClient();
  const { error: uploadError } = await serviceClient.storage.from("product-images").upload(storagePath, buffer, {
    contentType: image.mime, upsert: false,
  });
  if (uploadError) redirect("/admin/catalog?error=product_image_upload_failed");

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_product_image", {
    p_product_id: productId, p_storage_path: storagePath, p_alt_text: altText,
    p_variant_id: variantId, p_position: position,
  });
  if (error) {
    await serviceClient.storage.from("product-images").remove([storagePath]);
    redirect("/admin/catalog?error=save_product_image_failed");
  }
  revalidatePath("/admin/catalog");
  revalidatePath("/products");
  redirect("/admin/catalog?notice=product_image_saved");
}

export async function deleteProductImage(formData: FormData) {
  await requireAdminAal2("/admin/catalog");
  const imageId = String(formData.get("image_id") ?? "").trim();
  if (!imageId) redirect("/admin/catalog?error=invalid_product_image");

  const serviceClient = createServiceClient();
  const { data: image } = await serviceClient.from("product_images").select("storage_path").eq("id", imageId).maybeSingle();
  if (!image) redirect("/admin/catalog?error=product_image_not_found");

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_product_image", { p_image_id: imageId });
  if (error) redirect("/admin/catalog?error=delete_product_image_failed");
  await serviceClient.storage.from("product-images").remove([image.storage_path]);
  revalidatePath("/admin/catalog");
  revalidatePath("/products");
  redirect("/admin/catalog?notice=product_image_deleted");
}

/**
 * Adjust stock for a variant. Requires AAL2 admin.
 */
export async function adjustInventory(formData: FormData) {
  await requireAdminAal2("/admin/catalog");

  const variantId = (formData.get("variant_id") as string)?.trim();
  const deltaRaw = (formData.get("delta") as string)?.trim();
  const type = (formData.get("type") as string)?.trim() || "adjustment";
  const reason = (formData.get("reason") as string)?.trim();

  if (!variantId || !deltaRaw || !reason) {
    redirect("/admin/catalog?error=missing_inventory_fields");
  }

  const delta = parseInt(deltaRaw, 10);
  if (isNaN(delta) || delta === 0) {
    redirect("/admin/catalog?error=invalid_delta");
  }

  const idempotencyKey = `inv_adj_${variantId}_${Date.now()}_${randomUUID().replace(/-/g, "")}`;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_adjust_inventory", {
    p_variant_id: variantId,
    p_delta: delta,
    p_type: type,
    p_reason: reason,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    logServerError("admin.adjustInventory", "rpc_error");
    redirect("/admin/catalog?error=adjust_inventory_failed");
  }

  revalidatePath("/admin/catalog");
  redirect("/admin/catalog?notice=inventory_adjusted");
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
