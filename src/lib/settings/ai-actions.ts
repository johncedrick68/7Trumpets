"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAal2 } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/server-log";

/**
 * Update AI and automation operational settings.
 * Strictly requires Admin AAL2.
 */
export async function updateAiSettings(formData: FormData) {
  const adminCtx = await requireAdminAal2("/admin/settings/ai");

  const enabled = formData.get("enabled") === "on" || formData.get("enabled") === "true";
  const autoReplyEnabled = formData.get("auto_reply_enabled") === "on" || formData.get("auto_reply_enabled") === "true";
  const humanHandoffEnabled = formData.get("human_handoff_enabled") === "on" || formData.get("human_handoff_enabled") === "true";
  const dailyBriefEnabled = formData.get("daily_brief_enabled") === "on" || formData.get("daily_brief_enabled") === "true";
  const killSwitch = formData.get("kill_switch") === "on" || formData.get("kill_switch") === "true";

  const thresholdRaw = parseFloat((formData.get("confidence_threshold") as string) || "0.85");
  const confidenceThreshold = Math.min(Math.max(thresholdRaw, 0.1), 1.0);
  const modelName = (formData.get("model_name") as string)?.trim() || "gemini-3.8-flash";

  const payload = {
    enabled,
    auto_reply_enabled: autoReplyEnabled,
    auto_reply_confidence_threshold: confidenceThreshold,
    human_handoff_enabled: humanHandoffEnabled,
    daily_brief_enabled: dailyBriefEnabled,
    model_name: modelName,
    kill_switch: killSwitch,
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("store_settings")
    .upsert({
      key: "ai_settings",
      value: payload,
      updated_by: adminCtx.userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });

  if (error) {
    logServerError("settings.ai.update", error.message);
    redirect("/admin/settings/ai?error=update_failed");
  }

  // Record audit log
  await supabase.from("audit_logs").insert({
    actor_id: adminCtx.userId,
    actor_role: adminCtx.role,
    action: "settings.ai_updated",
    entity: "store_settings",
    entity_id: adminCtx.userId,
    new_values: payload,
  });

  revalidatePath("/admin/settings/ai");
  revalidatePath("/admin/support");
  redirect("/admin/settings/ai?notice=settings_saved");
}
