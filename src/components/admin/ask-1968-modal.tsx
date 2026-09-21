"use client";

import { useState } from "react";
import { Sparkles, Send, RefreshCw, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function Ask1968Modal() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quickPrompts = [
    "What needs my attention today?",
    "Which products are low on stock?",
    "Summarize today's sales and order volume.",
    "Are there any fulfillment or support bottlenecks?",
  ];

  const handleAsk = async (promptToUse?: string) => {
    const q = promptToUse || question;
    if (!q.trim() || loading) return;

    setLoading(true);
    setError(null);
    if (promptToUse) setQuestion(promptToUse);

    try {
      const res = await fetch("/api/admin/ask-1968", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate briefing");
      } else {
        setAnswer(data.answer);
      }
    } catch {
      setError("Network or server error encountered.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 bg-card shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          Ask 1968
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-primary" /> Ask 1968 Operational Intelligence
          </DialogTitle>
          <DialogDescription className="text-xs">
            Query live operational data, revenue velocity, inventory risk, and queue bottlenecks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Quick Prompts */}
          <div className="flex flex-wrap gap-1.5">
            {quickPrompts.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleAsk(p)}
                disabled={loading}
                className="text-[11px] px-2.5 py-1 rounded-full bg-muted hover:bg-muted/80 text-foreground border text-left transition-colors"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Question Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk();
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask an operational question (e.g. Which variants need reordering?)..."
              disabled={loading}
              className="h-9 text-xs"
            />
            <Button type="submit" size="sm" disabled={!question.trim() || loading} className="h-9 px-3 gap-1">
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Ask
            </Button>
          </form>

          {/* Error notice */}
          {error && (
            <div className="p-3 rounded bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Answer Display */}
          {loading ? (
            <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-primary" />
              <span>Analyzing live store telemetry and database records...</span>
            </div>
          ) : answer ? (
            <div className="space-y-3 p-4 rounded-lg bg-card border">
              <div className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                Operational Briefing
              </div>
              <div className="whitespace-pre-wrap leading-relaxed text-xs text-foreground">
                {answer}
              </div>
              <div className="pt-2 border-t border-border/40 text-[10px] text-muted-foreground italic">
                AI-generated summary based on current 1968 operational data.
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
