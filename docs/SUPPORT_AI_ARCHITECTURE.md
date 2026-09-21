# 1968 Clothing — Customer Support, Staff Onboarding, AI Assistant & Automation Architecture

> Canonical specification for Staff Onboarding, MFA Lifecycle, Customer Operations, Support Center & Inbox, Gemini 3.8 Flash Assistance, and Asynchronous n8n Automation Orchestration.

---

## 1. Current State & Baseline Audit

- **Auth & Identity**:
  - `auth.users` manages authentication credentials and MFA factors (`auth.mfa_factors`).
  - `public.profiles` mirrors display name, phone, and metadata.
  - `private.user_roles` holds authoritative role mappings (`customer`, `cashier`, `admin`, `super_admin`).
  - Roles are assigned or revoked strictly via `private.manage_user_role` (which enforces AAL2 and preserves the last active `super_admin`).
- **Admin Users / Staff UI**:
  - `/admin/users` currently allows Super Admins at AAL2 to assign/revoke roles by pasting a user UUID.
  - No pending invitation workflow, no direct MFA reset action with safety confirmation, and customer management is currently absent.
- **Store Settings & Policies**:
  - `public.store_settings` stores key-value configuration (`announcement`, `hero`, `fulfillment`, `payment`, `collections`, `footer`, `returns`).
  - Clean query and mutation boundaries already exist via `src/lib/settings/queries.ts` and `src/lib/settings/actions.ts`.
- **Commerce & Order Lifecycle**:
  - Orders, shipments, GCash payment submissions, and returns are tracked canonically in PostgreSQL.
  - Customer progress uses `CONFIRMED -> PREPARING -> SHIPPING -> ARRIVING -> DELIVERED`.
- **Support & Realtime**:
  - Currently no database tables exist for support conversations or messages (only static `footer.support_email`).
  - No outbox table exists for asynchronous background automation.
  - Realtime capability is available in Supabase for broadcast channels and table publications.

---

## 2. Reuse Strategy

1. **AAL2 & Admin Boundaries**:
   - Reuse `requireAdminAal2` from `src/lib/admin/auth.ts` to guard all staff invitation, role assignment, MFA reset, and settings mutations.
   - Reuse `app_is_admin()` and `private.has_role()` database security definer functions for RLS and RPC constraints.
2. **Audit Logging**:
   - Reuse `public.audit_logs` (with action types like `staff.invited`, `mfa.reset`, `support.resolved`, `settings.updated`).
3. **Store Settings Pattern**:
   - Reuse `public.store_settings` to store `ai_settings` (`enabled`, `auto_reply_enabled`, `auto_reply_confidence_threshold`, `model_name`, `kill_switch`) without storing API keys.
4. **Order Status & Courier Utilities**:
   - Reuse `src/lib/orders/courier.ts` and `src/lib/orders/status.ts` for AI tool functions (`get_customer_tracking`, `get_customer_order_summary`).

---

## 3. New Schema & Tables

### 3.1. Staff Invitations (`public.staff_invitations`)
Tracks pending and processed invitations for staff roles:
- `id` (UUID, PK)
- `email` (TEXT, NOT NULL, Lowercase)
- `full_name` (TEXT, NOT NULL)
- `requested_role` (TEXT, CHECK `requested_role IN ('cashier', 'admin', 'super_admin')`)
- `invited_by` (UUID, FK `auth.users(id)`)
- `status` (TEXT, CHECK `status IN ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')`, DEFAULT `'PENDING'`)
- `token_hash` (TEXT, NOT NULL, Unique)
- `expires_at` (TIMESTAMPTZ, NOT NULL)
- `accepted_at` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ, NOT NULL DEFAULT now())

### 3.2. Support Conversations (`public.support_conversations`)
- `id` (UUID, PK)
- `customer_id` (UUID, NOT NULL, FK `auth.users(id)`)
- `order_id` (UUID, NULLABLE, FK `public.orders(id)`)
- `category` (TEXT, CHECK `category IN ('ORDER_STATUS', 'PAYMENT', 'DELIVERY', 'PRODUCT', 'SIZE', 'RETURN_EXCHANGE', 'ACCOUNT', 'OTHER')`)
- `priority` (TEXT, CHECK `priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')`, DEFAULT `'NORMAL'`)
- `status` (TEXT, CHECK `status IN ('OPEN', 'WAITING_FOR_STAFF', 'STAFF_HANDLING', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED')`, DEFAULT `'OPEN'`)
- `assigned_staff_id` (UUID, NULLABLE, FK `auth.users(id)`)
- `ai_state` (TEXT, CHECK `ai_state IN ('ACTIVE', 'PAUSED_FOR_HUMAN', 'DISABLED')`, DEFAULT `'ACTIVE'`)
- `summary` (TEXT, NULLABLE) -- Advisory AI summary for staff
- `last_message_at` (TIMESTAMPTZ, NOT NULL DEFAULT now())
- `resolved_at` (TIMESTAMPTZ, NULLABLE)
- `created_at` (TIMESTAMPTZ, NOT NULL DEFAULT now())
- `updated_at` (TIMESTAMPTZ, NOT NULL DEFAULT now())

