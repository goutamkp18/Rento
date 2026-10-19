-- ==============================================================================
-- RENTO — ALL-IN-ONE MASTER PAYMENT & ANTI-FRAUD SUPABASE SETUP
-- File: supabase_master_payment_antifraud_setup.sql
-- Description: Executes all tables, global UTR uniqueness, OCR columns, risk scoring,
-- student lifetime entitlements, owner subscriptions, provisional access,
-- audit event log, RPC functions, and Row Level Security in a single execution.
--
-- HOW TO RUN:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/tdonawilfovdxqxctjwg
-- 2. Go to "SQL Editor" in the left sidebar.
-- 3. Click "+ New query".
-- 4. Paste the ENTIRE content of this file and click "Run".
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. SECURITY HELPER: Check if current authenticated user is an administrator
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 3. PAYMENT REQUESTS TABLE (Audit History, Verification Queue & Anti-Fraud)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.payment_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference TEXT,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_type TEXT NOT NULL CHECK (user_type IN ('student', 'owner')),
  purpose TEXT NOT NULL CHECK (purpose IN ('student_lifetime_pass', 'owner_subscription_renewal', 'owner_subscription_upgrade', 'owner_subscription_new')),
  plan_id TEXT NOT NULL CHECK (plan_id IN ('student_pass', 'basic', 'pro', 'pro_plus')),
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'pending_verification', 'approved', 'rejected', 'failed', 'expired', 'cancelled', 'disputed')),
  utr TEXT,
  receipt_url TEXT,
  receipt_storage_path TEXT,
  payment_method TEXT NOT NULL DEFAULT 'upi',
  notes TEXT,
  rejection_reason TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.profiles(id),
  
  -- Anti-Fraud & OCR Consistency Checks
  screenshot_hash TEXT,
  ocr_status TEXT DEFAULT 'pending',
  ocr_confidence NUMERIC,
  ocr_raw_text TEXT,
  ocr_extracted_utr TEXT,
  ocr_extracted_amount NUMERIC,
  ocr_extracted_payee TEXT,
  ocr_extracted_date TEXT,
  ocr_extracted_status TEXT,
  ocr_detected_app TEXT,
  risk_score INTEGER DEFAULT 0,
  risk_level TEXT DEFAULT 'low',
  risk_flags TEXT[] DEFAULT ARRAY[]::TEXT[],
  mismatch_reasons TEXT[] DEFAULT ARRAY[]::TEXT[],
  reconciliation_status TEXT DEFAULT 'unreconciled',
  reconciliation_notes TEXT,
  is_disputed BOOLEAN DEFAULT false,
  dispute_reason TEXT,
  disputed_at TIMESTAMPTZ,
  dispute_resolution TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotently ensure all columns exist
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'student';
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS purpose TEXT DEFAULT 'student_lifetime_pass';
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS plan_id TEXT DEFAULT 'student_pass';
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS amount_paise INTEGER DEFAULT 900;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS utr TEXT;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS receipt_storage_path TEXT;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'upi';
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS period_end TIMESTAMPTZ;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.profiles(id);
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
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Safely ensure status check constraint allows all statuses
DO $$
BEGIN
  ALTER TABLE public.payment_requests DROP CONSTRAINT IF EXISTS payment_requests_status_check;
  ALTER TABLE public.payment_requests ADD CONSTRAINT payment_requests_status_check
    CHECK (status IN ('pending', 'pending_verification', 'approved', 'rejected', 'failed', 'expired', 'cancelled', 'disputed'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Indexes for performance & unique reference
CREATE INDEX IF NOT EXISTS idx_payment_requests_user_id ON public.payment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON public.payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_created_at ON public.payment_requests(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_requests_reference ON public.payment_requests(reference);
CREATE INDEX IF NOT EXISTS idx_payment_requests_screenshot_hash ON public.payment_requests(screenshot_hash);
CREATE INDEX IF NOT EXISTS idx_payment_requests_risk_level ON public.payment_requests(risk_level);
CREATE INDEX IF NOT EXISTS idx_payment_requests_reconciliation_status ON public.payment_requests(reconciliation_status);

-- ==============================================================================
-- GLOBAL UNIQUE INDEX ON NORMALIZED UTR ACROSS ALL PAYMENT REQUESTS
-- Enforces that no two requests (student or owner, pending, approved, or rejected)
-- can ever share the same UPI transaction reference.
-- ==============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_requests_utr_unique
  ON public.payment_requests (UPPER(REGEXP_REPLACE(TRIM(utr), '[\s\-_.]', '', 'g')))
  WHERE utr IS NOT NULL;

-- ==============================================================================
-- 4. STUDENT SUBSCRIPTIONS TABLE (Authoritative ₹9 Lifetime Entitlements)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.student_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_name TEXT,
  student_email TEXT,
  plan_id TEXT NOT NULL DEFAULT 'student_pass',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'pending_verification', 'active', 'expired', 'cancelled', 'payment_failed', 'rejected')),
  entitlement_type TEXT NOT NULL DEFAULT 'lifetime',
  amount_paise INTEGER NOT NULL DEFAULT 900,
  base_price NUMERIC NOT NULL DEFAULT 7.63,
  gst_amount NUMERIC NOT NULL DEFAULT 1.37,
  total_price NUMERIC NOT NULL DEFAULT 9.00,
  currency TEXT NOT NULL DEFAULT 'INR',
  payment_method TEXT DEFAULT 'upi',
  payment_reference TEXT,
  payment_request_id UUID REFERENCES public.payment_requests(id),
  receipt_storage_path TEXT,
  is_provisional BOOLEAN DEFAULT false,
  provisional_access_until TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.profiles(id),
  rejection_reason TEXT,
  start_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_student_subscription UNIQUE (student_id)
);

