"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/server-log";

export async function cancelOrderAction(formData: FormData) {
  const orderId = formData.get("order_id") as string;
  const reason = (formData.get("reason") as string)?.trim() || "Customer requested cancellation before shipment";

  if (!orderId) {
    redirect("/orders?error=missing_order_id");
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    redirect(`/login?next=/orders/${orderId}`);
  }

  const { error: cancelError } = await supabase.rpc("cancel_order", {
    p_order_id: orderId,
    p_reason: reason,
  });

  if (cancelError) {
    logServerError("orders.cancel_order", "database_failure");
    redirect(`/orders/${orderId}?error=cancellation_failed`);
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");

  redirect(`/orders/${orderId}?notice=order_cancelled`);
}
