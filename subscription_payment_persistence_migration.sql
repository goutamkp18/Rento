-- ==============================================================================
-- RENTO — SUBSCRIPTION & PAYMENT PERSISTENCE MIGRATION
-- Migration Version: 20261019_subscription_payment_persistence_v2.sql
-- Description: Server-authoritative Supabase PostgreSQL tables, RLS policies,
-- strict UTR normalization and validation, global UTR uniqueness constraint,
-- provisional access workflow, audit logging, and manual UPI verification.
-- Run this in Supabase Dashboard -> SQL Editor -> New Query -> Paste & Run.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. SECURITY HELPER: Check if current authenticated user is an administrator
-- ==============================================================================
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
-- 3. PAYMENT REQUESTS TABLE (Audit History & Verification Queue)
-- Stores all ₹9 Student Access Pass & PG Owner plan payments
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
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'pending_verification', 'approved', 'rejected', 'failed', 'expired', 'cancelled')),
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotently ensure all columns exist if table was partially created
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
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Safely ensure status check includes pending_verification
DO $$
BEGIN
  ALTER TABLE public.payment_requests DROP CONSTRAINT IF EXISTS payment_requests_status_check;
  ALTER TABLE public.payment_requests ADD CONSTRAINT payment_requests_status_check
    CHECK (status IN ('pending', 'pending_verification', 'approved', 'rejected', 'failed', 'expired', 'cancelled'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_payment_requests_user_id ON public.payment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON public.payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_created_at ON public.payment_requests(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_requests_reference ON public.payment_requests(reference);

-- Unique index to prevent duplicate pending payments for the same user and plan
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_user_plan
  ON public.payment_requests(user_id, plan_id)
  WHERE status IN ('pending', 'pending_verification');

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

-- Idempotently ensure columns and constraints on student_subscriptions
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

DO $$
BEGIN
  ALTER TABLE public.student_subscriptions DROP CONSTRAINT IF EXISTS student_subscriptions_status_check;
  ALTER TABLE public.student_subscriptions ADD CONSTRAINT student_subscriptions_status_check
    CHECK (status IN ('pending', 'pending_verification', 'active', 'expired', 'cancelled', 'payment_failed', 'rejected'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_student_subscriptions_student_id ON public.student_subscriptions(student_id);
CREATE INDEX IF NOT EXISTS idx_student_subscriptions_status ON public.student_subscriptions(status);

-- ==============================================================================
-- 5. ENHANCE PG-OWNER SUBSCRIPTIONS TABLE
-- ==============================================================================
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS amount_paise INTEGER DEFAULT 0;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS payment_request_id UUID REFERENCES public.payment_requests(id);
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS is_provisional BOOLEAN DEFAULT false;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS provisional_access_until TIMESTAMPTZ;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ==============================================================================
-- 6. ENHANCE ADMIN AUDIT LOGS TABLE
-- ==============================================================================
ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS payment_request_id UUID;

-- ==============================================================================
-- 7. DATABASE TRIGGER: Enforce Listing Capacity on Backend
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.check_owner_listing_capacity()
RETURNS TRIGGER AS $$
DECLARE
  sub RECORD;
  current_count INTEGER;
  max_allowed INTEGER := 1;
BEGIN
  -- Fetch current subscription state for the owner
  SELECT * INTO sub FROM public.subscriptions WHERE owner_id = NEW.owner_id;

  IF NOT FOUND THEN
    -- Eligible for initial 30-day trial allowance (3 listings)
    max_allowed := 3;
  ELSIF sub.trial_status = 'active' AND (sub.trial_end IS NULL OR NOW() <= sub.trial_end) THEN
    -- In active trial countdown
    max_allowed := COALESCE(sub.trial_listing_limit, 3);
  ELSIF sub.trial_status = 'eligible' THEN
    max_allowed := 3;
  ELSIF sub.status = 'active' OR (sub.is_provisional = true AND sub.provisional_access_until >= NOW()) THEN
    -- Active paid subscription or valid provisional access
    IF sub.plan_id = 'basic' THEN
      max_allowed := 1;
    ELSIF sub.plan_id = 'pro' THEN
      max_allowed := 3;
    ELSE
      max_allowed := 999999; -- Pro Plus unlimited
    END IF;
  ELSIF sub.trial_status = 'expired' OR sub.status = 'expired' THEN
    max_allowed := 1;
  ELSE
    max_allowed := 1;
  END IF;

  -- Count existing properties owned by this user
  SELECT COUNT(*) INTO current_count
  FROM public.pg_listings
  WHERE owner_id = NEW.owner_id;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Listing capacity reached (% PG limit for current plan). Please upgrade your subscription to add more accommodations.', max_allowed;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_owner_listing_limit ON public.pg_listings;
CREATE TRIGGER trg_enforce_owner_listing_limit
  BEFORE INSERT ON public.pg_listings
  FOR EACH ROW EXECUTE PROCEDURE public.check_owner_listing_capacity();

-- ==============================================================================
-- 8. TRUSTED RPC: Create Unique Payment Request in Supabase Before Showing QR
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.create_payment_request(
  p_purpose TEXT,
  p_plan_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_type TEXT;
  v_amount_paise INTEGER;
  v_reference TEXT;
  v_prefix TEXT;
  v_existing RECORD;
  v_created RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create a payment request';
  END IF;

  IF p_plan_id = 'student_pass' THEN
    v_user_type := 'student';
    v_amount_paise := 900; -- Exact flat ₹9.00
    v_prefix := 'RENTO-STU-';
  ELSIF p_plan_id = 'basic' THEN
    v_user_type := 'owner';
    v_amount_paise := 4900; -- Exact flat ₹49.00
    v_prefix := 'RENTO-OWN-';
  ELSIF p_plan_id = 'pro' THEN
    v_user_type := 'owner';
    v_amount_paise := 9900; -- Exact flat ₹99.00
    v_prefix := 'RENTO-OWN-';
  ELSIF p_plan_id = 'pro_plus' THEN
    v_user_type := 'owner';
    v_amount_paise := 19900; -- Exact flat ₹199.00
    v_prefix := 'RENTO-OWN-';
  ELSE
    RAISE EXCEPTION 'Invalid plan identifier: %', p_plan_id;
  END IF;

  -- Verify student does not already have an active lifetime pass
  IF p_plan_id = 'student_pass' AND EXISTS (
    SELECT 1 FROM public.student_subscriptions
    WHERE student_id = v_user_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Account already has an active lifetime student pass';
  END IF;

  -- Check if an unresolved request already exists for this user and plan
  SELECT * INTO v_existing
  FROM public.payment_requests
  WHERE user_id = v_user_id AND plan_id = p_plan_id AND status IN ('pending', 'pending_verification')
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.reference IS NOT NULL THEN
      RETURN to_jsonb(v_existing);
    ELSE
      v_reference := v_prefix || UPPER(SUBSTR(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT || v_user_id::TEXT), 1, 6));
      UPDATE public.payment_requests
      SET reference = v_reference, updated_at = NOW()
      WHERE id = v_existing.id
      RETURNING * INTO v_existing;
      RETURN to_jsonb(v_existing);
    END IF;
  END IF;

  -- Generate unique reference code
  v_reference := v_prefix || UPPER(SUBSTR(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT || v_user_id::TEXT), 1, 6));

  -- Insert new payment request record
  INSERT INTO public.payment_requests (
    user_id,
    user_type,
    purpose,
    plan_id,
    amount_paise,
    currency,
    status,
    reference,
    payment_method,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_user_type,
    p_purpose,
    p_plan_id,
    v_amount_paise,
    'INR',
    'pending',
    v_reference,
    'upi',
    NOW(),
    NOW()
  )
  RETURNING * INTO v_created;

  RETURN to_jsonb(v_created);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 9. TRUSTED RPC: Submit Payment Proof (Strict UTR Validation & Global Uniqueness)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.submit_payment_proof(
  p_payment_id UUID,
  p_utr TEXT,
  p_receipt_url TEXT DEFAULT NULL,
  p_receipt_path TEXT DEFAULT NULL
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

  -- Normalize UTR: remove prefixes like UTR:, UPI:, spaces, dashes, dots, convert to uppercase
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

  -- Verify payment request exists and belongs to this user
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

  -- Trusted server pricing validation
  IF v_req.plan_id = 'student_pass' AND v_req.amount_paise != 900 THEN
    RAISE EXCEPTION 'Payment amount mismatch for student pass (expected 900 paise)';
  ELSIF v_req.plan_id = 'basic' AND v_req.amount_paise != 4900 THEN
    RAISE EXCEPTION 'Payment amount mismatch for basic plan (expected 4900 paise)';
  ELSIF v_req.plan_id = 'pro' AND v_req.amount_paise != 9900 THEN
    RAISE EXCEPTION 'Payment amount mismatch for pro plan (expected 9900 paise)';
  ELSIF v_req.plan_id = 'pro_plus' AND v_req.amount_paise != 19900 THEN
    RAISE EXCEPTION 'Payment amount mismatch for pro_plus plan (expected 19900 paise)';
  END IF;

  -- Global Uniqueness Check across all payment requests (student & owner, any status)
  IF EXISTS (
    SELECT 1 FROM public.payment_requests
    WHERE UPPER(REGEXP_REPLACE(TRIM(utr), '[\s\-_.]', '', 'g')) = v_clean_utr AND id != p_payment_id
  ) THEN
    RAISE EXCEPTION 'This UPI transaction reference (UTR: %) has already been submitted for another payment. Each payment reference can only be used once.', v_clean_utr;
  END IF;

  -- Update payment request to pending_verification (handle concurrent unique_violation safely)
  BEGIN
    UPDATE public.payment_requests
    SET
      utr = v_clean_utr,
      receipt_url = COALESCE(p_receipt_url, public.payment_requests.receipt_url),
      receipt_storage_path = COALESCE(p_receipt_path, public.payment_requests.receipt_storage_path),
      status = 'pending_verification',
      updated_at = NOW()
    WHERE id = p_payment_id
    RETURNING * INTO v_req;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'This UPI transaction reference (UTR: %) has already been submitted for another payment. Each payment reference can only be used once.', v_clean_utr;
  END;

  -- Record provisional access and pending_verification status
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

-- Backwards-compatible RPC: submit_student_payment
CREATE OR REPLACE FUNCTION public.submit_student_payment(
  p_utr TEXT,
  p_receipt_url TEXT DEFAULT NULL,
  p_receipt_path TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_created JSONB;
  v_req_id UUID;
BEGIN
  v_created := public.create_payment_request('student_lifetime_pass', 'student_pass');
  v_req_id := (v_created->>'id')::UUID;
  RETURN public.submit_payment_proof(v_req_id, p_utr, p_receipt_url, p_receipt_path);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backwards-compatible RPC: submit_owner_payment
CREATE OR REPLACE FUNCTION public.submit_owner_payment(
  p_plan_id TEXT,
  p_utr TEXT,
  p_receipt_url TEXT DEFAULT NULL,
  p_receipt_path TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_created JSONB;
  v_req_id UUID;
BEGIN
  v_created := public.create_payment_request('owner_subscription_renewal', p_plan_id);
  v_req_id := (v_created->>'id')::UUID;
  RETURN public.submit_payment_proof(v_req_id, p_utr, p_receipt_url, p_receipt_path);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 10. PRIVILEGED RPC: Administrator Verify Payment Request
-- ==============================================================================
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
BEGIN
  -- Strict Admin Verification
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only registered administrators can verify payments';
  END IF;

  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid verification action: %. Must be "approve" or "reject"', p_action;
  END IF;

  -- Lock payment request row for update
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

  IF v_req.status NOT IN ('pending', 'pending_verification') THEN
    RAISE EXCEPTION 'Payment request #% has already been resolved with status "%"', p_payment_id, v_req.status;
  END IF;

  -- Fetch admin email
  SELECT email INTO v_admin_email FROM public.profiles WHERE id = v_admin_id;

  IF p_action = 'approve' THEN
    -- 1. Mark payment request approved
    UPDATE public.payment_requests
    SET
      status = 'approved',
      verified_at = v_now,
      verified_by = v_admin_id,
      updated_at = v_now
    WHERE id = p_payment_id
    RETURNING * INTO v_req;

    -- 2. If student pass, activate permanent lifetime entitlement & clear provisional flag
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

      -- Create audit log
      INSERT INTO public.admin_audit_logs (
        id,
        admin_id,
        admin_email,
        action,
        details,
        payment_request_id,
        created_at
      ) VALUES (
        'audit_' || extract(epoch from now())::bigint || '_' || substr(md5(random()::text), 1, 6),
        v_admin_id,
        COALESCE(v_admin_email, 'admin@rento.dev'),
        'approve_student_payment',
        'Approved ₹9 lifetime pass for student ID ' || v_req.user_id || ' (Ref: ' || COALESCE(v_req.reference, 'N/A') || ', UTR: ' || COALESCE(v_req.utr, 'N/A') || ')',
        v_req.id,
        v_now
      );

    -- 3. If owner subscription, activate/renew 30-day period & clear provisional flag
    ELSIF v_req.user_type = 'owner' THEN
      UPDATE public.subscriptions
      SET
        status = 'active',
        trial_status = 'converted',
        plan_id = v_req.plan_id,
        base_price = (CASE v_req.plan_id WHEN 'basic' THEN 49 WHEN 'pro' THEN 99 ELSE 199 END),
        gst_amount = 0,
        total_price = (CASE v_req.plan_id WHEN 'basic' THEN 49 WHEN 'pro' THEN 99 ELSE 199 END),
        amount_paise = v_req.amount_paise,
        listing_limit = (CASE v_req.plan_id WHEN 'basic' THEN 1 WHEN 'pro' THEN 3 ELSE 9999 END),
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

      -- Create audit log
      INSERT INTO public.admin_audit_logs (
        id,
        admin_id,
        admin_email,
        action,
        details,
        payment_request_id,
        created_at
      ) VALUES (
        'audit_' || extract(epoch from now())::bigint || '_' || substr(md5(random()::text), 1, 6),
        v_admin_id,
        COALESCE(v_admin_email, 'admin@rento.dev'),
        'approve_owner_payment',
        'Approved ' || UPPER(v_req.plan_id) || ' subscription for owner ID ' || v_req.user_id || ' (Ref: ' || COALESCE(v_req.reference, 'N/A') || ', UTR: ' || COALESCE(v_req.utr, 'N/A') || ')',
        v_req.id,
        v_now
      );
    END IF;

  ELSIF p_action = 'reject' THEN
    -- Mark payment request rejected with mandatory reason
    UPDATE public.payment_requests
    SET
      status = 'rejected',
      rejection_reason = COALESCE(p_rejection_reason, 'Verification failed. Transaction reference could not be confirmed in bank statement.'),
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
        rejection_reason = v_req.rejection_reason,
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
        rejection_reason = v_req.rejection_reason,
        updated_at = v_now
      WHERE owner_id = v_req.user_id;
    END IF;

    -- Create audit log
    INSERT INTO public.admin_audit_logs (
      id,
      admin_id,
      admin_email,
      action,
      details,
      rejection_reason,
      payment_request_id,
      created_at
    ) VALUES (
      'audit_' || extract(epoch from now())::bigint || '_' || substr(md5(random()::text), 1, 6),
      v_admin_id,
      COALESCE(v_admin_email, 'admin@rento.dev'),
      (CASE WHEN v_req.user_type = 'student' THEN 'reject_student_payment' ELSE 'reject_owner_payment' END),
      'Rejected payment request #' || v_req.id || ' for user ' || v_req.user_id || ': ' || COALESCE(p_rejection_reason, 'Unconfirmed transaction in bank statement'),
      p_rejection_reason,
      v_req.id,
      v_now
    );
  END IF;

  RETURN to_jsonb(v_req);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- PAYMENT REQUESTS POLICIES
DROP POLICY IF EXISTS "Users view own payment requests or admin view all" ON public.payment_requests;
CREATE POLICY "Users view own payment requests or admin view all" ON public.payment_requests
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Authenticated users create own pending payment request" ON public.payment_requests;
CREATE POLICY "Authenticated users create own pending payment request" ON public.payment_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id AND status IN ('pending', 'pending_verification'));

DROP POLICY IF EXISTS "Users update own pending payment requests" ON public.payment_requests;
CREATE POLICY "Users update own pending payment requests" ON public.payment_requests
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (status IN ('pending', 'pending_verification'));

DROP POLICY IF EXISTS "Only admins update payment requests" ON public.payment_requests;
CREATE POLICY "Only admins update payment requests" ON public.payment_requests
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Only admins delete payment requests" ON public.payment_requests;
CREATE POLICY "Only admins delete payment requests" ON public.payment_requests
  FOR DELETE USING (public.is_admin());

-- STUDENT SUBSCRIPTIONS POLICIES
DROP POLICY IF EXISTS "Students view own subscription or admin view all" ON public.student_subscriptions;
CREATE POLICY "Students view own subscription or admin view all" ON public.student_subscriptions
  FOR SELECT USING (auth.uid() = student_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins or server RPC manage student subscriptions" ON public.student_subscriptions;
CREATE POLICY "Admins or server RPC manage student subscriptions" ON public.student_subscriptions
  FOR ALL USING (public.is_admin());

-- PG OWNER SUBSCRIPTIONS POLICIES
DROP POLICY IF EXISTS "Owners view own subscriptions or admin view all" ON public.subscriptions;
CREATE POLICY "Owners view own subscriptions or admin view all" ON public.subscriptions
  FOR SELECT USING (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Owners insert own initial subscription" ON public.subscriptions;
CREATE POLICY "Owners insert own initial subscription" ON public.subscriptions
  FOR INSERT WITH CHECK (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Owners update non-privileged fields or admin update all" ON public.subscriptions;
CREATE POLICY "Owners update non-privileged fields or admin update all" ON public.subscriptions
  FOR UPDATE USING (auth.uid() = owner_id OR public.is_admin());

-- ==============================================================================
-- 12. STORAGE BUCKET FOR PAYMENT RECEIPTS
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload own payment receipts" ON storage.objects;
CREATE POLICY "Users can upload own payment receipts" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'payment-receipts' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users view own receipts or admin view all" ON storage.objects;
CREATE POLICY "Users view own receipts or admin view all" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'payment-receipts' 
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin())
  );
