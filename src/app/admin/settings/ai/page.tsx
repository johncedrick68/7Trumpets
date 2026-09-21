import { requireAdminAal2 } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { updateAiSettings } from "@/lib/settings/ai-actions";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

interface SearchParams {
  notice?: string;
  error?: string;
}

interface AiSettingsData {
  enabled?: boolean;
  auto_reply_enabled?: boolean;
  auto_reply_confidence_threshold?: number;
  human_handoff_enabled?: boolean;
  daily_brief_enabled?: boolean;
  model_name?: string;
  kill_switch?: boolean;
}

export default async function AdminAiSettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdminAal2("/admin/settings/ai");
  const { notice, error } = await searchParams;

  const supabase = await createClient();
  const { data: settingRow } = await supabase
    .from("store_settings")
    .select("value")
    .eq("key", "ai_settings")
    .maybeSingle();

  const ai = (settingRow?.value as unknown as AiSettingsData) || {
    enabled: true,
    auto_reply_enabled: true,
    auto_reply_confidence_threshold: 0.85,
    human_handoff_enabled: true,
    daily_brief_enabled: true,
    model_name: "gemini-3.8-flash",
    kill_switch: false,
  };

  const isGeminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  const isN8nConfigured = Boolean(process.env.N8N_WEBHOOK_URL);

  return (
    <div className="space-y-6 max-w-4xl">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight mb-1">AI & Automation Governance</h1>
        <p className="text-xs text-muted-foreground">
          Configure Gemini 3.8 Flash assistance policies, autonomous response thresholds, and emergency kill switches.
        </p>
      </header>

      {notice === "settings_saved" && (
        <div className="p-3 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400 flex items-center gap-2 text-xs">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>AI & automation policies updated and logged.</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-2 text-xs">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          <span>Error: {error}</span>
        </div>
      )}

      {/* Environment Integration Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold flex items-center justify-between">
              Google Gemini API Status
              {isGeminiConfigured ? (
                <Badge variant="default" className="text-[10px] bg-emerald-600">Configured ✓</Badge>
              ) : (
                <Badge variant="destructive" className="text-[10px]">Not Configured</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-xs text-muted-foreground">
            {isGeminiConfigured
              ? "GEMINI_API_KEY detected in server environment. Model ready for low-risk assistant queries."
              : "GEMINI_API_KEY missing from server environment. Automated assistant will safely fall back to human queue."}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold flex items-center justify-between">
              n8n Outbox Dispatcher
              {isN8nConfigured ? (
                <Badge variant="default" className="text-[10px] bg-emerald-600">Configured ✓</Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">Prepared (Local Outbox Active)</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-xs text-muted-foreground">
            {isN8nConfigured
              ? "N8N_WEBHOOK_URL active. Outbox events are dispatched asynchronously to n8n."
              : "Events are queued transactionally in public.automation_outbox. Webhook dispatch requires N8N_WEBHOOK_URL."}
          </CardContent>
        </Card>
      </div>

      {/* AI Settings Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Assistant & Autonomous Policies
          </CardTitle>
          <CardDescription className="text-xs">
            Fine-tune the operational limits of AI responses across customer support.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateAiSettings} className="space-y-6 text-xs">
            {/* Kill Switch Banner */}
            <div className="p-4 rounded-lg border border-destructive/40 bg-destructive/5 space-y-2">
              <div className="flex items-center gap-2 text-destructive font-semibold">
                <AlertTriangle className="w-4 h-4" /> Emergency AI Kill Switch
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Immediately terminates all automated replies and AI assistant processing across the entire storefront.
                Customer messaging remains 100% operational with immediate human routing.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="kill_switch"
                  name="kill_switch"
                  defaultChecked={ai.kill_switch}
                  className="rounded border-destructive h-4 w-4 text-destructive focus:ring-destructive"
                />
                <Label htmlFor="kill_switch" className="text-xs font-semibold text-destructive cursor-pointer">
                  Activate Emergency Kill Switch (Disable all AI services)
                </Label>
              </div>
            </div>

            {/* Feature Toggles */}
            <div className="space-y-4 pt-2">
              <div className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-card">
                <div>
                  <Label htmlFor="enabled" className="font-semibold cursor-pointer">AI Support Assistant Enabled</Label>
                  <p className="text-muted-foreground text-[11px] mt-0.5">
                    Enables Gemini to analyze, classify, and formulate responses to incoming customer tickets.
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="enabled"
                  name="enabled"
                  defaultChecked={ai.enabled}
                  className="rounded h-4 w-4 mt-1"
                />
              </div>

              <div className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-card">
                <div>
                  <Label htmlFor="auto_reply_enabled" className="font-semibold cursor-pointer">Auto-Reply for Low-Risk Inquiries</Label>
                  <p className="text-muted-foreground text-[11px] mt-0.5">
                    Permits the AI to automatically respond to general questions (sizing, tracking, policies) when confidence threshold is met.
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="auto_reply_enabled"
                  name="auto_reply_enabled"
                  defaultChecked={ai.auto_reply_enabled}
                  className="rounded h-4 w-4 mt-1"
                />
              </div>

              <div className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-card">
                <div>
                  <Label htmlFor="human_handoff_enabled" className="font-semibold cursor-pointer">Human Handoff Allowed</Label>
                  <p className="text-muted-foreground text-[11px] mt-0.5">
                    Allows customers to click &quot;Talk to a Person&quot; to immediately pause AI responses and route to human support staff.
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="human_handoff_enabled"
                  name="human_handoff_enabled"
                  defaultChecked={ai.human_handoff_enabled}
                  className="rounded h-4 w-4 mt-1"
                />
              </div>

              <div className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-card">
                <div>
                  <Label htmlFor="daily_brief_enabled" className="font-semibold cursor-pointer">Daily Admin Brief Enabled</Label>
                  <p className="text-muted-foreground text-[11px] mt-0.5">
                    Generates automated executive operational summaries for the store operator.
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="daily_brief_enabled"
                  name="daily_brief_enabled"
                  defaultChecked={ai.daily_brief_enabled}
                  className="rounded h-4 w-4 mt-1"
                />
              </div>
            </div>

            {/* Threshold and Model configuration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="confidence_threshold" className="text-xs">
                  Confidence Threshold for Auto-Replies (0.1 to 1.0)
                </Label>
                <Input
                  id="confidence_threshold"
                  name="confidence_threshold"
                  type="number"
                  step="0.05"
                  min="0.5"
                  max="0.99"
                  defaultValue={ai.auto_reply_confidence_threshold || 0.85}
                  className="h-9 text-xs font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Inquiries scored below this threshold are automatically routed to human staff. Recommended: 0.85.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="model_name" className="text-xs">Underlying Foundation Model</Label>
                <Input
                  id="model_name"
                  name="model_name"
                  type="text"
                  defaultValue={ai.model_name || "gemini-3.8-flash"}
                  className="h-9 text-xs font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Default: gemini-3.8-flash. Low-latency, cost-effective multimodal architecture.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button type="submit" className="gap-2">
                Save Operational Policies
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
