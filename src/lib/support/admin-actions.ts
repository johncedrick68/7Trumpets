"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAal2 } from "@/lib/admin/auth";
import { logServerError } from "@/lib/server-log";

/**
 * Admin / Staff replies to support conversation (either Public Reply or Private Internal Note).
 */
export async function adminReplySupport(formData: FormData) {
  await requireAdminAal2("/admin/support");

  const conversationId = formData.get("conversation_id") as string;
  const content = (formData.get("content") as string)?.trim();
  const isInternal = formData.get("is_internal") === "true";
  const newStatus = (formData.get("new_status") as string) || undefined;

  if (!conversationId || !content) {
    redirect(`/admin/support?error=missing_parameters&id=${conversationId}`);
  }

  const supabase = await createClient();
  const { data: msgId, error } = await supabase.rpc("admin_reply_support", {
    p_conversation_id: conversationId,
    p_content: content,
    p_is_internal: isInternal,
    p_new_status: newStatus,
  });

  if (error || !msgId) {
    logServerError("admin.support.reply", error?.message || "rpc_failed");
    redirect(`/admin/support?error=reply_failed&id=${conversationId}`);
  }

  revalidatePath("/admin/support");
  redirect(`/admin/support?id=${conversationId}&notice=reply_sent`);
}

/**
 * Admin resolves a support conversation.
 */
export async function adminResolveSupport(formData: FormData) {
  await requireAdminAal2("/admin/support");

  const conversationId = formData.get("conversation_id") as string;
  const resolutionNote = (formData.get("resolution_note") as string)?.trim() || undefined;

  if (!conversationId) {
    redirect("/admin/support?error=missing_conversation_id");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_resolve_support", {
    p_conversation_id: conversationId,
    p_resolution_note: resolutionNote,
  });

  if (error) {
    logServerError("admin.support.resolve", error.message);
    redirect(`/admin/support?error=resolve_failed&id=${conversationId}`);
  }

  revalidatePath("/admin/support");
  redirect(`/admin/support?id=${conversationId}&notice=resolved`);
}

/**
 * Admin reopens a resolved or closed support conversation.
 */
export async function adminReopenSupport(formData: FormData) {
  await requireAdminAal2("/admin/support");

  const conversationId = formData.get("conversation_id") as string;
  if (!conversationId) {
    redirect("/admin/support?error=missing_conversation_id");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_reopen_support", {
    p_conversation_id: conversationId,
  });

  if (error) {
    logServerError("admin.support.reopen", error.message);
    redirect(`/admin/support?error=reopen_failed&id=${conversationId}`);
  }

  revalidatePath("/admin/support");
  redirect(`/admin/support?id=${conversationId}&notice=reopened`);
}

/**
 * Assign staff member to support conversation.
 */
export async function adminAssignStaff(formDataOrConvId: FormData | string, optionalStaffId?: string) {
  const adminCtx = await requireAdminAal2("/admin/support");

  let conversationId: string;
  let staffId: string;

  if (typeof formDataOrConvId === "string") {
    conversationId = formDataOrConvId;
    staffId = optionalStaffId || adminCtx.userId;
  } else {
    conversationId = formDataOrConvId.get("conversation_id") as string;
    staffId = (formDataOrConvId.get("staff_id") as string) || adminCtx.userId;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_assign_staff", {
    p_conversation_id: conversationId,
    p_staff_id: staffId,
  });

  if (error) {
    logServerError("admin.support.assign", error.message);
    redirect(`/admin/support?error=assign_failed&id=${conversationId}`);
  }

  revalidatePath("/admin/support");
  redirect(`/admin/support?id=${conversationId}&notice=assigned`);
}