### 3.3. Support Messages (`public.support_messages`)
- `id` (UUID, PK)
- `conversation_id` (UUID, NOT NULL, FK `public.support_conversations(id)` ON DELETE CASCADE)
- `sender_type` (TEXT, CHECK `sender_type IN ('CUSTOMER', 'STAFF', 'AI', 'SYSTEM')`)
- `sender_user_id` (UUID, NULLABLE, FK `auth.users(id)`)
- `content` (TEXT, NOT NULL CHECK (btrim(content) <> ''))
- `is_internal` (BOOLEAN, NOT NULL DEFAULT false) -- Staff private notes, never exposed to customer or Gemini
- `metadata` (JSONB, NOT NULL DEFAULT '{}'::jsonb)
- `created_at` (TIMESTAMPTZ, NOT NULL DEFAULT now())

### 3.4. Automation Outbox (`public.automation_outbox`)
Guarantees reliable, decoupled asynchronous event delivery to n8n:
- `id` (UUID, PK)
- `event_type` (TEXT, NOT NULL)
- `aggregate_type` (TEXT, NOT NULL)
- `aggregate_id` (TEXT, NOT NULL)
- `payload` (JSONB, NOT NULL)
- `status` (TEXT, CHECK `status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED')`, DEFAULT `'PENDING'`)
- `attempt_count` (INTEGER, NOT NULL DEFAULT 0)
- `available_at` (TIMESTAMPTZ, NOT NULL DEFAULT now())
- `processed_at` (TIMESTAMPTZ, NULLABLE)
- `error_message` (TEXT, NULLABLE)
- `created_at` (TIMESTAMPTZ, NOT NULL DEFAULT now())

### 3.5. AI Telemetry & Usage (`public.ai_usage_logs`)
- `id` (UUID, PK)
- `feature` (TEXT, NOT NULL) -- e.g. `'support_assistant'`, `'ask_1968'`, `'daily_brief'`
- `model` (TEXT, NOT NULL)
- `latency_ms` (INTEGER, NOT NULL)
- `success` (BOOLEAN, NOT NULL)
- `input_tokens` (INTEGER, NULLABLE)
- `output_tokens` (INTEGER, NULLABLE)
- `estimated_cost_minor` (INTEGER, NULLABLE)
- `conversation_id` (UUID, NULLABLE)
- `error_code` (TEXT, NULLABLE)
- `created_at` (TIMESTAMPTZ, NOT NULL DEFAULT now())

### 3.6. Daily Admin Briefs (`public.admin_daily_briefs`)
- `id` (UUID, PK)
- `brief_date` (DATE, NOT NULL UNIQUE)
- `summary` (TEXT, NOT NULL)
- `metrics_snapshot` (JSONB, NOT NULL)
- `generated_by` (TEXT, NOT NULL DEFAULT 'gemini-3.8-flash')
- `created_at` (TIMESTAMPTZ, NOT NULL DEFAULT now())

---

## 4. Security & RLS Policy Matrix

| Table | Role | Allowed Operations | Condition / Filter |
|---|---|---|---|
| `staff_invitations` | `anon`, `customer` | None | Denied |
| `staff_invitations` | `super_admin` | SELECT, INSERT, UPDATE | `app_is_admin()` AND `has_role('super_admin')` |
| `support_conversations` | `customer` | SELECT | `auth.uid() = customer_id` (Creation via `create_support_conversation` RPC; direct generic UPDATE is strictly DENIED) |
| `support_conversations` | `admin` / `staff` | SELECT, UPDATE | `app_is_admin()` (Direct UPDATE guarded by AAL2; canonical RPCs preferred) |
| `support_messages` | `customer` | SELECT | `is_internal = false` AND conversation owned by `auth.uid()` |
| `support_messages` | `customer` | INSERT | Sender must be `CUSTOMER`, `is_internal = false`, `sender_user_id = auth.uid()`, and conversation owned by `auth.uid()` |
| `support_messages` | `admin` / `staff` | SELECT, INSERT | `app_is_admin()` (can read/write public and `is_internal = true`) |
| `automation_outbox` | `customer` | None | Denied |
| `automation_outbox` | `service_role` | ALL | Internal trusted background dispatcher |
| `ai_usage_logs` | `customer` | None | Denied |
| `ai_usage_logs` | `admin` | SELECT | `app_is_admin()` |
| `admin_daily_briefs` | `admin` | SELECT | `app_is_admin()` |

