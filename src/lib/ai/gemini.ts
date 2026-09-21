import { createServiceClient } from "@/lib/supabase/server";

export interface GeminiCallResult {
  text: string;
  functionCalls?: Array<{ name: string; args: Record<string, unknown> }>;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
}

/**
 * Server-only client for Google Gemini 3.8 Flash.
 * Enforces strict timeout, telemetry logging to ai_usage_logs, and no key leakage.
 */
export async function callGemini({
  feature,
  prompt,
  systemInstruction,
  tools,
  conversationId,
  model = "gemini-3.8-flash",
  temperature = 0.2,
}: {
  feature: string;
  prompt: string;
  systemInstruction?: string;
  tools?: Array<Record<string, unknown>>;
  conversationId?: string;
  model?: string;
  temperature?: number;
}): Promise<GeminiCallResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const startTime = Date.now();

  if (!apiKey) {
    throw new Error("GEMINI_NOT_CONFIGURED");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: 1024,
    },
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s safety timeout

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      const errText = await res.text();
      await recordAiTelemetry({
        feature,
        model,
        latencyMs,
        success: false,
        conversationId,
        errorCode: `HTTP_${res.status}: ${errText.slice(0, 100)}`,
      });
      throw new Error(`Gemini API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    let text = "";
    const functionCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

    for (const part of parts) {
      if (part.text) {
        text += part.text;
      }
      if (part.functionCall) {
        functionCalls.push({
          name: part.functionCall.name,
          args: part.functionCall.args || {},
        });
      }
    }

    const inputTokens = data.usageMetadata?.promptTokenCount;
    const outputTokens = data.usageMetadata?.candidatesTokenCount;

    await recordAiTelemetry({
      feature,
      model,
      latencyMs,
      success: true,
      inputTokens,
      outputTokens,
      conversationId,
    });

    return {
      text,
      functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
      inputTokens,
      outputTokens,
      latencyMs,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    const errorObj = err instanceof Error ? err : new Error(String(err));
    const isTimeout = errorObj.name === "AbortError";

    await recordAiTelemetry({
      feature,
      model,
      latencyMs,
      success: false,
      conversationId,
      errorCode: isTimeout ? "TIMEOUT" : (errorObj.message || "UNKNOWN_ERROR"),
    });

    throw err;
  }
}

/**
 * Record usage telemetry into public.ai_usage_logs
 */
async function recordAiTelemetry({
  feature,
  model,
  latencyMs,
  success,
  inputTokens,
  outputTokens,
  conversationId,
  errorCode,
}: {
  feature: string;
  model: string;
  latencyMs: number;
  success: boolean;
  inputTokens?: number;
  outputTokens?: number;
  conversationId?: string;
  errorCode?: string;
}) {
  try {
    const serviceClient = createServiceClient();
    await serviceClient.from("ai_usage_logs").insert({
      feature,
      model,
      latency_ms: latencyMs,
      success,
      input_tokens: inputTokens || null,
      output_tokens: outputTokens || null,
      conversation_id: conversationId || null,
      error_code: errorCode || null,
    });
  } catch {
    // Non-blocking telemetry failure
  }
}
