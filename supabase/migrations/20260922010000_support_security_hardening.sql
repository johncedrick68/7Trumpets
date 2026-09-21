-- ============================================================================
-- 1968 CLOTHING — SUPPORT SECURITY & AUTHORIZATION HARDENING
-- ============================================================================
-- 1. Revoke generic direct table UPDATE on public.support_conversations from authenticated.
-- 2. Drop any permissive customer update policies.
-- 3. Enforce that ALL conversation status/staff mutations occur exclusively via
--    trusted, audited SECURITY DEFINER RPCs with explicit ownership & AAL2 checks.
-- 4. Provide customer_reopen_support and customer_close_support RPCs.
-- 5. Provide admin_reopen_support and admin_assign_staff RPCs.
-- ============================================================================

-- 1. REVOKE DIRECT TABLE UPDATE
REVOKE UPDATE, DELETE ON public.support_conversations FROM authenticated, anon;
REVOKE UPDATE, DELETE ON public.support_messages FROM authenticated, anon;

-- Drop customer update policy on support_conversations
DROP POLICY IF EXISTS support_conversations_customer_update ON public.support_conversations;

-- Replace admin_all with explicit admin_select and admin_update policies
DROP POLICY IF EXISTS support_conversations_admin_all ON public.support_conversations;

CREATE POLICY support_conversations_admin_select
  ON public.support_conversations FOR SELECT
  TO authenticated
  USING (private.has_role('admin') OR private.has_role('super_admin'));

-- Only admins/super_admins at AAL2 can update directly if needed (though RPCs are preferred)
CREATE POLICY support_conversations_admin_update
  ON public.support_conversations FOR UPDATE
  TO authenticated
  USING (
    (private.has_role('admin') OR private.has_role('super_admin'))
    AND coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
  )
  WITH CHECK (
    (private.has_role('admin') OR private.has_role('super_admin'))
    AND coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
  );

-- Re-grant UPDATE to authenticated ONLY for the admin_update policy
GRANT UPDATE ON public.support_conversations TO authenticated;

-- Ensure support_messages customer INSERT policy strictly prevents sender/internal spoofing
DROP POLICY IF EXISTS support_messages_customer_insert ON public.support_messages;

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

-- ============================================================================
-- 2. TRUSTED CUSTOMER RPCS
-- ============================================================================

