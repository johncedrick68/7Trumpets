-- 20260922000000_support_staff_ai_automation.sql
-- Customer Support Center, Staff Onboarding, Automation Outbox, and AI Telemetry

-- ============================================================================
-- 1. STAFF INVITATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.staff_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL CHECK (btrim(email) <> '' AND email = lower(email)),
  full_name TEXT NOT NULL CHECK (btrim(full_name) <> ''),
  requested_role TEXT NOT NULL CHECK (requested_role IN ('cashier', 'admin', 'super_admin')),
  invited_by UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_invitations_email ON public.staff_invitations (email);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_status ON public.staff_invitations (status);

-- ============================================================================
-- 2. SUPPORT CONVERSATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders (id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('ORDER_STATUS', 'PAYMENT', 'DELIVERY', 'PRODUCT', 'SIZE', 'RETURN_EXCHANGE', 'ACCOUNT', 'OTHER')),
  priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'WAITING_FOR_STAFF', 'STAFF_HANDLING', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED')),
  assigned_staff_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  ai_state TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (ai_state IN ('ACTIVE', 'PAUSED_FOR_HUMAN', 'DISABLED')),
  summary TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_conv_customer ON public.support_conversations (customer_id);
CREATE INDEX IF NOT EXISTS idx_support_conv_status ON public.support_conversations (status);
CREATE INDEX IF NOT EXISTS idx_support_conv_last_msg ON public.support_conversations (last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_conv_order ON public.support_conversations (order_id) WHERE order_id IS NOT NULL;

-- ============================================================================
-- 3. SUPPORT MESSAGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.support_conversations (id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('CUSTOMER', 'STAFF', 'AI', 'SYSTEM')),
  sender_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  content TEXT NOT NULL CHECK (btrim(content) <> ''),
  is_internal BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_msg_conv_created ON public.support_messages (conversation_id, created_at ASC);

-- ============================================================================
-- 4. AUTOMATION OUTBOX
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.automation_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON public.automation_outbox (status, available_at)
  WHERE status IN ('PENDING', 'PROCESSING');

-- ============================================================================
-- 5. AI USAGE LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature TEXT NOT NULL,
  model TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost_minor INTEGER,
  conversation_id UUID REFERENCES public.support_conversations (id) ON DELETE SET NULL,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_feature_created ON public.ai_usage_logs (feature, created_at DESC);

-- ============================================================================
-- 6. ADMIN DAILY BRIEFS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_daily_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_date DATE NOT NULL UNIQUE,
  summary TEXT NOT NULL,
  metrics_snapshot JSONB NOT NULL,
  generated_by TEXT NOT NULL DEFAULT 'gemini-3.8-flash',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 7. SEED STORE SETTINGS FOR AI & AUTOMATION
-- ============================================================================
INSERT INTO public.store_settings (key, value, description)
VALUES (
  'ai_settings',
  '{
    "enabled": true,
    "auto_reply_enabled": true,
    "auto_reply_confidence_threshold": 0.85,
    "model_name": "gemini-3.8-flash",
    "human_handoff_enabled": true,
    "daily_brief_enabled": true,
    "kill_switch": false
  }'::jsonb,
  'Gemini 3.8 Flash support assistant and n8n automation policies'
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 8. ROW LEVEL SECURITY & POLICIES
-- ============================================================================
ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_daily_briefs ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT ON public.staff_invitations TO authenticated;
GRANT ALL ON public.staff_invitations TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.support_conversations TO authenticated;
GRANT ALL ON public.support_conversations TO service_role;

GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;

GRANT ALL ON public.automation_outbox TO service_role;

GRANT SELECT ON public.ai_usage_logs TO authenticated;
GRANT ALL ON public.ai_usage_logs TO service_role;

GRANT SELECT ON public.admin_daily_briefs TO authenticated;
GRANT ALL ON public.admin_daily_briefs TO service_role;

-- 8.1 Staff Invitations Policy (Super Admin at AAL2 only)
CREATE POLICY staff_invitations_super_admin_all
  ON public.staff_invitations FOR ALL
  TO authenticated
  USING (
    private.has_role('super_admin')
    AND coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
  )
  WITH CHECK (
    private.has_role('super_admin')
    AND coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
  );

-- 8.2 Support Conversations Policies
CREATE POLICY support_conversations_customer_select
  ON public.support_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id);

