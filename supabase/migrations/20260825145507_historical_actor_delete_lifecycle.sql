-- Historical rows survive auth-user deletion while remaining immutable.
CREATE OR REPLACE FUNCTION private.reject_append_only_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor_column TEXT;
  v_old JSONB;
  v_new JSONB;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_actor_column := CASE TG_TABLE_NAME
      WHEN 'order_status_history' THEN 'changed_by'
      WHEN 'inventory_movements' THEN 'actor_id'
      WHEN 'payment_events' THEN 'actor_id'
      WHEN 'audit_logs' THEN 'actor_id'
    END;

    IF v_actor_column IS NOT NULL THEN
      v_old := pg_catalog.to_jsonb(OLD);
      v_new := pg_catalog.to_jsonb(NEW);
      IF v_old -> v_actor_column <> 'null'::JSONB
         AND v_new -> v_actor_column = 'null'::JSONB
         AND v_old - v_actor_column = v_new - v_actor_column THEN
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;

CREATE OR REPLACE FUNCTION private.enforce_payment_submission_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_submitted_by_nullified BOOLEAN;
  v_reviewed_by_nullified BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'payment submissions cannot be deleted' USING ERRCODE = '55000';
  END IF;

  v_submitted_by_nullified := OLD.submitted_by IS NOT NULL AND NEW.submitted_by IS NULL;
  v_reviewed_by_nullified := OLD.reviewed_by IS NOT NULL AND NEW.reviewed_by IS NULL;

  IF (v_submitted_by_nullified OR v_reviewed_by_nullified)
     AND (NEW.submitted_by IS NOT DISTINCT FROM OLD.submitted_by OR v_submitted_by_nullified)
     AND (NEW.reviewed_by IS NOT DISTINCT FROM OLD.reviewed_by OR v_reviewed_by_nullified)
     AND pg_catalog.to_jsonb(NEW) - ARRAY['submitted_by', 'reviewed_by']
         = pg_catalog.to_jsonb(OLD) - ARRAY['submitted_by', 'reviewed_by'] THEN
    RETURN NEW;
  END IF;

  IF NEW.payment_id IS DISTINCT FROM OLD.payment_id
     OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
     OR NEW.claimed_amount_minor IS DISTINCT FROM OLD.claimed_amount_minor
     OR NEW.reference_number IS DISTINCT FROM OLD.reference_number
     OR NEW.receipt_storage_path IS DISTINCT FROM OLD.receipt_storage_path
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'payment submission evidence is immutable' USING ERRCODE = '55000';
  END IF;

  IF OLD.review_status IN ('APPROVED', 'REJECTED') AND (
       NEW.review_status IS DISTINCT FROM OLD.review_status
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
       OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
     ) THEN
    RAISE EXCEPTION 'terminal payment review is immutable' USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_submitted_by_nullified BOOLEAN;
  v_reviewed_by_nullified BOOLEAN;
BEGIN
  IF TG_TABLE_SCHEMA = 'public' AND TG_TABLE_NAME = 'payment_submissions' THEN
    v_submitted_by_nullified := OLD.submitted_by IS NOT NULL AND NEW.submitted_by IS NULL;
    v_reviewed_by_nullified := OLD.reviewed_by IS NOT NULL AND NEW.reviewed_by IS NULL;
    IF (v_submitted_by_nullified OR v_reviewed_by_nullified)
       AND (NEW.submitted_by IS NOT DISTINCT FROM OLD.submitted_by OR v_submitted_by_nullified)
       AND (NEW.reviewed_by IS NOT DISTINCT FROM OLD.reviewed_by OR v_reviewed_by_nullified)
       AND pg_catalog.to_jsonb(NEW) - ARRAY['submitted_by', 'reviewed_by']
           = pg_catalog.to_jsonb(OLD) - ARRAY['submitted_by', 'reviewed_by'] THEN
      RETURN NEW;
    END IF;
  END IF;

  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

ALTER TABLE public.payment_submissions
  DROP CONSTRAINT payment_submissions_check,
  ADD CONSTRAINT payment_submissions_check CHECK (
    (review_status = 'PENDING' AND reviewed_by IS NULL
      AND reviewed_at IS NULL AND rejection_reason IS NULL)
    OR (review_status = 'VERIFYING'
      AND reviewed_at IS NULL AND rejection_reason IS NULL)
    OR (review_status = 'APPROVED'
      AND reviewed_at IS NOT NULL AND rejection_reason IS NULL)
    OR (review_status = 'REJECTED'
      AND reviewed_at IS NOT NULL AND rejection_reason IS NOT NULL)
  );
