import { requireAdminAal2 } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/server-log";
import { SupportInbox } from "@/components/admin/support-inbox";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminErrorState } from "@/components/admin/admin-table";
import { SupportConversation, SupportMessage } from "@/lib/support/queries";
import { relationToOne } from "@/lib/data/relations";

export const dynamic = "force-dynamic";

interface SearchParams {
  id?: string;
  notice?: string;
  error?: string;
}

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const adminCtx = await requireAdminAal2("/admin/support");
  const { id: selectedId } = await searchParams;

  const supabase = await createClient();

  // 1. Fetch all support conversations
  const { data: convData, error: convError } = await supabase
    .from("support_conversations")
    .select(`
      id, customer_id, order_id, category, priority, status, assigned_staff_id, ai_state, summary, last_message_at, resolved_at, created_at,
      orders:order_id (order_number, status, total_minor, fulfillment_method)
    `)
    .order("last_message_at", { ascending: false });

  if (convError) {
    logServerError("admin.support.load", "database_failure");
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Support Operations Inbox"
          description="Triage customer inquiries, post internal staff notes, and resolve tickets."
        />
        <div className="rounded-xl border border-border bg-card p-6">
          <AdminErrorState
            title="Support Inbox Unavailable"
            description="Unable to load customer support conversations from PostgreSQL. Please check database permissions and retry."
          />
        </div>
      </div>
    );
  }

  const conversations: SupportConversation[] = (convData || []).map((d) => {
    const raw = d as unknown as Record<string, unknown>;
    const orderData = relationToOne(raw.orders as SupportConversation["order"] | SupportConversation["order"][]);
    return {
      ...d,
      order: (orderData as SupportConversation["order"]) || null,
    } as SupportConversation;
  });

  const activeId = selectedId || (conversations.length > 0 ? conversations[0].id : null);

  let activeConversation: SupportConversation | null = null;
  let messages: SupportMessage[] = [];

  if (activeId) {
    activeConversation = conversations.find((c) => c.id === activeId) || null;

    const { data: msgData } = await supabase
      .from("support_messages")
      .select("id, conversation_id, sender_type, sender_user_id, content, is_internal, metadata, created_at")
      .eq("conversation_id", activeId)
      .order("created_at", { ascending: true });

    messages = (msgData || []) as SupportMessage[];
  }

  // 2. Fetch staff members for assignment
  const { data: staffRoles } = await supabase.rpc("list_staff_roles");
  const staffList = (staffRoles || []).map((s) => {
    const staff = s as { user_id: string; role: string };
    return {
      id: staff.user_id,
      name: `${staff.role.toUpperCase()} (${staff.user_id.slice(0, 6)})`,
    };
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Support Operations Inbox"
        description="Triage customer inquiries, post internal staff notes, and resolve tickets."
      />

      <SupportInbox
        conversations={conversations}
        activeConversation={activeConversation}
        initialMessages={messages}
        currentStaffId={adminCtx.userId}
        staffMembers={staffList}
      />
    </div>
  );
}