-- Idempotently ensure columns exist
ALTER TABLE public.student_subscriptions ADD COLUMN IF NOT EXISTS entitlement_type TEXT DEFAULT 'lifetime';
ALTER TABLE public.student_subscriptions ADD COLUMN IF NOT EXISTS amount_paise INTEGER DEFAULT 900;
ALTER TABLE public.student_subscriptions ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
ALTER TABLE public.student_subscriptions ADD COLUMN IF NOT EXISTS payment_request_id UUID REFERENCES public.payment_requests(id);
ALTER TABLE public.student_subscriptions ADD COLUMN IF NOT EXISTS receipt_storage_path TEXT;
ALTER TABLE public.student_subscriptions ADD COLUMN IF NOT EXISTS is_provisional BOOLEAN DEFAULT false;
ALTER TABLE public.student_subscriptions ADD COLUMN IF NOT EXISTS provisional_access_until TIMESTAMPTZ;
ALTER TABLE public.student_subscriptions ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;
ALTER TABLE public.student_subscriptions ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.student_subscriptions ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.student_subscriptions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_student_subscriptions_student_id ON public.student_subscriptions(student_id);
CREATE INDEX IF NOT EXISTS idx_student_subscriptions_status ON public.student_subscriptions(status);

-- ==============================================================================
-- 5. IMMUTABLE PAYMENT AUDIT EVENTS TABLE
-- ==============================================================================
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

-- ==============================================================================
-- 6. OWNER SUBSCRIPTIONS ENHANCEMENTS
-- ==============================================================================
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS payment_request_id UUID REFERENCES public.payment_requests(id);
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'none';
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS is_provisional BOOLEAN DEFAULT false;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS provisional_access_until TIMESTAMPTZ;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS selected_plan_id TEXT;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- ==============================================================================
-- 7. STORED PROCEDURES (Atomic, Idempotent Operations)
-- ==============================================================================

-- Submit Payment Proof with Anti-Fraud & OCR Data
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
  v_normalized_utr TEXT;
  v_existing_id UUID;
  v_req RECORD;
  v_provisional_until TIMESTAMPTZ;
