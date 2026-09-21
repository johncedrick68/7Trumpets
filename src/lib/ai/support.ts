import { createServiceClient } from "@/lib/supabase/server";
import { callGemini } from "@/lib/ai/gemini";
import {
  getCustomerOrderSummary,
  getCustomerTracking,
} from "@/lib/ai/tools";
import { logServerError } from "@/lib/server-log";

interface SupportClassification {
  category: "ORDER_STATUS" | "PAYMENT" | "DELIVERY" | "PRODUCT" | "SIZE" | "RETURN_EXCHANGE" | "ACCOUNT" | "OTHER";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  needs_human: boolean;
  confidence: number;
  short_summary: string;
  suggested_reply?: string;
}

interface SupportAiSettings {
  enabled?: boolean;
  auto_reply_enabled?: boolean;
  auto_reply_confidence_threshold?: number;
  model_name?: string;
  kill_switch?: boolean;
}

/**
 * Asynchronously evaluate customer message with Gemini 3.8 Flash.
 * Enforces auto-reply safety gates, human escalation, and graceful fallback.
 */
export async function evaluateAndReplySupportMessage(conversationId: string, customerMessage: string) {
  const serviceClient = createServiceClient();

  // 1. Fetch conversation details & store AI settings
  const { data: conv } = await serviceClient
    .from("support_conversations")
    .select("id, customer_id, order_id, category, status, ai_state")
    .eq("id", conversationId)
    .single();

  if (!conv || conv.ai_state === "PAUSED_FOR_HUMAN" || conv.ai_state === "DISABLED") {
    return;
  }

  // Check store AI settings
  const { data: settingsRow } = await serviceClient
    .from("store_settings")
    .select("value")
    .eq("key", "ai_settings")
    .maybeSingle();

  const aiSettings = (settingsRow?.value as unknown as SupportAiSettings) || {
    enabled: true,
    auto_reply_enabled: true,
    auto_reply_confidence_threshold: 0.85,
    kill_switch: false,
  };

  if (!aiSettings.enabled || aiSettings.kill_switch) {
    // AI is disabled; conversation remains waiting for staff
    return;
  }

  // 2. Fetch recent conversation context (max 6 messages)
  const { data: recentMsgs } = await serviceClient
    .from("support_messages")
    .select("sender_type, content, created_at")
    .eq("conversation_id", conversationId)
    .eq("is_internal", false)
    .order("created_at", { ascending: false })
    .limit(6);

  const contextMessages = (recentMsgs || []).reverse();

  // 3. Prepare tool facts if order is attached
  let orderFactSummary = "No specific order attached.";
  if (conv.order_id) {
    const orderData = await getCustomerOrderSummary(conv.order_id, conv.customer_id);
    const trackingData = await getCustomerTracking(conv.order_id, conv.customer_id);
    orderFactSummary = JSON.stringify({ order: orderData, tracking: trackingData });
  }

  // 4. Build prompt
  const systemInstruction = `You are "1968 Assistant", the dedicated AI customer support assistant for 1968 Clothing (independent archival streetwear from Manila, Philippines).
Tone: Courteous, knowledgeable, streetwear culture-aligned, professional, and accurate.

RULES:
1. Identify yourself as "1968 Assistant". Never claim to be human or an administrator.
2. Answer factual questions about garments, sizing, order dispatch, store policies, or tracking.
3. STRICT ESCALATION: Set "needs_human": true IMMEDIATELY if:
   - The customer mentions a payment dispute, double deduction, missing GCash verification, or money issue.
   - The customer requests a refund or reports a missing/damaged parcel.
   - The customer explicitly asks for a human, staff, or person.
   - The customer appears frustrated, angry, or escalates a complaint.
4. Output MUST be valid JSON conforming to:
{
  "category": "ORDER_STATUS" | "PAYMENT" | "DELIVERY" | "PRODUCT" | "SIZE" | "RETURN_EXCHANGE" | "ACCOUNT" | "OTHER",
  "priority": "LOW" | "NORMAL" | "HIGH" | "URGENT",
  "needs_human": boolean,
  "confidence": number,
  "short_summary": string,
  "suggested_reply": string
}`;

  const userPrompt = `Customer Inquiry: "${customerMessage}"
Attached Order Facts: ${orderFactSummary}
Recent Chat History:
${contextMessages.map((m) => `${m.sender_type}: ${m.content}`).join("\n")}

Classify and provide a response in strict JSON format:`;

  try {
    const geminiRes = await callGemini({
      feature: "support_assistant",
      prompt: userPrompt,
      systemInstruction,
      conversationId,
      model: aiSettings.model_name || "gemini-3.8-flash",
      temperature: 0.2,
    });

    // Parse JSON
    let parsed: SupportClassification | null = null;
    try {
      const cleaned = geminiRes.text.replace(/```json\n?|\n?```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = null;
    }

    if (!parsed) {
      // Malformed output fallback
      await escalateToHuman(conversationId, "Message classified for team review.");
      return;
    }

    // Save advisory summary to conversation
    await serviceClient
      .from("support_conversations")
      .update({
        summary: parsed.short_summary,
        priority: parsed.priority || "NORMAL",
      })
      .eq("id", conversationId);

    // Evaluate Auto-Reply Gate
    const isAutoReplyEligible =
      aiSettings.auto_reply_enabled &&
      !parsed.needs_human &&
      parsed.confidence >= (aiSettings.auto_reply_confidence_threshold || 0.85) &&
      ["ORDER_STATUS", "DELIVERY", "PRODUCT", "SIZE", "OTHER"].includes(parsed.category) &&
      Boolean(parsed.suggested_reply);

    if (isAutoReplyEligible && parsed.suggested_reply) {
      // Send AI Reply
      await serviceClient.from("support_messages").insert({
        conversation_id: conversationId,
        sender_type: "AI",
        content: parsed.suggested_reply,
        is_internal: false,
        metadata: {
          confidence: parsed.confidence,
          category: parsed.category,
          model: aiSettings.model_name || "gemini-3.8-flash",
        },
      });

      await serviceClient
        .from("support_conversations")
        .update({
          status: "WAITING_FOR_CUSTOMER",
          last_message_at: new Date().toISOString(),
        })
        .eq("id", conversationId);
    } else {
      // Escalate to human staff
      await escalateToHuman(
        conversationId,
        parsed.needs_human ? "Inquiry requires staff assistance." : "Assigned to support queue."
      );
    }
  } catch (err) {
    logServerError("ai.support.failure", err instanceof Error ? err.message : "unknown_error");
    // Graceful fallback: ensure conversation is safe and handed over to human
    await escalateToHuman(
      conversationId,
      "Your message has been received by 1968 support and will be reviewed by our team."
    );
  }
}

/**
 * Helper to transition conversation to human staff queue
 */
async function escalateToHuman(conversationId: string, systemNotice: string) {
  const serviceClient = createServiceClient();

  await serviceClient
    .from("support_conversations")
    .update({
      status: "WAITING_FOR_STAFF",
      ai_state: "PAUSED_FOR_HUMAN",
      last_message_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  await serviceClient.from("support_messages").insert({
    conversation_id: conversationId,
    sender_type: "SYSTEM",
    content: systemNotice,
    is_internal: false,
  });

  // Outbox event for staff notification
  await serviceClient.from("automation_outbox").insert({
    event_type: "SUPPORT_HUMAN_REQUESTED",
    aggregate_type: "support_conversation",
    aggregate_id: conversationId,
    payload: { conversation_id: conversationId, timestamp: new Date().toISOString() },
  });
}
