"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAal2 } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

export async function submitReturnRequest(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login?return_to=/orders");
  }

  const orderId = formData.get("order_id") as string;
  const type = (formData.get("type") as string) || "RETURN";
  const reason = (formData.get("reason") as string) || "OTHER";
  const reasonDetails = (formData.get("reason_details") as string)?.trim() || "";
  const requestedRefundMinor = parseInt(formData.get("requested_refund_minor") as string, 10) || 0;
  const proofPath = formData.get("proof_path") as string;
  const proofPaths = proofPath ? [proofPath] : [];

  if (!orderId) {
    redirect("/orders?error=missing_order_id");
  }

  const { error: rpcError } = await supabase.rpc("create_customer_return_request", {
    p_order_id: orderId,
    p_type: type,
    p_reason: reason,
    p_reason_details: reasonDetails || "",
    p_requested_refund_minor: requestedRefundMinor,
    p_proof_paths: proofPaths,
  });

  if (rpcError) {
    redirect(`/orders/${orderId}?error=return_request_failed`);
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/admin/returns");

  redirect(`/orders/${orderId}?notice=return_requested`);
}

export async function processReturnRequest(formData: FormData) {
  await requireAdminAal2("/admin/returns");

  const returnId = formData.get("return_id") as string;
  const decision = formData.get("decision") as string; // 'APPROVED' | 'REJECTED' | 'ITEMS_RECEIVED' | 'COMPLETED'
  const approvedRefundMinor = parseInt(formData.get("approved_refund_minor") as string, 10) || 0;
  const adminNotes = (formData.get("admin_notes") as string)?.trim() || "";

  if (!returnId || !decision) {
    redirect("/admin/returns?error=missing_parameters");
  }

  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("admin_process_return_request", {
    p_return_id: returnId,
    p_decision: decision,
    p_approved_refund_minor: approvedRefundMinor,
    p_admin_notes: adminNotes || undefined,
  });

  if (rpcError) {
    redirect(`/admin/returns?error=processing_failed`);
  }

  revalidatePath("/admin/returns");
  redirect("/admin/returns?notice=decision_saved");
}

export async function issueRefund(formData: FormData) {
  await requireAdminAal2("/admin/returns");

  const orderId = formData.get("order_id") as string;
  const returnRequestId = (formData.get("return_request_id") as string) || undefined;
  const amountMinor = parseInt(formData.get("amount_minor") as string, 10);
  const method = formData.get("method") as string; // 'MANUAL_GCASH' | 'CASH' | 'ORIGINAL_PAYMENT'
  const referenceNumber = (formData.get("reference_number") as string)?.trim() || undefined;
  const reason = (formData.get("reason") as string)?.trim() || "Customer refund";

  if (!orderId || !amountMinor || isNaN(amountMinor) || amountMinor <= 0) {
    redirect("/admin/returns?error=invalid_refund_parameters");
  }

  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("admin_issue_refund", {
    p_order_id: orderId,
    p_amount_minor: amountMinor,
    p_method: method || "MANUAL_GCASH",
    p_reason: reason,
    p_return_request_id: returnRequestId || undefined,
    p_reference_number: referenceNumber || undefined,
  });

  if (rpcError) {
    redirect("/admin/returns?error=refund_execution_failed");
  }

  revalidatePath("/admin/returns");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/orders/${orderId}`);

  redirect("/admin/returns?notice=refund_issued");
}

export async function processExchangeAction(formData: FormData) {
  await requireAdminAal2("/admin/orders");

  const orderId = formData.get("order_id") as string;
  const origVariantId = formData.get("orig_variant_id") as string;
  const newVariantId = formData.get("new_variant_id") as string;
  const reason = (formData.get("reason") as string)?.trim() || "Item size/color exchange";
  const registerSessionId = (formData.get("register_session_id") as string) || undefined;
  const cashTenderedMinor = parseInt(formData.get("cash_tendered_minor") as string, 10) || 0;

  if (!orderId || !origVariantId || !newVariantId) {
    redirect("/admin/orders?error=missing_exchange_parameters");
  }

  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("admin_process_exchange", {
    p_order_id: orderId,
    p_orig_variant_id: origVariantId,
    p_new_variant_id: newVariantId,
    p_reason: reason,
    p_register_session_id: registerSessionId || undefined,
    p_cash_tendered_minor: cashTenderedMinor,
  });

  if (rpcError) {
    redirect(`/admin/orders/${orderId}?error=exchange_failed`);
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/orders");

  redirect(`/admin/orders/${orderId}?notice=exchange_completed`);
}

