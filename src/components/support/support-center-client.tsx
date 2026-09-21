"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Send,
  User,
  Bot,
  Shield,
  CheckCircle2,
  Package,
  Plus,
  RefreshCw,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";

import { SupportConversation, SupportMessage } from "@/lib/support/queries";
import { createSupportConversation, sendCustomerMessage, requestHumanHandoff } from "@/lib/support/actions";
import { createClient } from "@/lib/supabase/client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface SupportCenterClientProps {
  conversations: SupportConversation[];
  activeConversation: SupportConversation | null;
  initialMessages: SupportMessage[];
  recentOrders: Array<{
    id: string;
    order_number: string;
    total_minor: number;
    status: string;
  }>;
  preselectedOrderId?: string;
  preselectedCategory?: string;
}

export function SupportCenterClient({
  conversations,
  activeConversation,
  initialMessages,
  recentOrders,
  preselectedOrderId,
  preselectedCategory,
}: SupportCenterClientProps) {
  const [messages, setMessages] = useState<SupportMessage[]>(initialMessages);
  const [isCreatingNew, setIsCreatingNew] = useState(!activeConversation || Boolean(preselectedOrderId));
  const [selectedCategory, setSelectedCategory] = useState<string>(preselectedCategory || "ORDER_STATUS");
  const [selectedOrderId, setSelectedOrderId] = useState<string>(preselectedOrderId || "");
  const [inputContent, setInputContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isRequestingHuman, startHumanTransition] = useTransition();
  const [isCreating, startCreateTransition] = useTransition();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Scroll to bottom whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Sync initial messages when activeConversation changes
  useEffect(() => {
    setMessages(initialMessages);
    if (activeConversation) {
      setIsCreatingNew(false);
    }
  }, [initialMessages, activeConversation]);

  // Realtime subscription to conversation messages with reconnect reconciliation
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
          if (!newMsg.is_internal) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              // Deduplicate and replace any optimistic temp message
              const hasOptimistic = prev.some(
                (m) => m.id.startsWith("temp_") && m.content === newMsg.content && m.sender_type === newMsg.sender_type
              );
              if (hasOptimistic) {
                return prev.map((m) =>
                  m.id.startsWith("temp_") && m.content === newMsg.content && m.sender_type === newMsg.sender_type
                    ? newMsg
                    : m
                );
              }
              return [...prev, newMsg];
            });
          }
        }
      )
      .subscribe((status) => {
        // When connected or reconnected after temporary drop, reconcile with database truth
        if (status === "SUBSCRIBED") {
          supabase
            .from("support_messages")
            .select("id, conversation_id, sender_type, sender_user_id, content, is_internal, metadata, created_at")
            .eq("conversation_id", conversationId)
            .eq("is_internal", false)
            .order("created_at", { ascending: true })
            .then(({ data }) => {
              if (data && data.length > 0) {
                setMessages((prev) => {
                  const tempMessages = prev.filter((m) => m.id.startsWith("temp_"));
                  const merged = [...(data as unknown as SupportMessage[])];
                  for (const temp of tempMessages) {
                    if (!merged.some((m) => m.content === temp.content && m.sender_type === temp.sender_type)) {
                      merged.push(temp);
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

  // Handle message sending
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim() || !activeConversation || isSending) return;

    const content = inputContent.trim();
    setInputContent("");
    setIsSending(true);

    const formData = new FormData();
    formData.set("conversation_id", activeConversation.id);
    formData.set("content", content);

    // Optimistic message append
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: SupportMessage = {
      id: tempId,
      conversation_id: activeConversation.id,
      sender_type: "CUSTOMER",
      sender_user_id: null,
      content,
      is_internal: false,
      metadata: {},
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    const res = await sendCustomerMessage(formData);
    setIsSending(false);

    if (res?.error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      alert(res.error);
    }
  };

  // Handle request human handoff
  const handleRequestHuman = () => {
    if (!activeConversation || isRequestingHuman) return;
    const formData = new FormData();
    formData.set("conversation_id", activeConversation.id);

    startHumanTransition(async () => {
      const res = await requestHumanHandoff(formData);
      if (res?.error) {
        alert(res.error);
      }
    });
  };

  // Quick intent buttons
  const quickIntents = [
    { label: "Track my order", category: "ORDER_STATUS" },
    { label: "Payment question", category: "PAYMENT" },
    { label: "Delivery issue", category: "DELIVERY" },
    { label: "Change size / return", category: "RETURN_EXCHANGE" },
    { label: "Product question", category: "PRODUCT" },
    { label: "Account help", category: "ACCOUNT" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start min-h-[600px]">
      {/* ── Left Sidebar: Recent Conversations & Quick Launcher ── */}
      <div className={`lg:col-span-4 space-y-4 ${activeConversation && !isCreatingNew ? "hidden lg:block" : "block"}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Support Threads
          </h2>
          <Button
            size="sm"
            variant={isCreatingNew ? "default" : "outline"}
            onClick={() => setIsCreatingNew(true)}
            className="text-xs h-7 gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> New Ticket
          </Button>
        </div>

        {/* Conversation List */}
        <div className="space-y-2">
          {conversations.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-xs text-muted-foreground">
                No support conversations yet. Start one anytime below.
              </CardContent>
            </Card>
          ) : (
            conversations.map((conv) => {
              const isSelected = activeConversation?.id === conv.id && !isCreatingNew;
              return (
                <Link
                  key={conv.id}
                  href={`/account/support?id=${conv.id}`}
                  className={`block p-3 rounded-lg border text-xs transition-all ${
                    isSelected
                      ? "border-foreground bg-accent/40 shadow-sm"
                      : "bg-card hover:bg-muted/50 border-border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold uppercase tracking-wide text-[10px]">
                      {conv.category.replace("_", " ")}
                    </span>
                    <Badge
                      variant={conv.status === "RESOLVED" ? "outline" : "default"}
                      className="text-[9px] px-1.5 py-0"
                    >
                      {conv.status.replace(/_/g, " ")}
                    </Badge>
                  </div>

                  {conv.order && (
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono mb-1">
                      <Package className="w-3 h-3" /> {conv.order.order_number}
                    </div>
                  )}

                  <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                    <span>{new Date(conv.last_message_at).toLocaleDateString()}</span>
                    <span className="capitalize">{conv.ai_state === "ACTIVE" ? "AI Assistant" : "Staff Handling"}</span>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* Quick Intents Launcher */}
        <Card className="border-dashed">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-semibold">Common Topics</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1 flex flex-wrap gap-1.5">
            {quickIntents.map((qi) => (
              <button
                key={qi.category}
                type="button"
                onClick={() => {
                  setSelectedCategory(qi.category);
                  setIsCreatingNew(true);
                }}
                className="text-[11px] px-2 py-1 rounded bg-muted hover:bg-muted/80 text-foreground border border-border/50 text-left transition-colors"
              >
                {qi.label}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Right / Main Pane: Conversation Chat OR New Ticket Form ── */}
      <div className={`lg:col-span-8 ${!activeConversation && !isCreatingNew ? "hidden lg:block" : "block"}`}>
        {isCreatingNew ? (
          /* New Ticket Composer */
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> Start a Support Conversation
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Our automated assistant answers common questions immediately. You can request human assistance anytime.
                  </CardDescription>
                </div>
                {activeConversation && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsCreatingNew(false)}
                    className="text-xs h-7"
                  >
                    Back to Chat
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <form
                action={(formData) => {
                  startCreateTransition(async () => {
                    await createSupportConversation(formData);
                  });
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="category" className="text-xs">Inquiry Category</Label>
                    <select
                      id="category"
                      name="category"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <option value="ORDER_STATUS">Order Status & Dispatch</option>
                      <option value="DELIVERY">Delivery & Courier</option>
                      <option value="PAYMENT">Manual GCash / Cash Payment</option>
                      <option value="RETURN_EXCHANGE">Size Exchange or Return</option>
                      <option value="PRODUCT">Garment Details & Sizing</option>
                      <option value="ACCOUNT">Account & Settings</option>
                      <option value="OTHER">General Inquiry</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="order_id" className="text-xs">Related Order (Optional)</Label>
                    <select
                      id="order_id"
                      name="order_id"
                      value={selectedOrderId}
                      onChange={(e) => setSelectedOrderId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <option value="">None / Not Order Specific</option>
                      {recentOrders.map((ord) => (
                        <option key={ord.id} value={ord.id}>
                          {ord.order_number} ({ord.status})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="initial_message" className="text-xs">How can we help?</Label>
                  <textarea
                    id="initial_message"
                    name="initial_message"
                    rows={4}
                    required
                    placeholder="Describe your inquiry or question in detail..."
                    className="flex w-full rounded-md border border-input bg-background p-3 text-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="submit" disabled={isCreating} className="gap-2">
                    {isCreating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Start Conversation
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : activeConversation ? (
          /* Active Chat Thread */
          <Card className="flex flex-col h-[650px]">
            {/* Header */}
            <CardHeader className="p-4 border-b flex-shrink-0 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCreatingNew(true)}
                  className="lg:hidden p-1.5 h-8 w-8"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">
                      {activeConversation.category.replace(/_/g, " ")}
                    </span>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {activeConversation.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  {activeConversation.order && (
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono mt-0.5">
                      <Package className="w-3 h-3" />
                      Order {activeConversation.order.order_number} ({activeConversation.order.status})
                    </div>
                  )}
                </div>
              </div>

              {/* Human Handoff Action */}
              {activeConversation.status !== "WAITING_FOR_STAFF" &&
               activeConversation.status !== "STAFF_HANDLING" &&
               activeConversation.status !== "RESOLVED" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRequestHuman}
                  disabled={isRequestingHuman}
                  className="text-xs h-8 gap-1.5"
                >
                  {isRequestingHuman ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <User className="w-3 h-3" />
                  )}
                  Talk to a Person
                </Button>
              )}
            </CardHeader>

            {/* Chat Timeline */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs bg-muted/20">
              {messages.map((msg) => {
                const isCustomer = msg.sender_type === "CUSTOMER";
                const isAI = msg.sender_type === "AI";
                const isSystem = msg.sender_type === "SYSTEM";

                if (isSystem) {
                  return (
                    <div key={msg.id} className="flex justify-center my-2">
                      <div className="text-[10px] bg-muted px-2.5 py-1 rounded-full text-muted-foreground border flex items-center gap-1.5">
                        <AlertCircle className="w-3 h-3" />
                        {msg.content}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isCustomer ? "items-end" : "items-start"}`}
                  >
                    {/* Sender Label */}
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1 px-1">
                      {isCustomer ? (
                        <span>You</span>
                      ) : isAI ? (
                        <span className="flex items-center gap-1 font-semibold text-primary">
                          <Bot className="w-3 h-3" /> 1968 Assistant (AI Support)
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 font-semibold text-foreground">
                          <Shield className="w-3 h-3" /> 1968 Staff
                        </span>
                      )}
                      <span>·</span>
                      <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 leading-relaxed whitespace-pre-wrap ${
                        isCustomer
                          ? "bg-foreground text-background rounded-tr-xs"
                          : isAI
                          ? "bg-card border shadow-xs rounded-tl-xs"
                          : "bg-primary/10 border border-primary/20 text-foreground rounded-tl-xs"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Composer */}
            <div className="p-3 border-t bg-card flex-shrink-0">
              {activeConversation.status === "RESOLVED" || activeConversation.status === "CLOSED" ? (
                <div className="text-center py-2 text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  This conversation has been marked as resolved. Send a message to reopen.
                </div>
              ) : null}

              <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                <textarea
                  value={inputContent}
                  onChange={(e) => setInputContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                  placeholder="Type your message..."
                  rows={2}
                  className="flex-1 min-h-[44px] max-h-32 rounded-md border border-input bg-background p-2.5 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
                <Button
                  type="submit"
                  size="default"
                  disabled={!inputContent.trim() || isSending}
                  className="h-11 px-4 gap-1.5"
                >
                  {isSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send
                </Button>
              </form>
            </div>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-20 text-center text-xs text-muted-foreground">
              Select an existing thread from the left or create a new support ticket.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
