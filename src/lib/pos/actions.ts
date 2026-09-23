"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAal2 } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

export async function openRegisterSessionAction(formData: FormData) {
  await requireAdminAal2("/admin/pos");

  const openingCashMinor = parseInt(formData.get("opening_cash_minor") as string, 10);
  const notes = (formData.get("notes") as string)?.trim() || "";

  if (isNaN(openingCashMinor) || openingCashMinor < 0) {
    redirect("/admin/pos?error=invalid_opening_cash");
  }

  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("open_register_session", {
    p_opening_cash_minor: openingCashMinor,
    p_notes: notes || undefined,
  });

  if (rpcError) {
    redirect("/admin/pos?error=failed_to_open_register");
  }

  revalidatePath("/admin/pos");
  redirect("/admin/pos?notice=register_opened");
}

export async function closeRegisterSessionAction(formData: FormData) {
  await requireAdminAal2("/admin/pos");

  const sessionId = formData.get("session_id") as string;
  const actualCashMinor = parseInt(formData.get("actual_cash_minor") as string, 10);
  const notes = (formData.get("notes") as string)?.trim() || "";

  if (!sessionId || isNaN(actualCashMinor) || actualCashMinor < 0) {
    redirect("/admin/pos?error=invalid_closing_cash");
  }

  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("close_register_session", {
    p_session_id: sessionId,
    p_actual_cash_minor: actualCashMinor,
    p_notes: notes || undefined,
  });

  if (rpcError) {
    redirect("/admin/pos?error=failed_to_close_register");
  }

  revalidatePath("/admin/pos");
  redirect("/admin/pos?notice=register_closed");
}

export async function processPosCounterSaleAction(formData: FormData) {
  await requireAdminAal2("/admin/pos");

  const itemsJson = formData.get("items_json") as string;
  const paymentMethod = (formData.get("payment_method") as string) || "CASH";
  const tenderedMinor = parseInt(formData.get("tendered_minor") as string, 10);
  const customerName = (formData.get("customer_name") as string)?.trim() || "Walk-in Customer";
  const customerPhone = (formData.get("customer_phone") as string)?.trim() || "09000000000";
  const registerSessionId = (formData.get("register_session_id") as string) || undefined;

  if (!itemsJson) {
    redirect("/admin/pos?error=empty_cart");
  }

  let parsedItems = [];
  try {
    parsedItems = JSON.parse(itemsJson);
  } catch {
    redirect("/admin/pos?error=invalid_cart_payload");
  }

  if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
    redirect("/admin/pos?error=empty_cart");
  }

  const supabase = await createClient();
  const { data, error: rpcError } = await supabase.rpc("create_pos_sale", {
    p_items: parsedItems,
    p_payment_method: paymentMethod,
    p_tendered_minor: isNaN(tenderedMinor) ? 0 : tenderedMinor,
    p_customer_name: customerName,
    p_customer_phone: customerPhone,
    p_register_session_id: registerSessionId || undefined,
  });

  if (rpcError) {
    const registerError = [
      "POS_REGISTER_SESSION_REQUIRED",
      "POS_REGISTER_SESSION_NOT_FOUND",
      "POS_REGISTER_SESSION_NOT_OWNED",
    ].find((code) => rpcError.message.includes(code));

    if (registerError) {
      redirect("/admin/pos?error=register_session_required");
    }
    if (rpcError.message.includes("POS_REGISTER_SESSION_CLOSED")) {
      redirect("/admin/pos?error=register_session_closed");
    }
    redirect("/admin/pos?error=sale_processing_failed");
  }

  const saleResult = data as { order_number?: string; total_minor?: number; change_minor?: number } | null;
  const orderNumber = saleResult?.order_number || "";
  const changeMinor = saleResult?.change_minor || 0;

  revalidatePath("/admin/pos");
  revalidatePath("/admin/orders");
  revalidatePath("/admin");

  redirect(`/admin/pos?notice=sale_completed&order_number=${orderNumber}&change_minor=${changeMinor}`);
}