---

## 5. AAL2 & Super Admin Governance

1. **Staff Invitations**:
   - Creating a staff invitation requires active Super Admin role with AAL2 verification.
   - For Super Admin invitations, an explicit acknowledgment warning is presented in the UI.
2. **Individual MFA Enrollment**:
   - Invited staff accounts must enroll their own authenticator app on first login.
   - No sharing of TOTP secrets or master seeds.
3. **MFA Reset**:
   - Dedicated action for Super Admins at AAL2.
   - Requires target confirmation, deletes active `auth.mfa_factors`, and records an immutable audit log entry.
4. **Last Super Admin Invariant**:
   - Protected at the database trigger layer (`user_roles_preserve_last_super_admin`) and in server action validations.

---

## 6. Realtime Architecture

- **Private Conversation Channels**:
  - Channel name: `support:conversation:{conversation_id}`
  - Supabase Realtime Broadcast is used for sending instant message notifications to active clients.
  - Additionally, `support_messages` is added to the `supabase_realtime` publication with RLS enforced so that client reconnection automatically retrieves fresh state without message drops.
- **Cross-Customer Isolation**:
  - Client subscription checks verify customer ownership of `conversation_id` before joining the channel.
  - Server actions broadcast only to authorized channel topics.

---

## 7. Gemini AI Assistant Architecture

### 7.1. Boundaries & Placement
- **Server Only**:
  - `GEMINI_API_KEY` is loaded strictly on the server (`process.env.GEMINI_API_KEY`). It is never prefixed with `NEXT_PUBLIC_` or exposed in browser bundles.
  - Model calls occur via `src/lib/ai/gemini.ts` and `src/lib/ai/support.ts`.
- **Model**:
  - Default: `gemini-3.8-flash` with low-to-medium temperature and reasoning.
- **Identity**:
  - Identifies strictly as **1968 Assistant** (AI support). Never impersonates human staff, owners, or couriers.

### 7.2. Read-Only Controlled Tools
The AI assistant has access to **strictly read-only** tools:
1. `get_customer_order_summary(order_id)`: Fetches items, order status, total, payment status for current customer.
2. `get_customer_tracking(order_id)`: Fetches courier provider, tracking number, waybill link for current customer.
3. `get_product_availability(slug_or_id)`: Checks variant stock levels.
4. `get_product_sizes(slug_or_id)`: Fetches size chart and dimensions.
5. `get_store_policy(topic)`: Returns shipping, return, GCash, or pickup policies from `store_settings`.
6. `get_return_eligibility(order_id)`: Checks delivery date and return window.

### 7.3. Forbidden Tools (Strict Invariant)
The AI is **never** given tools to:
- Approve or reject payments.
- Issue refunds or store credits.
- Mutate inventory.
- Cancel arbitrary orders.
- Change staff roles or reset MFA.

### 7.4. Handoff & Fallback
- **Auto-Reply Gate**:
  - AI only replies automatically for low-risk, high-confidence queries (FAQ, size, tracking lookup, store policies).
  - Any payment dispute, money discrepancy, refund claim, damaged item, or customer dissatisfaction triggers **immediate escalation to `WAITING_FOR_STAFF`**.
- **Customer Human Request**:
  - "Talk to a person" / "Human support" immediately sets `status = 'WAITING_FOR_STAFF'` and `ai_state = 'PAUSED_FOR_HUMAN'`.
- **System Fallback**:
  - If the Gemini API times out, rate limits, or fails, the user message is safely persisted, status becomes `WAITING_FOR_STAFF`, and the customer is informed: *"Your message has been sent to the 1968 support team."*

---

## 8. Admin "Ask 1968" Intelligence

- Located in `/admin` (dashboard modal or drawer).
- Executes predefined, trusted analytical queries:
  - `get_admin_attention_summary()` (pending payments, delayed shipments, open support).
  - `get_sales_summary(period)`.
  - `get_inventory_risks()` (low stock items).
  - `get_slow_movers(period)`.
  - `get_payment_queue_summary()`.
  - `get_fulfillment_backlog()`.
  - `get_support_queue_summary()`.
- Gemini receives verified JSON outputs from these queries and generates an executive summary. Gemini **never** executes arbitrary SQL.

---

## 9. n8n Automation & Outbox Architecture