-- 2.1 Customer Reopen Support Conversation
CREATE OR REPLACE FUNCTION public.customer_reopen_support(
  p_conversation_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_customer_id UUID := auth.uid();
  v_current_status TEXT;
BEGIN
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_current_status
  FROM public.support_conversations
  WHERE id = p_conversation_id AND customer_id = v_customer_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Support conversation not found or access denied' USING ERRCODE = '42501';
  END IF;

  IF v_current_status NOT IN ('RESOLVED', 'CLOSED') THEN
    RETURN true; -- Already open
  END IF;

  UPDATE public.support_conversations
  SET status = 'OPEN',
      resolved_at = NULL,
      updated_at = now(),
      last_message_at = now()
  WHERE id = p_conversation_id AND customer_id = v_customer_id;

  INSERT INTO public.support_messages (
    conversation_id, sender_type, content, is_internal
  ) VALUES (
    p_conversation_id, 'SYSTEM', 'Conversation reopened by customer.', false
  );

  INSERT INTO public.automation_outbox (
    event_type, aggregate_type, aggregate_id, payload
  ) VALUES (
    'SUPPORT_MESSAGE_CREATED',
    'support_conversation',
    p_conversation_id::TEXT,
    pg_catalog.jsonb_build_object(
      'conversation_id', p_conversation_id,
      'customer_id', v_customer_id,
      'action', 'REOPENED_BY_CUSTOMER',
      'timestamp', now()
    )
  );

  RETURN true;
END;
$$;

-- 2.2 Customer Close Support Conversation
CREATE OR REPLACE FUNCTION public.customer_close_support(
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
  SET status = 'CLOSED',
      resolved_at = coalesce(resolved_at, now()),
      updated_at = now()
  WHERE id = p_conversation_id AND customer_id = v_customer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support conversation not found or access denied' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.support_messages (
    conversation_id, sender_type, content, is_internal
  ) VALUES (
    p_conversation_id, 'SYSTEM', 'Conversation closed by customer.', false
  );

  INSERT INTO public.automation_outbox (
    event_type, aggregate_type, aggregate_id, payload
  ) VALUES (
    'SUPPORT_RESOLVED',
    'support_conversation',
    p_conversation_id::TEXT,
    pg_catalog.jsonb_build_object(
      'conversation_id', p_conversation_id,
      'customer_id', v_customer_id,
      'action', 'CLOSED_BY_CUSTOMER',
      'timestamp', now()
    )
  );

  RETURN true;
END;
$$;

-- ============================================================================
-- 3. TRUSTED ADMIN RPCS
-- ============================================================================

-- 3.1 Admin Reopen Support Conversation
CREATE OR REPLACE FUNCTION public.admin_reopen_support(
  p_conversation_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_aal TEXT := coalesce(auth.jwt() ->> 'aal', '');
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT (private.has_role('admin') OR private.has_role('super_admin')) THEN
    RAISE EXCEPTION 'Administrative privilege required' USING ERRCODE = '42501';
  END IF;

  IF v_aal <> 'aal2' THEN
    RAISE EXCEPTION 'AAL2 elevated authentication required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.support_conversations
  SET status = 'OPEN',
      resolved_at = NULL,
      updated_at = now()
  WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support conversation not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.support_messages (
    conversation_id, sender_type, content, is_internal
  ) VALUES (
    p_conversation_id, 'SYSTEM', 'Conversation reopened by staff.', false
  );

  INSERT INTO public.audit_logs (
    actor_id, action, entity, entity_id, metadata
  ) VALUES (
    v_admin_id,
    'SUPPORT_REOPENED',
    'support_conversation',
    p_conversation_id,
    pg_catalog.jsonb_build_object('admin_id', v_admin_id)
  );

  RETURN true;
END;
$$;

-- 3.2 Admin Assign Staff Member
CREATE OR REPLACE FUNCTION public.admin_assign_staff(
  p_conversation_id UUID,
  p_staff_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_aal TEXT := coalesce(auth.jwt() ->> 'aal', '');
  v_target_role TEXT;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT (private.has_role('admin') OR private.has_role('super_admin')) THEN
    RAISE EXCEPTION 'Administrative privilege required' USING ERRCODE = '42501';
  END IF;

  IF v_aal <> 'aal2' THEN
    RAISE EXCEPTION 'AAL2 elevated authentication required' USING ERRCODE = '42501';
  END IF;

  -- Validate that the target staff member actually holds an operational role
  SELECT role INTO v_target_role
  FROM private.user_roles
  WHERE user_id = p_staff_id AND role IN ('cashier', 'admin', 'super_admin')
  LIMIT 1;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not an active staff member' USING ERRCODE = '42501';
  END IF;

  UPDATE public.support_conversations
  SET assigned_staff_id = p_staff_id,
      status = 'STAFF_HANDLING',
      ai_state = 'PAUSED_FOR_HUMAN',
      updated_at = now()
  WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support conversation not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.audit_logs (
    actor_id, action, entity, entity_id, metadata
  ) VALUES (
    v_admin_id,
    'SUPPORT_STAFF_ASSIGNED',
    'support_conversation',
    p_conversation_id,
    pg_catalog.jsonb_build_object(
      'assigned_by', v_admin_id,
      'assigned_to', p_staff_id,
      'staff_role', v_target_role
    )
  );

  RETURN true;
END;
$$;

-- Revoke default public execution & explicitly grant
REVOKE ALL ON FUNCTION public.customer_reopen_support(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.customer_close_support(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reopen_support(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_assign_staff(UUID, UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.customer_reopen_support(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.customer_close_support(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_reopen_support(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_assign_staff(UUID, UUID) TO authenticated, service_role;