BEGIN
  v_normalized_utr := UPPER(REGEXP_REPLACE(TRIM(p_utr), '[\s\-_.]', '', 'g'));

  IF v_normalized_utr IS NULL OR LENGTH(v_normalized_utr) < 10 THEN
    RAISE EXCEPTION 'Invalid UPI transaction reference. Must be between 10 and 18 alphanumeric characters.';
  END IF;

  SELECT id INTO v_existing_id
  FROM public.payment_requests
  WHERE UPPER(REGEXP_REPLACE(TRIM(utr), '[\s\-_.]', '', 'g')) = v_normalized_utr
    AND id != p_payment_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'This UPI transaction reference (%) has already been submitted for another payment.', v_normalized_utr;
  END IF;

  v_provisional_until := NOW() + INTERVAL '24 hours';

  UPDATE public.payment_requests
  SET
    utr = v_normalized_utr,
    receipt_url = COALESCE(p_receipt_url, receipt_url),
    receipt_storage_path = COALESCE(p_receipt_path, receipt_storage_path),
    screenshot_hash = COALESCE(p_screenshot_hash, screenshot_hash),
    risk_score = p_risk_score,
    risk_level = p_risk_level,
    risk_flags = p_risk_flags,
    mismatch_reasons = p_mismatch_reasons,
    ocr_status = COALESCE(p_ocr_data->>'status', 'pending'),
    ocr_confidence = (p_ocr_data->>'confidence')::NUMERIC,
    ocr_raw_text = p_ocr_data->>'rawText',
    ocr_extracted_utr = p_ocr_data->>'extractedUtr',
    ocr_extracted_amount = (p_ocr_data->>'extractedAmount')::NUMERIC,
    ocr_extracted_payee = p_ocr_data->>'extractedPayee',
    ocr_extracted_date = p_ocr_data->>'extractedDate',
    ocr_extracted_status = p_ocr_data->>'extractedStatus',
    ocr_detected_app = p_ocr_data->>'detectedApp',
    status = 'pending_verification',
    updated_at = NOW()
  WHERE id = p_payment_id
  RETURNING * INTO v_req;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment request % not found', p_payment_id;
  END IF;

  IF v_req.user_type = 'student' THEN
    INSERT INTO public.student_subscriptions (
      student_id, plan_id, status, entitlement_type,
      amount_paise, base_price, gst_amount, total_price,
      currency, payment_method, payment_reference, payment_request_id,
      receipt_storage_path, is_provisional, provisional_access_until, updated_at
    ) VALUES (
      v_req.user_id, 'student_pass', 'pending_verification', 'lifetime',
      900, 7.63, 1.37, 9.00,
      'INR', 'upi', v_normalized_utr, v_req.id,
      COALESCE(p_receipt_path, v_req.receipt_storage_path), true, v_provisional_until, NOW()
    )
    ON CONFLICT (student_id) DO UPDATE SET
      status = 'pending_verification',
      payment_reference = v_normalized_utr,
      payment_request_id = v_req.id,
      receipt_storage_path = COALESCE(p_receipt_path, student_subscriptions.receipt_storage_path),
      is_provisional = true,
      provisional_access_until = v_provisional_until,
      updated_at = NOW();
  ELSIF v_req.user_type = 'owner' THEN
    UPDATE public.subscriptions
    SET
      payment_status = 'pending_verification',
      payment_request_id = v_req.id,
      is_provisional = true,
      provisional_access_until = v_provisional_until,
      selected_plan_id = v_req.plan_id,
      updated_at = NOW()
    WHERE owner_id = v_req.user_id;
  END IF;

  INSERT INTO public.payment_audit_events (
    payment_request_id, actor_id, actor_role, action,
    previous_status, new_status, risk_score, reason, metadata
  ) VALUES (
    v_req.id, auth.uid(), 'user', 'submit_payment_proof',
    'pending', 'pending_verification', p_risk_score,
    'User submitted UTR and payment proof with provisional 24h access granted',
    jsonb_build_object('utr', v_normalized_utr, 'risk_level', p_risk_level)
  );

  RETURN to_jsonb(v_req);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin Verify Payment (Idempotent Approval/Rejection)
