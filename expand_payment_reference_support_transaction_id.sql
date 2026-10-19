-- ============================================================================
-- MIGRATION: Support Transaction IDs & Expanded Reference Length (Up to 35 Chars)
-- Enables acceptance of Google Pay Transaction IDs (e.g. T2610101024439827156),
-- PhonePe Transaction IDs, Paytm Order IDs, and standard 12-digit NPCI UTRs.
-- ============================================================================

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
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_clean_utr TEXT;
  v_req RECORD;
  v_prov_until TIMESTAMPTZ := NOW() + INTERVAL '24 hours';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit payment proof';
  END IF;

  -- 1. Normalize UTR / Transaction ID (strip common labels and separators)
  v_clean_utr := UPPER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(p_utr), '^(?:(?:UPI\s*)?(?:TRANSACTION\s*ID|TXN\s*(?:ID)?)|UTR(?:\s*NO|\s*NUMBER)?|UPI\s*REF(?:\s*NO|\s*ID)?|REF(?:\s*NO|\s*ID)?|RRN)[:\-_/\s]*', '', 'i'), '[\s\-_.]', '', 'g'));

  IF v_clean_utr IS NULL OR LENGTH(v_clean_utr) < 10 THEN
    RAISE EXCEPTION 'Invalid reference format. Standard UPI transaction reference or Transaction ID must be at least 10 characters (standard NPCI is 12 digits).';
  END IF;

  IF LENGTH(v_clean_utr) > 35 THEN
    RAISE EXCEPTION 'Invalid reference format. Maximum allowed length is 35 characters.';
  END IF;

  IF v_clean_utr !~ '^[A-Z0-9]{10,35}$' THEN
    RAISE EXCEPTION 'Invalid characters in reference. Only alphanumeric characters are allowed.';
  END IF;

  -- Reject known sample/dummy strings
  IF v_clean_utr IN ('123456789012', '000000000000', '111111111111', '999999999999', 'TEST12345678', 'ABCDEF123456', 'UTR123456789', 'DEMO12345678') OR v_clean_utr ~ '^(.)\1{9,}$' THEN
    RAISE EXCEPTION 'Invalid or sample transaction reference. Please provide the authentic UTR or Transaction ID from your payment receipt.';
  END IF;

  -- 2. Lock payment request row for update
  SELECT * INTO v_req
  FROM public.payment_requests
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment request not found with ID %', p_payment_id;
  END IF;

  IF v_req.user_id != v_user_id THEN
    RAISE EXCEPTION 'Access denied. You can only submit payment proof for your own payment requests.';
  END IF;

  IF v_req.status = 'approved' THEN
    RAISE EXCEPTION 'This payment has already been approved and activated.';
  END IF;

  -- 3. Check for Global Duplicate Reference
  IF EXISTS (
    SELECT 1 FROM public.payment_requests
    WHERE UPPER(REGEXP_REPLACE(TRIM(utr), '[\s\-_.]', '', 'g')) = v_clean_utr AND id != p_payment_id
  ) THEN
    RAISE EXCEPTION 'This transaction reference (%) has already been submitted for another payment. Each payment reference can only be used once.', v_clean_utr;
  END IF;

  -- 4. Update the payment request with proof and fraud triage telemetry
  BEGIN
    UPDATE public.payment_requests
    SET
      utr = v_clean_utr,
      receipt_url = COALESCE(p_receipt_url, public.payment_requests.receipt_url),
      receipt_storage_path = COALESCE(p_receipt_path, public.payment_requests.receipt_storage_path),
      screenshot_hash = COALESCE(p_screenshot_hash, public.payment_requests.screenshot_hash),
      risk_score = p_risk_score,
      risk_level = p_risk_level,
      risk_flags = p_risk_flags,
      mismatch_reasons = p_mismatch_reasons,
      ocr_status = COALESCE(p_ocr_data->>'status', public.payment_requests.ocr_status),
      ocr_confidence = (p_ocr_data->>'confidence')::NUMERIC,
      ocr_raw_text = p_ocr_data->>'rawText',
      ocr_extracted_utr = COALESCE(p_ocr_data->>'extractedUtr', public.payment_requests.ocr_extracted_utr),
      ocr_extracted_amount = (p_ocr_data->>'extractedAmount')::NUMERIC,
      ocr_extracted_payee = p_ocr_data->>'extractedPayee',
      ocr_extracted_date = p_ocr_data->>'extractedDate',
      ocr_extracted_status = p_ocr_data->>'extractedStatus',
      ocr_detected_app = p_ocr_data->>'detectedApp',
      status = 'pending_verification',
      updated_at = NOW()
    WHERE id = p_payment_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'This transaction reference (%) has already been submitted for another payment. Each payment reference can only be used once.', v_clean_utr;
  END;

  -- 5. Provisional Access (24-hour buffer while awaiting administrator verification)
  IF v_req.user_type = 'student' THEN
    INSERT INTO public.student_subscriptions (
      student_id, plan_id, status, entitlement_type, features,
      provisional_until, created_at, updated_at
    )
    VALUES (
      v_user_id,
      'student_pass',
      'pending_verification',
      'lifetime',
      ARRAY['instant_booking', 'owner_direct_call', 'unlimited_queries', 'live_pg_location', 'map_directions', 'pg_comparisons']::TEXT[],
      v_prov_until,
      NOW(),
      NOW()
    )
    ON CONFLICT (student_id) DO UPDATE
    SET
      status = 'pending_verification',
      provisional_until = v_prov_until,
      updated_at = NOW()
    WHERE public.student_subscriptions.status != 'active';
  ELSE
    INSERT INTO public.owner_subscriptions (
      owner_id, plan_id, status, billing_cycle, max_listings,
      provisional_until, current_period_start, current_period_end, created_at, updated_at
    )
    VALUES (
      v_user_id,
      v_req.plan_id,
      'pending_verification',
      'monthly',
      CASE v_req.plan_id
        WHEN 'starter' THEN 5
        WHEN 'pro' THEN 15
        WHEN 'pro_plus' THEN 50
        ELSE 1
      END,
      v_prov_until,
      NOW(),
      NOW() + INTERVAL '30 days',
      NOW(),
      NOW()
    )
    ON CONFLICT (owner_id) DO UPDATE
    SET
      plan_id = v_req.plan_id,
      status = 'pending_verification',
      provisional_until = v_prov_until,
      updated_at = NOW()
    WHERE public.owner_subscriptions.status != 'active';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'utr', v_clean_utr,
    'status', 'pending_verification',
    'provisional_until', v_prov_until,
    'risk_level', p_risk_level
  );
END;
$$;
