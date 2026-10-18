-- ==============================================================================
-- RENTO — 30-DAY FREE TRIAL FOR PG OWNERS DATABASE MIGRATION
-- Execute this SQL in your Supabase SQL Editor:
-- Supabase Dashboard -> SQL Editor -> New query -> Paste & Run
-- ==============================================================================

-- 1. ADD TRIAL AND EXPIRATION COLUMNS TO SUBSCRIPTIONS TABLE
ALTER TABLE public.subscriptions 
  ADD COLUMN IF NOT EXISTS trial_status TEXT DEFAULT 'eligible' 
    CHECK (trial_status IN ('eligible', 'active', 'expired', 'converted')),
  ADD COLUMN IF NOT EXISTS trial_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_plan_id TEXT DEFAULT 'pro' 
    CHECK (trial_plan_id IN ('basic', 'pro', 'pro_plus')),
  ADD COLUMN IF NOT EXISTS trial_listing_limit INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS selected_plan_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'none' 
    CHECK (payment_status IN ('none', 'pending', 'paid', 'failed')),
  ADD COLUMN IF NOT EXISTS active_listing_id TEXT;

-- 2. ENFORCE ONE SUBSCRIPTION RECORD PER OWNER ACCOUNT
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_owner_subscription'
  ) THEN
    ALTER TABLE public.subscriptions ADD CONSTRAINT unique_owner_subscription UNIQUE (owner_id);
  END IF;
END $$;

-- 3. ROW LEVEL SECURITY (RLS) POLICIES FOR SUBSCRIPTIONS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view own subscriptions" ON public.subscriptions;
CREATE POLICY "Owners can view own subscriptions" ON public.subscriptions 
  FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can insert own subscriptions" ON public.subscriptions;
CREATE POLICY "Owners can insert own subscriptions" ON public.subscriptions 
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can update own subscriptions" ON public.subscriptions;
CREATE POLICY "Owners can update own subscriptions" ON public.subscriptions 
  FOR UPDATE USING (auth.uid() = owner_id);

-- 4. SERVER-AUTHORITATIVE TRIAL ACTIVATION RPC FUNCTION
-- Strictly enforces 1 trial per owner, authoritatively calculates 30-day window using NOW()
CREATE OR REPLACE FUNCTION public.start_owner_trial(p_owner_id UUID)
RETURNS JSONB AS $$
DECLARE
  sub RECORD;
  now_ts TIMESTAMPTZ := NOW();
  expiry_ts TIMESTAMPTZ := NOW() + INTERVAL '30 days';
BEGIN
  -- Security check: caller must be authenticated and match owner_id
  IF auth.uid() IS NULL OR (auth.uid() != p_owner_id) THEN
    RAISE EXCEPTION 'Unauthorized: cannot start trial for another user';
  END IF;

  SELECT * INTO sub FROM public.subscriptions WHERE owner_id = p_owner_id;

  IF NOT FOUND THEN
    INSERT INTO public.subscriptions (
      owner_id,
      plan_id,
      status,
      base_price,
      gst_amount,
      total_price,
      listing_limit,
      current_period_start,
      current_period_end,
      payment_method,
      trial_status,
      trial_start,
      trial_end,
      trial_plan_id,
      trial_listing_limit,
      payment_status
    ) VALUES (
      p_owner_id,
      'pro',
      'trialing',
      0,
      0,
      0,
      3,
      now_ts,
      expiry_ts,
      'free_trial',
      'active',
      now_ts,
      expiry_ts,
      'pro',
      3,
      'none'
    ) RETURNING * INTO sub;
  ELSIF sub.trial_start IS NULL OR sub.trial_status = 'eligible' THEN
    UPDATE public.subscriptions
    SET
      trial_status = 'active',
      trial_start = now_ts,
      trial_end = expiry_ts,
      status = 'trialing',
      plan_id = 'pro',
      listing_limit = 3,
      current_period_start = now_ts,
      current_period_end = expiry_ts,
      payment_method = 'free_trial',
      updated_at = now_ts
    WHERE owner_id = p_owner_id
    RETURNING * INTO sub;
  END IF;

  RETURN to_jsonb(sub);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. DATABASE TRIGGER: START TRIAL COUNTDOWN ON FIRST LISTING REVIEW SUBMISSION
-- Automatically anchors the 30-day window on server-time when owner submits first valid PG listing
CREATE OR REPLACE FUNCTION public.handle_listing_submission_trial_trigger()
RETURNS TRIGGER AS $$
DECLARE
  existing_sub RECORD;
  now_ts TIMESTAMPTZ := NOW();
  expiry_ts TIMESTAMPTZ := NOW() + INTERVAL '30 days';
BEGIN
  -- Trigger countdown when a listing is submitted for review or published
  IF NEW.publication_status IN ('pending_review', 'under_review', 'published') THEN
    SELECT * INTO existing_sub FROM public.subscriptions WHERE owner_id = NEW.owner_id;

    IF NOT FOUND THEN
      -- Create initial active trial with 30-day duration
      INSERT INTO public.subscriptions (
        owner_id,
        plan_id,
        status,
        base_price,
        gst_amount,
        total_price,
        listing_limit,
        current_period_start,
        current_period_end,
        payment_method,
        trial_status,
        trial_start,
        trial_end,
        trial_plan_id,
        trial_listing_limit,
        payment_status
      ) VALUES (
        NEW.owner_id,
        'pro',
        'trialing',
        0,
        0,
        0,
        3,
        now_ts,
        expiry_ts,
        'free_trial',
        'active',
        now_ts,
        expiry_ts,
        'pro',
        3,
        'none'
      );
    ELSIF existing_sub.trial_status = 'eligible' AND existing_sub.trial_start IS NULL THEN
      -- Start countdown on eligible owner subscription
      UPDATE public.subscriptions
      SET
        trial_status = 'active',
        trial_start = now_ts,
        trial_end = expiry_ts,
        status = 'trialing',
        plan_id = 'pro',
        listing_limit = 3,
        current_period_start = now_ts,
        current_period_end = expiry_ts,
        payment_method = 'free_trial',
        updated_at = now_ts
      WHERE owner_id = NEW.owner_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_start_trial_on_listing_submit ON public.pg_listings;
CREATE TRIGGER trg_start_trial_on_listing_submit
  AFTER INSERT OR UPDATE OF publication_status ON public.pg_listings
  FOR EACH ROW EXECUTE PROCEDURE public.handle_listing_submission_trial_trigger();

-- 6. AUTHORITATIVE SUBSCRIPTION EXPIRATION & READ RPC FUNCTION
-- Evaluates trial expiration using server NOW(), seamlessly transitions to free Basic plan (1 PG limit)
CREATE OR REPLACE FUNCTION public.get_authoritative_owner_subscription(p_owner_id UUID)
RETURNS JSONB AS $$
DECLARE
  sub RECORD;
BEGIN
  -- Security check
  IF auth.uid() IS NULL OR (auth.uid() != p_owner_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO sub FROM public.subscriptions WHERE owner_id = p_owner_id;

  IF FOUND THEN
    -- If trial has ended, automatically transition to free Basic plan with limit 1
    IF (sub.status = 'trialing' OR sub.trial_status = 'active') AND sub.trial_end IS NOT NULL AND sub.trial_end <= NOW() THEN
      UPDATE public.subscriptions
      SET
        status = 'expired',
        trial_status = 'expired',
        plan_id = 'basic',
        listing_limit = 1,
        updated_at = NOW()
      WHERE owner_id = p_owner_id
      RETURNING * INTO sub;
    END IF;
    RETURN to_jsonb(sub);
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
