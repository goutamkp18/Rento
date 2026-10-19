-- ==============================================================================
-- RENTO — PAYMENT ANTI-FRAUD, OCR CONSISTENCY & RECONCILIATION MIGRATION
-- Migration Version: 20261019_payment_anti_fraud_verification_v3.sql
-- Description: Adds screenshot hashing, OCR consistency check columns,
-- risk scoring (0-100), risk levels (low/medium/high), daily reconciliation
-- queue statuses, dispute workflows, immutable audit event tables, and RLS.
-- Run in Supabase SQL Editor -> New Query -> Paste & Run.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. SECURITY HELPER: Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. ENHANCE PAYMENT_REQUESTS TABLE WITH ANTI-FRAUD & OCR FIELDS
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS screenshot_hash TEXT;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS ocr_status TEXT DEFAULT 'pending';
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS ocr_confidence NUMERIC;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS ocr_raw_text TEXT;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS ocr_extracted_utr TEXT;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS ocr_extracted_amount NUMERIC;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS ocr_extracted_payee TEXT;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS ocr_extracted_date TEXT;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS ocr_extracted_status TEXT;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS ocr_detected_app TEXT;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'low';
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS risk_flags TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS mismatch_reasons TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS reconciliation_status TEXT DEFAULT 'unreconciled';
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS reconciliation_notes TEXT;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS is_disputed BOOLEAN DEFAULT false;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS dispute_reason TEXT;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS dispute_resolution TEXT;

