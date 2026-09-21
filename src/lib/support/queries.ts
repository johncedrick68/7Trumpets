import { createClient } from "@/lib/supabase/server";

export interface SupportConversation {
  id: string;
  customer_id: string;
  order_id: string | null;
  category: string;
  priority: string;
  status: string;
  assigned_staff_id: string | null;
  ai_state: string;
  summary: string | null;
  last_message_at: string;
  resolved_at: string | null;
  created_at: string;
  order?: {
    order_number: string;
    status: string;
    total_minor: number;
    fulfillment_method: string;
  } | null;
}

export interface SupportMessage {
  id: string;
  conversation_id: string;
  sender_type: "CUSTOMER" | "STAFF" | "AI" | "SYSTEM";
  sender_user_id: string | null;
  content: string;
  is_internal: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Fetch all conversations for the authenticated customer.
 */
export async function getCustomerConversations(): Promise<SupportConversation[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("support_conversations")
    .select(`
      id, customer_id, order_id, category, priority, status, assigned_staff_id, ai_state, summary, last_message_at, resolved_at, created_at,
      orders:order_id (order_number, status, total_minor, fulfillment_method)
    `)
    .eq("customer_id", user.id)
    .order("last_message_at", { ascending: false });

  if (error || !data) return [];

  return data.map((d) => {
    const raw = d as unknown as Record<string, unknown>;
    const orderData = Array.isArray(raw.orders) ? raw.orders[0] : raw.orders;
    return {
      ...d,
      order: (orderData as SupportConversation["order"]) || null,
    } as SupportConversation;
  });
}

/**
 * Fetch a conversation and its messages for customer view (is_internal = false enforced by RLS).
 */
export async function getConversationWithMessages(conversationId: string): Promise<{
  conversation: SupportConversation | null;
  messages: SupportMessage[];
}> {
  const supabase = await createClient();

  const { data: conv, error: convErr } = await supabase
    .from("support_conversations")
    .select(`
      id, customer_id, order_id, category, priority, status, assigned_staff_id, ai_state, summary, last_message_at, resolved_at, created_at,
      orders:order_id (order_number, status, total_minor, fulfillment_method)
    `)
    .eq("id", conversationId)
    .single();

  if (convErr || !conv) {
    return { conversation: null, messages: [] };
  }

  const { data: messages } = await supabase
    .from("support_messages")
    .select("id, conversation_id, sender_type, sender_user_id, content, is_internal, metadata, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  const rawConv = conv as unknown as Record<string, unknown>;
  const orderData = Array.isArray(rawConv.orders) ? rawConv.orders[0] : rawConv.orders;

  return {
    conversation: {
      ...conv,
      order: (orderData as SupportConversation["order"]) || null,
    } as SupportConversation,
    messages: (messages || []) as unknown as SupportMessage[],
  };
}

/**
 * Fetch recent orders for customer support attachment dropdown.
 */
export async function getCustomerRecentOrders() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("orders")
    .select("id, order_number, total_minor, status, created_at, fulfillment_method")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return data || [];
}