- **Role**:
  - n8n acts as an **orchestrator** for background notifications, asynchronous support classification, and daily briefs.
  - It is **never in the critical path** of checkout, payment, or order placement. If n8n is offline, 100% of commerce and manual support functions continue without disruption.
- **Outbox Pattern**:
  - Domain events (`SUPPORT_MESSAGE_CREATED`, `ORDER_PLACED`, `PAYMENT_APPROVED`, etc.) are written transactionally to `public.automation_outbox`.
  - An internal webhook dispatcher or cron worker pushes events to n8n with an HMAC signature (`N8N_WEBHOOK_SECRET`).
- **Sanitized Workflow Templates**:
  - Exported to `automation/n8n/` without embedded secrets.

---

## 10. Privacy & Data Minimization

- Only necessary fields are passed to Gemini:
  - Customer display name (first name only), sanitized inquiry content, and relevant order details.
  - Passwords, MFA secrets, complete credit/GCash account numbers, tokens, and other customers' data are strictly stripped.
- Internal staff notes (`is_internal = true`) are never passed to Gemini or customers.

---

## 11. Implementation Order

1. **Phase 1: Database Migrations & Schemas**:
   - `staff_invitations`, `support_conversations`, `support_messages`, `automation_outbox`, `ai_usage_logs`, `admin_daily_briefs`.
   - RLS policies, Realtime publication, indexes, and RPC functions.
2. **Phase 2: Staff Onboarding & MFA Governance**:
   - Staff invitation server actions, Super Admin invite UI in `/admin/users`, MFA reset with audit log.
3. **Phase 3: Customer Operations & Growth**:
   - `/admin/customers` workspace, search, filters, detail drawer, and PostgreSQL customer growth analytics.
4. **Phase 4: Customer Support Center**:
   - `/account/support` and order-detail integration (`/orders/[id]`), composer, Realtime listener.
5. **Phase 5: Admin Support Inbox**:
   - `/admin/support` workspace with queue, filters, conversation panel, human handoff, and internal notes.
6. **Phase 6: Gemini Support Assistant & Tools**:
   - Server-only AI module, read-only tools, classification, auto-reply rules, fallback handling, staff handoff summary.
7. **Phase 7: Admin "Ask 1968" & Settings**:
   - Executive dashboard query tool, AI & Automation settings in `/admin/settings/ai`, kill switches.
8. **Phase 8: Automation Outbox & n8n Workflows**:
   - Event emitter, signed webhook dispatcher, sanitized workflow JSON files in `automation/n8n/`, `docs/N8N_AUTOMATION_SETUP.md`.
9. **Phase 9: Automated Tests & Verification**:
   - Unit tests for support RLS, staff invitation, last Super Admin protection, mock Gemini tests, empirical retail suite, build.

---

## 12. Verification & Truth Status Ledger

| Component | Status | Empirical Truth / Verification Evidence |
| :--- | :--- | :--- |
| **Database Migrations (27 applied)** | `LIVE VERIFIED` | Replayed cleanly via `npx supabase db reset` (Migrations 1 to 27). |
| **Staff Invitations & MFA Lifecycle** | `LIVE VERIFIED` | Super Admin AAL2 required; individual factor enrollment enforced; audited MFA reset. |
| **Customer Direct RLS Security** | `LIVE VERIFIED` | Customer direct UPDATE on `support_conversations` denied; message spoofing rejected by RLS. |
| **Support Center Client (`/account/support`)** | `LIVE VERIFIED` | Tested with live customer session; order-aware context; human handoff RPC verified. |
| **Admin Support Inbox (`/admin/support`)** | `LIVE VERIFIED` | Public replies and private staff notes segregated; internal notes hidden from customers. |
| **Realtime Reconnect Reconciliation** | `LIVE VERIFIED` | `support:conversation:{id}` channel with deduplication and DB refetch on `SUBSCRIBED`. |
| **Ask 1968 Operational Tools** | `LIVE VERIFIED` | Predefined queries execute trusted calculations; zero arbitrary SQL generation. |
| **Automation Outbox Schema & Dispatcher** | `LIVE VERIFIED` | Outbox events persist transactionally; HMAC-SHA256 signature verification verified. |
| **Gemini 3.8 Flash Support Assistant** | `IMPLEMENTED` | Full boundary, tools, classification, auto-reply, and fallback implemented and tested with mocks. |
| **Live Gemini API Key** | `CONFIGURATION REQUIRED` | Server environment requires `GEMINI_API_KEY` in `.env.local` for live model inference. |
| **Live n8n Webhook Instance** | `CONFIGURATION REQUIRED` | Server environment requires `N8N_WEBHOOK_URL` in `.env.local` to receive dispatched outbox events. |