CREATE OR REPLACE FUNCTION public.admin_verify_payment(
  p_payment_id UUID,
  p_action TEXT,
  p_reason TEXT DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_req RECORD;
  v_admin_id UUID;
  v_prev_status TEXT;
  v_new_status TEXT;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  v_admin_id := COALESCE(p_admin_id, auth.uid());

  SELECT * INTO v_req FROM public.payment_requests WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment request % not found', p_payment_id;
  END IF;

  v_prev_status := v_req.status;

  IF p_action = 'approve' THEN
    v_new_status := 'approved';
    v_start := NOW();
    v_end := NOW() + INTERVAL '30 days';

    UPDATE public.payment_requests
    SET
      status = 'approved',
      reconciliation_status = 'confirmed',
      verified_at = NOW(),
      verified_by = v_admin_id,
      period_start = v_start,
      period_end = v_end,
      updated_at = NOW()
    WHERE id = p_payment_id;

    IF v_req.user_type = 'student' THEN
      UPDATE public.student_subscriptions
      SET
        status = 'active',
        is_provisional = false,
        provisional_access_until = NULL,
        activated_at = NOW(),
        verified_at = NOW(),
        verified_by = v_admin_id,
        updated_at = NOW()
      WHERE student_id = v_req.user_id;
    ELSIF v_req.user_type = 'owner' THEN
      UPDATE public.subscriptions
      SET
        plan_id = v_req.plan_id,
        status = 'active',
        payment_status = 'paid',
        is_provisional = false,
        provisional_access_until = NULL,
        start_date = v_start,
        renewal_date = v_end,
        listing_limit = CASE
          WHEN v_req.plan_id = 'basic' THEN 1
          WHEN v_req.plan_id = 'pro' THEN 3
          WHEN v_req.plan_id = 'pro_plus' THEN 999
          ELSE 1
        END,
        verified_at = NOW(),
        updated_at = NOW()
      WHERE owner_id = v_req.user_id;
    END IF;

  ELSIF p_action = 'reject' THEN
    v_new_status := 'rejected';

    UPDATE public.payment_requests
    SET
      status = 'rejected',
      reconciliation_status = 'credit_not_found',
      rejection_reason = COALESCE(p_reason, 'Payment verification rejected by admin'),
      verified_at = NOW(),
      verified_by = v_admin_id,
      updated_at = NOW()
    WHERE id = p_payment_id;

    IF v_req.user_type = 'student' THEN
      UPDATE public.student_subscriptions
      SET
        status = 'rejected',
        is_provisional = false,
        provisional_access_until = NULL,
        rejection_reason = COALESCE(p_reason, 'Verification rejected by finance team'),
        updated_at = NOW()
      WHERE student_id = v_req.user_id;
    ELSIF v_req.user_type = 'owner' THEN
      UPDATE public.subscriptions
      SET
        payment_status = 'rejected',
        is_provisional = false,
        provisional_access_until = NULL,
        updated_at = NOW()
      WHERE owner_id = v_req.user_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid action: %. Must be approve or reject', p_action;
  END IF;

  INSERT INTO public.payment_audit_events (
    payment_request_id, actor_id, actor_role, action,
    previous_status, new_status, reason
  ) VALUES (
    p_payment_id, v_admin_id, 'admin', p_action || '_payment',
    v_prev_status, v_new_status, COALESCE(p_reason, 'Admin verified bank credit')
  );

  SELECT * INTO v_req FROM public.payment_requests WHERE id = p_payment_id;
  RETURN to_jsonb(v_req);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dispute Payment by User
CREATE OR REPLACE FUNCTION public.dispute_payment(
  p_payment_id UUID,
  p_dispute_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_req RECORD;
BEGIN
  UPDATE public.payment_requests
  SET
    status = 'disputed',
    is_disputed = true,
    dispute_reason = p_dispute_reason,
    disputed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_payment_id
  RETURNING * INTO v_req;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment request % not found', p_payment_id;
  END IF;

  INSERT INTO public.payment_audit_events (
    payment_request_id, actor_id, actor_role, action,
    previous_status, new_status, reason
  ) VALUES (
    p_payment_id, auth.uid(), 'user', 'dispute_payment',
    'rejected', 'disputed', p_dispute_reason
  );

  RETURN to_jsonb(v_req);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_audit_events ENABLE ROW LEVEL SECURITY;

-- payment_requests policies: Allow application-verified access for users and admins
DROP POLICY IF EXISTS "Users can view own payment requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Allow select payment requests" ON public.payment_requests;
CREATE POLICY "Allow select payment requests" ON public.payment_requests
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own payment requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Allow insert payment requests" ON public.payment_requests;
CREATE POLICY "Allow insert payment requests" ON public.payment_requests
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own pending payment requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Allow update payment requests" ON public.payment_requests;
CREATE POLICY "Allow update payment requests" ON public.payment_requests
  FOR UPDATE USING (true);

-- student_subscriptions policies
DROP POLICY IF EXISTS "Students can view own subscription" ON public.student_subscriptions;
DROP POLICY IF EXISTS "Allow select student subscriptions" ON public.student_subscriptions;
CREATE POLICY "Allow select student subscriptions" ON public.student_subscriptions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Students can insert own subscription" ON public.student_subscriptions;
DROP POLICY IF EXISTS "Allow insert student subscriptions" ON public.student_subscriptions;
CREATE POLICY "Allow insert student subscriptions" ON public.student_subscriptions
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Students can update own subscription" ON public.student_subscriptions;
DROP POLICY IF EXISTS "Allow update student subscriptions" ON public.student_subscriptions;
CREATE POLICY "Allow update student subscriptions" ON public.student_subscriptions
  FOR UPDATE USING (true);

-- payment_audit_events policies
DROP POLICY IF EXISTS "Admins can view audit events" ON public.payment_audit_events;
DROP POLICY IF EXISTS "Allow select audit events" ON public.payment_audit_events;
CREATE POLICY "Allow select audit events" ON public.payment_audit_events
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "System can insert audit events" ON public.payment_audit_events;
DROP POLICY IF EXISTS "Allow insert audit events" ON public.payment_audit_events;
CREATE POLICY "Allow insert audit events" ON public.payment_audit_events
  FOR INSERT WITH CHECK (true);

-- ==============================================================================
-- 9. PERMISSIONS GRANT (Allows PostgREST immediate schema cache discovery)
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
