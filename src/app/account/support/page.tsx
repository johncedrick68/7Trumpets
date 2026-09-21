import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getCustomerConversations,
  getConversationWithMessages,
  getCustomerRecentOrders,
  type SupportConversation,
  type SupportMessage,
} from "@/lib/support/queries";
import { SupportCenterClient } from "@/components/support/support-center-client";
import { AccountNavigation } from "@/components/account-navigation";

export const dynamic = "force-dynamic";

interface SearchParams {
  id?: string;
  order_id?: string;
  category?: string;
  error?: string;
}

export default async function CustomerSupportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?return_to=/account/support");
  }

  const { id: selectedId, order_id: preselectedOrderId, category: preselectedCategory } = await searchParams;

  const [conversations, recentOrders] = await Promise.all([
    getCustomerConversations(),
    getCustomerRecentOrders(),
  ]);

  const activeConvId = selectedId || (conversations.length > 0 && !preselectedOrderId ? conversations[0].id : null);

  let activeConversation: SupportConversation | null = null;
  let initialMessages: SupportMessage[] = [];

  if (activeConvId) {
    const result = await getConversationWithMessages(activeConvId);
    activeConversation = result.conversation;
    initialMessages = result.messages;
  }

  return (
    <main className="account-container page-section min-h-screen">
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Customer Account</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Manage your orders, saved delivery addresses, security settings, and support requests.
        </p>
      </header>

      <AccountNavigation current="support" />

      <SupportCenterClient
        conversations={conversations}
        activeConversation={activeConversation}
        initialMessages={initialMessages}
        recentOrders={recentOrders}
        preselectedOrderId={preselectedOrderId}
        preselectedCategory={preselectedCategory}
      />
    </main>
  );
}
