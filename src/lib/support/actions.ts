"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/server-log";
import { evaluateAndReplySupportMessage } from "@/lib/ai/support";

/**
 * Customer creates a new support conversation.
 */
export async function createSupportConversation(formData: FormData) {
  const category = (formData.get("category") as string)?.trim() || "OTHER";
  const initialMessage = (formData.get("initial_message") as string)?.trim();
  const orderId = (formData.get("order_id") as string)?.trim() || null;

  if (!initialMessage) {
    redirect("/account/support?error=message_required");
  }

  const supabase = await createClient();
  const { data: convId, error } = await supabase.rpc("create_support_conversation", {
    p_category: category,
    p_initial_message: initialMessage,
    p_order_id: orderId || undefined,
  });

  if (error || !convId) {
    logServerError("support.create", error?.message || "rpc_failed");
    redirect("/account/support?error=failed_to_create_conversation");
  }

  // Trigger server-side AI evaluation asynchronously (does not block redirect)
  evaluateAndReplySupportMessage(convId, initialMessage).catch((err: unknown) => {
    logServerError("ai.support.evaluation", err instanceof Error ? err.message : "async_eval_failed");
  });

  revalidatePath("/account/support");
  redirect(`/account/support?id=${convId}`);
}

/**
 * Customer sends a message in an existing support conversation.
 */
export async function sendCustomerMessage(formData: FormData) {
  const conversationId = formData.get("conversation_id") as string;
  const content = (formData.get("content") as string)?.trim();

  if (!conversationId || !content) {
    return { error: "Missing conversation ID or message content" };
  }

  const supabase = await createClient();
  const { data: msgId, error } = await supabase.rpc("send_customer_support_message", {
    p_conversation_id: conversationId,
    p_content: content,
  });

  if (error || !msgId) {
    logServerError("support.send", error?.message || "rpc_failed");
    return { error: "Failed to send message. Please try again." };
  }

  // Trigger server-side AI evaluation asynchronously
  evaluateAndReplySupportMessage(conversationId, content).catch((err: unknown) => {
    logServerError("ai.support.evaluation", err instanceof Error ? err.message : "async_eval_failed");
  });

  revalidatePath(`/account/support`);
  return { success: true, messageId: msgId };
}

/**
 * Customer requests human staff assistance ("Talk to a Person").
 * Sets conversation status to WAITING_FOR_STAFF and pauses AI auto-replies.
 */
export async function requestHumanHandoff(formData: FormData) {
  const conversationId = formData.get("conversation_id") as string;
  if (!conversationId) {
    return { error: "Missing conversation ID" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_human_support", {
    p_conversation_id: conversationId,
  });

  if (error) {
    logServerError("support.human_request", error.message);
    return { error: "Could not request human handoff at this time." };
  }

  revalidatePath("/account/support");
  return { success: true };
}
