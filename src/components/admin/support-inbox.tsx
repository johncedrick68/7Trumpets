"use client";

import { useState, useMemo, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Send,
  User,
  Shield,
  Bot,
  Package,
  CheckCircle2,
  Lock,
  Sparkles,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

import { SupportConversation, SupportMessage } from "@/lib/support/queries";
import {
  adminReplySupport,
  adminResolveSupport,
  adminReopenSupport,
  adminAssignStaff,
} from "@/lib/support/admin-actions";
import { createClient } from "@/lib/supabase/client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/admin/search-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface SupportInboxProps {
  conversations: SupportConversation[];
  activeConversation: SupportConversation | null;
  initialMessages: SupportMessage[];
  currentStaffId: string;
  staffMembers: Array<{ id: string; name: string }>;
}

export function SupportInbox({
  conversations,
  activeConversation,
  initialMessages,
  currentStaffId,
  staffMembers,
}: SupportInboxProps) {
  const [messages, setMessages] = useState<SupportMessage[]>(initialMessages);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "needs_staff" | "mine" | "waiting_customer" | "resolved">("open");
  const [replyMode, setReplyMode] = useState<"public" | "internal">("public");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [isActionPending, startActionTransition] = useTransition();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Scroll to bottom on message change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Sync initial messages when activeConversation changes
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages, activeConversation?.id]);

  // Realtime subscription for incoming messages with reconnect reconciliation
  useEffect(() => {
    if (!activeConversation?.id) return;
    const conversationId = activeConversation.id;

    const channel = supabase
      .channel(`support:conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as SupportMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          supabase
            .from("support_messages")
            .select("id, conversation_id, sender_type, sender_user_id, content, is_internal, metadata, created_at")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: true })
            .then(({ data }) => {
              if (data && data.length > 0) {
                setMessages((prev) => {
                  const merged = [...(data as unknown as SupportMessage[])];
                  // Preserve any optimistic messages not yet settled
                  for (const p of prev) {
                    if (p.id.startsWith("temp_") && !merged.some((m) => m.content === p.content)) {
                      merged.push(p);
                    }
                  }
                  return merged;
                });
              }
            });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversation?.id, supabase]);

  // Filtered queue
  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();

    return conversations.filter((c) => {
      // Search
      const matchesSearch =
        !term ||
        c.category.toLowerCase().includes(term) ||
        (c.order?.order_number && c.order.order_number.toLowerCase().includes(term)) ||
        c.customer_id.toLowerCase().includes(term) ||
        c.id.toLowerCase().includes(term);

      if (!matchesSearch) return false;

      // Filter
      if (filter === "open") return c.status !== "RESOLVED" && c.status !== "CLOSED";
      if (filter === "needs_staff") return c.status === "WAITING_FOR_STAFF" || c.status === "OPEN";
      if (filter === "mine") return c.assigned_staff_id === currentStaffId;
      if (filter === "waiting_customer") return c.status === "WAITING_FOR_CUSTOMER";
      if (filter === "resolved") return c.status === "RESOLVED" || c.status === "CLOSED";

      return true;
    });
  }, [conversations, search, filter, currentStaffId]);

  // Handle send reply (public or internal note)
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !activeConversation || isSubmitting) return;

    setIsSubmitting(true);
    const formData = new FormData();
    formData.set("conversation_id", activeConversation.id);
    formData.set("content", content.trim());
    formData.set("is_internal", replyMode === "internal" ? "true" : "false");

    setContent("");
    await adminReplySupport(formData);
    setIsSubmitting(false);
  };

  // Handle resolve
  const handleResolve = () => {
    if (!activeConversation) return;
    const formData = new FormData();
    formData.set("conversation_id", activeConversation.id);
    if (resolutionNote.trim()) {
      formData.set("resolution_note", resolutionNote.trim());
    }

    startActionTransition(async () => {
      await adminResolveSupport(formData);
      setResolveOpen(false);
      setResolutionNote("");
    });
  };

  // Handle assign to me
  const handleAssignToMe = () => {
    if (!activeConversation) return;
    const formData = new FormData();
    formData.set("conversation_id", activeConversation.id);
    formData.set("staff_id", currentStaffId);

    startActionTransition(async () => {
      await adminAssignStaff(formData);
    });
  };

  // Handle reopen
  const handleReopen = () => {
    if (!activeConversation) return;
    const formData = new FormData();
    formData.set("conversation_id", activeConversation.id);

    startActionTransition(async () => {
      await adminReopenSupport(formData);
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start lg:min-h-[700px]">
      {/* ── Left Pane: Queue List (~360px) ── */}
      <div className="lg:col-span-4 space-y-4">
        {/* Search */}
        <div>
          <SearchField
            placeholder="Search ticket, order #, customer ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
            className="h-11 text-sm"
            aria-label="Search support tickets"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <Button
            variant={filter === "open" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("open")}
            className="text-[11px] h-7 px-2.5"
          >
            Open ({conversations.filter((c) => c.status !== "RESOLVED" && c.status !== "CLOSED").length})
          </Button>
          <Button
            variant={filter === "needs_staff" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("needs_staff")}
            className="text-[11px] h-7 px-2.5"
          >
            Needs Staff ({conversations.filter((c) => c.status === "WAITING_FOR_STAFF" || c.status === "OPEN").length})
          </Button>
          <Button
            variant={filter === "mine" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("mine")}
            className="text-[11px] h-7 px-2.5"
          >
            Mine
          </Button>
          <Button
            variant={filter === "resolved" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("resolved")}
            className="text-[11px] h-7 px-2.5"
          >
            Resolved
          </Button>
        </div>

        {/* Queue Items */}
        <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
          {filteredConversations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-xs text-muted-foreground">
                No tickets matching active filter.
              </CardContent>
            </Card>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = activeConversation?.id === conv.id;
              const isWaitingStaff = conv.status === "WAITING_FOR_STAFF";

              return (
                <Link
                  key={conv.id}
                  href={`/admin/support?id=${conv.id}`}
                  className={`block p-3 rounded-lg border text-xs transition-all ${
                    isSelected
                      ? "border-foreground bg-accent/40 shadow-sm"
                      : isWaitingStaff
                      ? "bg-amber-500/5 border-amber-500/30 hover:border-amber-500/60"
                      : "bg-card hover:bg-muted/50 border-border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold uppercase tracking-wide text-[10px]">
                      {conv.category.replace(/_/g, " ")}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {conv.priority === "URGENT" || conv.priority === "HIGH" ? (
                        <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
                          {conv.priority}
                        </Badge>
                      ) : null}
                      <Badge
                        variant={conv.status === "RESOLVED" ? "outline" : isWaitingStaff ? "default" : "secondary"}
                        className="text-[9px] px-1.5 py-0"
                      >
                        {conv.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </div>

                  {conv.order && (
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono mb-1">
                      <Package className="w-3 h-3" /> {conv.order.order_number} ({conv.order.status})
                    </div>
                  )}

                  {conv.summary && (
                    <p className="text-[11px] text-muted-foreground line-clamp-1 italic mb-1.5">
                      &quot;{conv.summary}&quot;
                    </p>
                  )}

                  <div className="text-[10px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/40">
                    <span className="font-mono text-[9px]">{conv.customer_id.slice(0, 8)}...</span>
                    <span>{new Date(conv.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right Pane: Conversation Details & Composer ── */}
      <div className="lg:col-span-8">
        {activeConversation ? (
          <Card className="flex flex-col min-h-[620px] lg:h-[700px]">
            {/* Conversation Header */}
            <CardHeader className="p-4 border-b flex-shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">
                      {activeConversation.category.replace(/_/g, " ")}
                    </span>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {activeConversation.status.replace(/_/g, " ")}
                    </Badge>
                    {activeConversation.ai_state === "PAUSED_FOR_HUMAN" && (
                      <Badge variant="secondary" className="text-[9px] gap-1">
                        <User className="w-2.5 h-2.5" /> Staff Handling
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-1">
                    <span className="font-mono">Customer: {activeConversation.customer_id}</span>
                    {activeConversation.order && (
                      <>
                        <span>·</span>
                        <Link
                          href={`/admin/orders/${activeConversation.order_id}`}
                          className="font-mono text-primary hover:underline flex items-center gap-1"
                        >
                          Order #{activeConversation.order.order_number}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </>
                    )}
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-2">
                  {staffMembers && staffMembers.length > 0 && activeConversation.status !== "RESOLVED" && (
                    <select
                      value={activeConversation.assigned_staff_id || ""}
                      onChange={(e) => {
                        const targetId = e.target.value;
                        if (targetId) {
                          startActionTransition(async () => {
                            await adminAssignStaff(activeConversation.id, targetId);
                          });
                        }
                      }}
                      disabled={isActionPending}
                      className="h-8 rounded-md border text-xs px-2 bg-background"
                      aria-label="Assign to staff member"
                    >
                      <option value="">Select staff...</option>
                      {staffMembers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {activeConversation.assigned_staff_id !== currentStaffId &&
                   activeConversation.status !== "RESOLVED" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAssignToMe}
                      disabled={isActionPending}
                      className="text-xs h-8"
                    >
                      Assign to Me
                    </Button>
                  )}

                  {activeConversation.status === "RESOLVED" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReopen}
                      disabled={isActionPending}
                      className="text-xs h-8"
                    >
                      Reopen Ticket
                    </Button>
                  ) : (
                    <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="text-xs h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Resolve Ticket
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Resolve Support Conversation</DialogTitle>
                          <DialogDescription className="text-xs">
                            Mark ticket as resolved. You can optionally record an internal resolution note.
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-2 py-2">
                          <label htmlFor="res_note" className="text-xs font-medium">Internal Note (Staff Only)</label>
                          <textarea
                            id="res_note"
                            rows={3}
                            value={resolutionNote}
                            onChange={(e) => setResolutionNote(e.target.value)}
                            placeholder="e.g. Explained dispatch timeline to customer; waybill provided."
                            className="w-full rounded-md border p-2 text-xs"
                          />
                        </div>

                        <DialogFooter>
                          <Button variant="outline" size="sm" onClick={() => setResolveOpen(false)}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={handleResolve} disabled={isActionPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            Confirm Resolution
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>

              {/* Advisory AI Summary Banner */}
              {activeConversation.summary && (
                <div className="mt-3 p-2.5 rounded bg-primary/5 border border-primary/20 text-xs flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-primary">AI Advisory Summary: </span>
                    <span className="text-muted-foreground">{activeConversation.summary}</span>
                  </div>
                </div>
              )}
            </CardHeader>

            {/* Conversation Timeline */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs bg-muted/20">
              {messages.map((msg) => {
                const isCustomer = msg.sender_type === "CUSTOMER";
                const isAI = msg.sender_type === "AI";
                const isInternal = msg.is_internal;
                const isSystem = msg.sender_type === "SYSTEM";

                if (isSystem) {
                  return (
                    <div key={msg.id} className="flex justify-center my-2">
                      <div className="text-[10px] bg-muted px-2.5 py-1 rounded-full text-muted-foreground border">
                        {msg.content}
                      </div>
                    </div>
                  );
                }

                if (isInternal) {
                  return (
                    <div key={msg.id} className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 my-2">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-amber-600 dark:text-amber-400 mb-1">
                        <span className="flex items-center gap-1">
                          <Lock className="w-3 h-3" /> INTERNAL STAFF NOTE
                        </span>
                        <span>{new Date(msg.created_at).toLocaleString()}</span>
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isCustomer ? "items-start" : "items-end"}`}
                  >
                    {/* Header tag */}
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1 px-1">
                      {isCustomer ? (
                        <span className="font-semibold text-foreground">Customer</span>
                      ) : isAI ? (
                        <span className="flex items-center gap-1 text-primary font-semibold">
                          <Bot className="w-3 h-3" /> 1968 Assistant (AI)
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-foreground font-semibold">
                          <Shield className="w-3 h-3" /> Staff Reply
                        </span>
                      )}
                      <span>·</span>
                      <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>

                    {/* Bubble */}
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 leading-relaxed whitespace-pre-wrap ${
                        isCustomer
                          ? "bg-card border shadow-xs rounded-tl-xs"
                          : isAI
                          ? "bg-primary/10 border border-primary/20 text-foreground"
                          : "bg-foreground text-background rounded-tr-xs"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Admin Composer */}
            <div className="p-3 border-t bg-card flex-shrink-0 space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={replyMode === "public" ? "default" : "outline"}
                  onClick={() => setReplyMode("public")}
                  className="h-7 text-xs"
                >
                  Public Reply to Customer
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={replyMode === "internal" ? "secondary" : "outline"}
                  onClick={() => setReplyMode("internal")}
                  className="h-7 text-xs gap-1"
                >
                  <Lock className="w-3 h-3 text-amber-500" />
                  Private Staff Note
                </Button>
              </div>

              <form onSubmit={handleSendReply} className="flex items-end gap-2">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply(e);
                    }
                  }}
                  placeholder={
                    replyMode === "internal"
                      ? "Write an internal note (only visible to staff)..."
                      : "Write a public reply to the customer..."
                  }
                  rows={2}
                  className={`flex-1 min-h-[44px] max-h-32 rounded-md border p-2.5 text-xs ring-offset-background focus:outline-none focus:ring-2 resize-none ${
                    replyMode === "internal"
                      ? "border-amber-500/50 bg-amber-50/20 dark:bg-amber-950/20 focus:ring-amber-500"
                      : "border-input bg-background focus:ring-ring"
                  }`}
                />
                <Button
                  type="submit"
                  size="default"
                  disabled={!content.trim() || isSubmitting}
                  className={`h-11 px-4 gap-1.5 ${
                    replyMode === "internal"
                      ? "bg-amber-600 hover:bg-amber-700 text-white"
                      : ""
                  }`}
                >
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {replyMode === "internal" ? "Save Note" : "Send Reply"}
                </Button>
              </form>
            </div>
          </Card>
        ) : (
          <Card className="min-h-[360px] lg:h-[700px] flex items-center justify-center text-center p-8">
            <div className="space-y-2">
              <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto" />
              <CardTitle className="text-sm">No Conversation Selected</CardTitle>
              <CardDescription className="text-xs max-w-sm">
                Select an inquiry from the queue on the left to review customer messages, view AI summaries, and reply.
              </CardDescription>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