CREATE POLICY support_conversations_customer_insert
  ON public.support_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY support_conversations_customer_update
  ON public.support_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY support_conversations_admin_all
  ON public.support_conversations FOR ALL
  TO authenticated
  USING (private.has_role('admin') OR private.has_role('super_admin'))
  WITH CHECK (private.has_role('admin') OR private.has_role('super_admin'));

-- 8.3 Support Messages Policies
CREATE POLICY support_messages_customer_select
  ON public.support_messages FOR SELECT
  TO authenticated
  USING (
    is_internal = false
    AND EXISTS (
      SELECT 1 FROM public.support_conversations c
      WHERE c.id = support_messages.conversation_id
        AND c.customer_id = auth.uid()
    )
  );

CREATE POLICY support_messages_customer_insert
  ON public.support_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_type = 'CUSTOMER'
    AND is_internal = false
    AND sender_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.support_conversations c
      WHERE c.id = support_messages.conversation_id
        AND c.customer_id = auth.uid()
    )
  );

CREATE POLICY support_messages_admin_all
  ON public.support_messages FOR ALL
  TO authenticated
  USING (private.has_role('admin') OR private.has_role('super_admin'))
  WITH CHECK (private.has_role('admin') OR private.has_role('super_admin'));

-- 8.4 AI Usage Logs Admin Policy
CREATE POLICY ai_usage_logs_admin_select
  ON public.ai_usage_logs FOR SELECT
  TO authenticated
  USING (private.has_role('admin') OR private.has_role('super_admin'));

-- 8.5 Daily Briefs Admin Policy
CREATE POLICY admin_daily_briefs_admin_select
  ON public.admin_daily_briefs FOR SELECT
  TO authenticated
  USING (private.has_role('admin') OR private.has_role('super_admin'));

-- ============================================================================
-- 9. REALTIME PUBLICATION
-- ============================================================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- 10. CANONICAL SUPPORT & ANALYTICS RPCS
-- ============================================================================

-- 10.1 Customer Create Support Conversation
CREATE OR REPLACE FUNCTION public.create_support_conversation(
  p_category TEXT,
  p_initial_message TEXT,
  p_order_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_customer_id UUID := auth.uid();
  v_conv_id UUID;
  v_clean_msg TEXT := btrim(coalesce(p_initial_message, ''));
BEGIN
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF v_clean_msg = '' THEN
    RAISE EXCEPTION 'Initial message cannot be blank' USING ERRCODE = '22023';
  END IF;

  IF p_order_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.orders WHERE id = p_order_id AND user_id = v_customer_id
  ) THEN
    RAISE EXCEPTION 'Order not found or does not belong to customer' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.support_conversations (
    customer_id, order_id, category, status, ai_state, last_message_at
  ) VALUES (
    v_customer_id, p_order_id, p_category, 'OPEN', 'ACTIVE', now()
  ) RETURNING id INTO v_conv_id;

  INSERT INTO public.support_messages (
    conversation_id, sender_type, sender_user_id, content, is_internal
  ) VALUES (
    v_conv_id, 'CUSTOMER', v_customer_id, v_clean_msg, false
  );

  -- Transactionally emit automation outbox event
  INSERT INTO public.automation_outbox (
    event_type, aggregate_type, aggregate_id, payload
  ) VALUES (
    'SUPPORT_MESSAGE_CREATED',
    'support_conversation',
    v_conv_id::TEXT,
    pg_catalog.jsonb_build_object(
      'conversation_id', v_conv_id,
      'customer_id', v_customer_id,
      'order_id', p_order_id,
      'category', p_category,
      'content', v_clean_msg
    )
  );

  RETURN v_conv_id;
END;
$$;