-- Safely ensure status check allows 'disputed'
DO $$
BEGIN
  ALTER TABLE public.payment_requests DROP CONSTRAINT IF EXISTS payment_requests_status_check;
  ALTER TABLE public.payment_requests ADD CONSTRAINT payment_requests_status_check
    CHECK (status IN ('pending', 'pending_verification', 'approved', 'rejected', 'failed', 'expired', 'cancelled', 'disputed'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_requests_screenshot_hash ON public.payment_requests(screenshot_hash);
CREATE INDEX IF NOT EXISTS idx_payment_requests_risk_level ON public.payment_requests(risk_level);
CREATE INDEX IF NOT EXISTS idx_payment_requests_reconciliation_status ON public.payment_requests(reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_is_disputed ON public.payment_requests(is_disputed) WHERE is_disputed = true;

-- 4. IMMUTABLE PAYMENT AUDIT EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.payment_audit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_request_id UUID REFERENCES public.payment_requests(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id),
  actor_role TEXT NOT NULL DEFAULT 'system',
  action TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  risk_score INTEGER,
  reconciliation_decision TEXT,
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_audit_events_payment_req ON public.payment_audit_events(payment_request_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_events_created_at ON public.payment_audit_events(created_at DESC);

-- 5. TRUSTED RPC: Submit Payment Proof with Anti-Fraud & OCR Integration
CREATE OR REPLACE FUNCTION public.submit_payment_proof(
  p_payment_id UUID,
  p_utr TEXT,
  p_receipt_url TEXT DEFAULT NULL,
  p_receipt_path TEXT DEFAULT NULL,
  p_screenshot_hash TEXT DEFAULT NULL,
  p_risk_score INTEGER DEFAULT 0,
  p_risk_level TEXT DEFAULT 'low',
  p_risk_flags TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_mismatch_reasons TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_ocr_data JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_student_name TEXT;
  v_student_email TEXT;
  v_clean_utr TEXT;
  v_req RECORD;
  v_prov_until TIMESTAMPTZ := NOW() + INTERVAL '24 hours';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit payment proof';
  END IF;

  -- Normalize UTR
  v_clean_utr := UPPER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(p_utr), '^(UTR|UPI|REF|TXN)[:\-_/\s]*', '', 'i'), '[\s\-_.]', '', 'g'));

  IF v_clean_utr IS NULL OR LENGTH(v_clean_utr) < 10 THEN
    RAISE EXCEPTION 'Invalid UTR format. Standard UPI transaction reference must be at least 10 characters (standard NPCI is 12 digits).';
  END IF;

  IF LENGTH(v_clean_utr) > 18 THEN
    RAISE EXCEPTION 'Invalid UTR format. Maximum allowed length is 18 characters.';
  END IF;

  IF v_clean_utr !~ '^[A-Z0-9]{10,18}$' THEN
    RAISE EXCEPTION 'Invalid characters in UTR. Only alphanumeric characters are allowed.';
  END IF;

  -- Reject known sample/dummy strings
  IF v_clean_utr IN ('123456789012', '000000000000', '111111111111', '999999999999', 'TEST12345678', 'ABCDEF123456', 'UTR123456789', 'DEMO12345678') OR v_clean_utr ~ '^(.)\1{9,}$' THEN
    RAISE EXCEPTION 'Invalid or sample transaction reference. Please provide the authentic UTR from your UPI payment receipt.';
  END IF;

  -- Lock payment request row for update
  SELECT * INTO v_req
  FROM public.payment_requests
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment request not found';
  END IF;

  IF v_req.user_id != v_user_id THEN
    RAISE EXCEPTION 'Unauthorized: You can only submit proof for your own payment requests';
  END IF;

  IF v_req.status = 'approved' THEN
    RAISE EXCEPTION 'This payment request is already approved';
  END IF;

  -- Global Uniqueness Check across all payment requests (student & owner, any status)
  IF EXISTS (
    SELECT 1 FROM public.payment_requests
    WHERE UPPER(REGEXP_REPLACE(TRIM(utr), '[\s\-_.]', '', 'g')) = v_clean_utr AND id != p_payment_id
  ) THEN
    RAISE EXCEPTION 'This UPI transaction reference (UTR: %) has already been submitted for another payment. Each payment reference can only be used once.', v_clean_utr;
  END IF;

  -- Update payment request to pending_verification with fraud and OCR metadata
  BEGIN
    UPDATE public.payment_requests
    SET
      utr = v_clean_utr,
      receipt_url = COALESCE(p_receipt_url, public.payment_requests.receipt_url),
      receipt_storage_path = COALESCE(p_receipt_path, public.payment_requests.receipt_storage_path),
      screenshot_hash = COALESCE(p_screenshot_hash, public.payment_requests.screenshot_hash),
      risk_score = COALESCE(p_risk_score, public.payment_requests.risk_score),
      risk_level = COALESCE(p_risk_level, public.payment_requests.risk_level),
      risk_flags = COALESCE(p_risk_flags, public.payment_requests.risk_flags),
      mismatch_reasons = COALESCE(p_mismatch_reasons, public.payment_requests.mismatch_reasons),
      ocr_status = COALESCE(p_ocr_data->>'status', public.payment_requests.ocr_status),
      ocr_confidence = (p_ocr_data->>'confidence')::NUMERIC,
      ocr_raw_text = COALESCE(p_ocr_data->>'rawText', public.payment_requests.ocr_raw_text),
      ocr_extracted_utr = COALESCE(p_ocr_data->>'extractedUtr', public.payment_requests.ocr_extracted_utr),
      ocr_extracted_amount = (p_ocr_data->>'extractedAmount')::NUMERIC,
      ocr_extracted_payee = COALESCE(p_ocr_data->>'extractedPayee', public.payment_requests.ocr_extracted_payee),
      ocr_extracted_date = COALESCE(p_ocr_data->>'extractedDate', public.payment_requests.ocr_extracted_date),
      ocr_extracted_status = COALESCE(p_ocr_data->>'extractedStatus', public.payment_requests.ocr_extracted_status),
      ocr_detected_app = COALESCE(p_ocr_data->>'detectedApp', public.payment_requests.ocr_detected_app),
      status = 'pending_verification',
      updated_at = NOW()
    WHERE id = p_payment_id
    RETURNING * INTO v_req;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'This UPI transaction reference (UTR: %) has already been submitted for another payment. Each payment reference can only be used once.', v_clean_utr;
  END;

  -- Log initial audit event
  INSERT INTO public.payment_audit_events (
    payment_request_id,
    actor_id,
    actor_role,
    action,
    previous_status,
    new_status,
    risk_score,
    reason,
    metadata
  ) VALUES (
    v_req.id,
    v_user_id,
    v_req.user_type,
    'submit_payment_proof',
    'pending',
    'pending_verification',
    v_req.risk_score,
    'Payment proof submitted with UTR ' || v_clean_utr,
    jsonb_build_object(
      'utr', v_clean_utr,
      'risk_level', v_req.risk_level,
      'risk_flags', v_req.risk_flags,
      'screenshot_hash', v_req.screenshot_hash
    )
  );

  -- Record provisional access (24-hour buffer)
  IF v_req.user_type = 'student' THEN
    SELECT full_name, email INTO v_student_name, v_student_email
    FROM public.profiles WHERE id = v_user_id;

    INSERT INTO public.student_subscriptions (
      student_id,
      student_name,
      student_email,
      plan_id,
      status,
      entitlement_type,
      amount_paise,
      base_price,
      gst_amount,
      total_price,
      currency,
      payment_method,
      payment_reference,
      payment_request_id,
      receipt_storage_path,
      is_provisional,
      provisional_access_until,
      updated_at
    ) VALUES (
      v_user_id,
      COALESCE(v_student_name, 'Student Resident'),
      COALESCE(v_student_email, ''),
      'student_pass',
      'pending_verification',
      'lifetime',
      900,
      7.63,
      1.37,
      9.00,
      'INR',
      'upi',
      v_clean_utr,
      v_req.id,
      p_receipt_path,
      true,
      v_prov_until,
      NOW()
    )
    ON CONFLICT (student_id) DO UPDATE SET
      status = 'pending_verification',
      payment_reference = EXCLUDED.payment_reference,
      payment_request_id = EXCLUDED.payment_request_id,
      receipt_storage_path = COALESCE(EXCLUDED.receipt_storage_path, public.student_subscriptions.receipt_storage_path),
      is_provisional = true,
      provisional_access_until = v_prov_until,
      updated_at = NOW();

  ELSIF v_req.user_type = 'owner' THEN
    UPDATE public.subscriptions
    SET
      selected_plan_id = v_req.plan_id,
      payment_status = 'pending_verification',
      payment_request_id = v_req.id,
      is_provisional = true,
      provisional_access_until = v_prov_until,
      updated_at = NOW()
    WHERE owner_id = v_user_id;
  END IF;

  RETURN to_jsonb(v_req);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. PRIVILEGED RPC: Idempotent Admin Verify Payment
CREATE OR REPLACE FUNCTION public.admin_verify_payment(
  p_payment_id UUID,
  p_action TEXT,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_admin_email TEXT;
  v_req RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_expiry TIMESTAMPTZ := NOW() + INTERVAL '30 days';
  v_prev_status TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can verify payments';
  END IF;

  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid verification action: %. Must be "approve" or "reject"', p_action;
  END IF;

  SELECT * INTO v_req
  FROM public.payment_requests
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment request #% not found', p_payment_id;
  END IF;

  -- Idempotency check: if already approved and action is approve, return safely
  IF v_req.status = 'approved' AND p_action = 'approve' THEN
    RETURN to_jsonb(v_req);
  END IF;

  IF v_req.status = 'rejected' AND p_action = 'reject' THEN
    RETURN to_jsonb(v_req);
  END IF;

  v_prev_status := v_req.status;
  SELECT email INTO v_admin_email FROM public.profiles WHERE id = v_admin_id;

  IF p_action = 'approve' THEN
    UPDATE public.payment_requests
    SET
      status = 'approved',
      reconciliation_status = 'confirmed_credit',
      verified_at = v_now,
      verified_by = v_admin_id,
      updated_at = v_now
    WHERE id = p_payment_id
    RETURNING * INTO v_req;

    IF v_req.purpose = 'student_lifetime_pass' OR v_req.user_type = 'student' THEN
      UPDATE public.student_subscriptions
      SET
        status = 'active',
        entitlement_type = 'lifetime',
        payment_reference = v_req.utr,
        receipt_storage_path = v_req.receipt_storage_path,
        is_provisional = false,
        provisional_access_until = NULL,
        activated_at = v_now,
        verified_at = v_now,
        verified_by = v_admin_id,
        updated_at = v_now
      WHERE student_id = v_req.user_id;
    ELSIF v_req.user_type = 'owner' THEN
      UPDATE public.subscriptions
      SET
        status = 'active',
        trial_status = 'converted',
        plan_id = v_req.plan_id,
        listing_limit = CASE
          WHEN v_req.plan_id = 'basic' THEN 1
          WHEN v_req.plan_id = 'pro' THEN 3
          ELSE 9999
        END,
        is_provisional = false,
        provisional_access_until = NULL,
        current_period_start = v_now,
        current_period_end = v_expiry,
        payment_method = 'upi',
        payment_status = 'paid',
        payment_request_id = v_req.id,
        verified_at = v_now,
        verified_by = v_admin_id,
        updated_at = v_now
      WHERE owner_id = v_req.user_id;
    END IF;

    -- Audit Event
    INSERT INTO public.payment_audit_events (
      payment_request_id,
      actor_id,
      actor_role,
      action,
      previous_status,
      new_status,
      reconciliation_decision,
      reason
    ) VALUES (
      v_req.id,
      v_admin_id,
      'admin',
      'admin_approve_payment',
      v_prev_status,
      'approved',
      'confirmed_credit',
      'Payment verified against received bank credits.'
    );

  ELSE
    -- Reject action
    UPDATE public.payment_requests
    SET
      status = 'rejected',
      rejection_reason = COALESCE(p_rejection_reason, 'Transaction not found in bank records.'),
      reconciliation_status = 'credit_not_found',
      verified_at = v_now,
      verified_by = v_admin_id,
      updated_at = v_now
    WHERE id = p_payment_id
    RETURNING * INTO v_req;

    IF v_req.user_type = 'student' THEN
      UPDATE public.student_subscriptions
      SET
        status = 'rejected',
        is_provisional = false,
        provisional_access_until = NULL,
        rejection_reason = COALESCE(p_rejection_reason, 'Transaction not found in bank records.'),
        verified_at = v_now,
        verified_by = v_admin_id,
        updated_at = v_now
      WHERE student_id = v_req.user_id;
    ELSIF v_req.user_type = 'owner' THEN
      UPDATE public.subscriptions
      SET
        payment_status = 'rejected',
        is_provisional = false,
        provisional_access_until = NULL,
        rejection_reason = COALESCE(p_rejection_reason, 'Transaction not found in bank records.'),
        updated_at = v_now
      WHERE owner_id = v_req.user_id;
    END IF;

    INSERT INTO public.payment_audit_events (
      payment_request_id,
      actor_id,
      actor_role,
      action,
      previous_status,
      new_status,
      reconciliation_decision,
      reason
    ) VALUES (
      v_req.id,
      v_admin_id,
      'admin',
      'admin_reject_payment',
      v_prev_status,
      'rejected',
      'credit_not_found',
      COALESCE(p_rejection_reason, 'Transaction not found in bank records.')
    );
  END IF;

  RETURN to_jsonb(v_req);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. PRIVILEGED RPC: Admin Reconcile Payment (Granular Triage)
CREATE OR REPLACE FUNCTION public.admin_reconcile_payment(
  p_payment_id UUID,
  p_reconciliation_status TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_req RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can record reconciliation decisions';
  END IF;

  UPDATE public.payment_requests
  SET
    reconciliation_status = p_reconciliation_status,
    reconciliation_notes = p_notes,
    updated_at = NOW()
  WHERE id = p_payment_id
  RETURNING * INTO v_req;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment request not found';
  END IF;

  INSERT INTO public.payment_audit_events (
    payment_request_id,
    actor_id,
    actor_role,
    action,
    reconciliation_decision,
    reason
  ) VALUES (
    p_payment_id,
    v_admin_id,
    'admin',
    'reconciliation_triage',
    p_reconciliation_status,
    p_notes
  );

  RETURN to_jsonb(v_req);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. USER RPC: Dispute Payment Rejection
CREATE OR REPLACE FUNCTION public.dispute_payment(
  p_payment_id UUID,
  p_dispute_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_req RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit payment dispute';
  END IF;

  IF p_dispute_reason IS NULL OR LENGTH(TRIM(p_dispute_reason)) < 5 THEN
    RAISE EXCEPTION 'Please provide a detailed dispute explanation (minimum 5 characters)';
  END IF;

  SELECT * INTO v_req
  FROM public.payment_requests
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment request not found';
  END IF;

  IF v_req.user_id != v_user_id THEN
    RAISE EXCEPTION 'Unauthorized: You can only dispute your own payment requests';
  END IF;

  IF v_req.status != 'rejected' THEN
    RAISE EXCEPTION 'Only rejected payments can be submitted for dispute review';
  END IF;

  UPDATE public.payment_requests
  SET
    status = 'disputed',
    is_disputed = true,
    dispute_reason = TRIM(p_dispute_reason),
    disputed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_payment_id
  RETURNING * INTO v_req;

  INSERT INTO public.payment_audit_events (
    payment_request_id,
    actor_id,
    actor_role,
    action,
    previous_status,
    new_status,
    reason
  ) VALUES (
    p_payment_id,
    v_user_id,
    v_req.user_type,
    'user_dispute_payment',
    'rejected',
    'disputed',
    TRIM(p_dispute_reason)
  );

  RETURN to_jsonb(v_req);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_audit_events ENABLE ROW LEVEL SECURITY;

-- payment_requests policies
DROP POLICY IF EXISTS "Users can view own payment requests" ON public.payment_requests;
CREATE POLICY "Users can view own payment requests"
  ON public.payment_requests FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own payment requests" ON public.payment_requests;
CREATE POLICY "Users can insert own payment requests"
  ON public.payment_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can update payment requests" ON public.payment_requests;
CREATE POLICY "Admins can update payment requests"
  ON public.payment_requests FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- payment_audit_events policies
DROP POLICY IF EXISTS "Users and Admins can view permitted audit events" ON public.payment_audit_events;
CREATE POLICY "Users and Admins can view permitted audit events"
  ON public.payment_audit_events FOR SELECT
  USING (
    public.is_admin() OR
    payment_request_id IN (SELECT id FROM public.payment_requests WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Authenticated users can insert audit events" ON public.payment_audit_events;
CREATE POLICY "Authenticated users can insert audit events"
  ON public.payment_audit_events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