-- 10.2 Customer Send Support Message
CREATE OR REPLACE FUNCTION public.send_customer_support_message(
  p_conversation_id UUID,
  p_content TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_customer_id UUID := auth.uid();
  v_msg_id UUID;
  v_clean_msg TEXT := btrim(coalesce(p_content, ''));
  v_conv_status TEXT;
BEGIN
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF v_clean_msg = '' THEN
    RAISE EXCEPTION 'Message content cannot be blank' USING ERRCODE = '22023';
  END IF;

  SELECT status INTO v_conv_status
  FROM public.support_conversations
  WHERE id = p_conversation_id AND customer_id = v_customer_id;

  IF v_conv_status IS NULL THEN
    RAISE EXCEPTION 'Support conversation not found' USING ERRCODE = '42501';
  END IF;

  IF v_conv_status = 'CLOSED' THEN
    RAISE EXCEPTION 'Cannot message on a closed conversation' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.support_messages (
    conversation_id, sender_type, sender_user_id, content, is_internal
  ) VALUES (
    p_conversation_id, 'CUSTOMER', v_customer_id, v_clean_msg, false
  ) RETURNING id INTO v_msg_id;

  UPDATE public.support_conversations
  SET last_message_at = now(),
      status = CASE
        WHEN status = 'WAITING_FOR_CUSTOMER' THEN 'WAITING_FOR_STAFF'
        WHEN status = 'RESOLVED' THEN 'OPEN'
        ELSE status
      END,
      updated_at = now()
  WHERE id = p_conversation_id;

  INSERT INTO public.automation_outbox (
    event_type, aggregate_type, aggregate_id, payload
  ) VALUES (
    'SUPPORT_MESSAGE_CREATED',
    'support_conversation',
    p_conversation_id::TEXT,
    pg_catalog.jsonb_build_object(
      'conversation_id', p_conversation_id,
      'message_id', v_msg_id,
      'customer_id', v_customer_id,
      'content', v_clean_msg
    )
  );

  RETURN v_msg_id;
END;
$$;

-- 10.3 Customer Request Human Support (Immediate Escalation)
CREATE OR REPLACE FUNCTION public.request_human_support(
  p_conversation_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_customer_id UUID := auth.uid();
BEGIN
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.support_conversations
  SET status = 'WAITING_FOR_STAFF',
      ai_state = 'PAUSED_FOR_HUMAN',
      priority = CASE WHEN priority = 'LOW' THEN 'NORMAL' ELSE priority END,
      updated_at = now(),
      last_message_at = now()
  WHERE id = p_conversation_id AND customer_id = v_customer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found or access denied' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.support_messages (
    conversation_id, sender_type, content, is_internal
  ) VALUES (
    p_conversation_id, 'SYSTEM', 'Customer requested human staff assistance. AI auto-reply paused.', false
  );

  INSERT INTO public.automation_outbox (
    event_type, aggregate_type, aggregate_id, payload
  ) VALUES (
    'SUPPORT_HUMAN_REQUESTED',
    'support_conversation',
    p_conversation_id::TEXT,
    pg_catalog.jsonb_build_object(
      'conversation_id', p_conversation_id,
      'customer_id', v_customer_id,
      'timestamp', now()
    )
  );

  RETURN true;
END;
$$;

-- 10.4 Admin Reply Support
CREATE OR REPLACE FUNCTION public.admin_reply_support(
  p_conversation_id UUID,
  p_content TEXT,
  p_is_internal BOOLEAN DEFAULT false,
  p_new_status TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_clean_msg TEXT := btrim(coalesce(p_content, ''));
  v_msg_id UUID;
BEGIN
  IF v_actor IS NULL OR NOT (private.has_role('admin') OR private.has_role('super_admin')) THEN
    RAISE EXCEPTION 'Admin authorization required' USING ERRCODE = '42501';
  END IF;

  IF v_clean_msg = '' THEN
    RAISE EXCEPTION 'Message content cannot be blank' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.support_messages (
    conversation_id, sender_type, sender_user_id, content, is_internal
  ) VALUES (
    p_conversation_id, 'STAFF', v_actor, v_clean_msg, p_is_internal
  ) RETURNING id INTO v_msg_id;

  UPDATE public.support_conversations
  SET last_message_at = now(),
      assigned_staff_id = coalesce(assigned_staff_id, v_actor),
      ai_state = 'PAUSED_FOR_HUMAN',
      status = CASE
        WHEN p_new_status IS NOT NULL THEN p_new_status
        WHEN p_is_internal THEN status
        ELSE 'WAITING_FOR_CUSTOMER'
      END,
      updated_at = now()
  WHERE id = p_conversation_id;

  RETURN v_msg_id;
END;
$$;

-- 10.5 Admin Resolve Support
CREATE OR REPLACE FUNCTION public.admin_resolve_support(
  p_conversation_id UUID,
  p_resolution_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT (private.has_role('admin') OR private.has_role('super_admin')) THEN
    RAISE EXCEPTION 'Admin authorization required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.support_conversations
  SET status = 'RESOLVED',
      resolved_at = now(),
      updated_at = now(),
      last_message_at = now()
  WHERE id = p_conversation_id;

  IF p_resolution_note IS NOT NULL AND btrim(p_resolution_note) <> '' THEN
    INSERT INTO public.support_messages (
      conversation_id, sender_type, sender_user_id, content, is_internal
    ) VALUES (
      p_conversation_id, 'STAFF', v_actor, p_resolution_note, true
    );
  END IF;

  INSERT INTO public.support_messages (
    conversation_id, sender_type, content, is_internal
  ) VALUES (
    p_conversation_id, 'SYSTEM', 'Conversation marked as resolved by staff.', false
  );

  INSERT INTO public.automation_outbox (
    event_type, aggregate_type, aggregate_id, payload
  ) VALUES (
    'SUPPORT_RESOLVED',
    'support_conversation',
    p_conversation_id::TEXT,
    pg_catalog.jsonb_build_object(
      'conversation_id', p_conversation_id,
      'resolved_by', v_actor,
      'resolved_at', now()
    )
  );

  RETURN true;
END;
$$;

-- 10.6 Customer Growth Analytics (PostgreSQL Authoritative)
CREATE OR REPLACE FUNCTION public.get_customer_growth_analytics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_total_customers BIGINT;
  v_new_today BIGINT;
  v_new_this_week BIGINT;
  v_new_this_month BIGINT;
  v_with_orders BIGINT;
  v_returning BIGINT;
  v_signup_trend JSONB;
BEGIN
  IF v_actor IS NULL OR NOT (private.has_role('admin') OR private.has_role('super_admin')) THEN
    RAISE EXCEPTION 'Admin authorization required' USING ERRCODE = '42501';
  END IF;

  -- 1. Total Customers (role = 'customer')
  SELECT count(*) INTO v_total_customers
  FROM private.user_roles
  WHERE role = 'customer';

  -- 2. New Today
  SELECT count(*) INTO v_new_today
  FROM private.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id
  WHERE ur.role = 'customer'
    AND u.created_at >= date_trunc('day', now());

  -- 3. New This Week
  SELECT count(*) INTO v_new_this_week
  FROM private.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id
  WHERE ur.role = 'customer'
    AND u.created_at >= date_trunc('week', now());

  -- 4. New This Month
  SELECT count(*) INTO v_new_this_month
  FROM private.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id
  WHERE ur.role = 'customer'
    AND u.created_at >= date_trunc('month', now());

  -- 5. Customers with orders
  SELECT count(DISTINCT user_id) INTO v_with_orders
  FROM public.orders
  WHERE user_id IS NOT NULL;

  -- 6. Returning Customers (placed >= 2 orders)
  SELECT count(*) INTO v_returning
  FROM (
    SELECT user_id
    FROM public.orders
    WHERE user_id IS NOT NULL
    GROUP BY user_id
    HAVING count(*) >= 2
  ) r;

  -- 7. 14-day signup trend
  SELECT jsonb_agg(d.day_data) INTO v_signup_trend
  FROM (
    SELECT jsonb_build_object(
      'date', to_char(cal.day, 'YYYY-MM-DD'),
      'signups', coalesce(count(u.id), 0)
    ) AS day_data
    FROM (
      SELECT generate_series(
        date_trunc('day', now() - INTERVAL '13 days'),
        date_trunc('day', now()),
        INTERVAL '1 day'
      ) AS day
    ) cal
    LEFT JOIN (
      auth.users u
      JOIN private.user_roles ur ON ur.user_id = u.id AND ur.role = 'customer'
    ) ON date_trunc('day', u.created_at) = cal.day
    GROUP BY cal.day
    ORDER BY cal.day ASC
  ) d;

  RETURN jsonb_build_object(
    'total_customers', v_total_customers,
    'new_today', v_new_today,
    'new_this_week', v_new_this_week,
    'new_this_month', v_new_this_month,
    'customers_with_orders', v_with_orders,
    'returning_customers', v_returning,
    'signup_trend', coalesce(v_signup_trend, '[]'::jsonb)
  );
END;
$$;

-- Function Execution Grants
GRANT EXECUTE ON FUNCTION public.create_support_conversation(TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_customer_support_message(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_human_support(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reply_support(UUID, TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_support(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_growth_analytics() TO authenticated;
