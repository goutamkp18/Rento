-- ==============================================================================
-- RENTO — DATABASE MIGRATION FOR PG PROPERTY EDITING & ADMIN VERIFICATION
-- Run this script in the Supabase Dashboard: SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Create listing_revisions table for pending owner property modifications
CREATE TABLE IF NOT EXISTS public.listing_revisions (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES public.pg_listings(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending_review' 
    CHECK (status IN ('draft', 'pending_review', 'under_review', 'approved', 'rejected')),
  proposed_changes JSONB NOT NULL,
  submission_date TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add pending revision tracking and optional business columns to public.pg_listings (backward compatible)
ALTER TABLE public.pg_listings ADD COLUMN IF NOT EXISTS has_pending_revision BOOLEAN DEFAULT false;
ALTER TABLE public.pg_listings ADD COLUMN IF NOT EXISTS pending_revision_id TEXT;
ALTER TABLE public.pg_listings ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE public.pg_listings ADD COLUMN IF NOT EXISTS owner_type TEXT DEFAULT 'individual';

-- 3. Create helpful indexes for performance
CREATE INDEX IF NOT EXISTS idx_listing_revisions_listing_id ON public.listing_revisions(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_revisions_owner_id ON public.listing_revisions(owner_id);
CREATE INDEX IF NOT EXISTS idx_listing_revisions_status ON public.listing_revisions(status);

-- 4. Enable Row Level Security (RLS) on listing_revisions
ALTER TABLE public.listing_revisions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for listing_revisions
-- SELECT: Owners can view their own revisions; admins can view all revisions
DROP POLICY IF EXISTS "Allow select listing revisions" ON public.listing_revisions;
CREATE POLICY "Allow select listing revisions" ON public.listing_revisions 
  FOR SELECT USING (
    auth.uid() = owner_id 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- INSERT: Owners can insert revisions for their own listings; admins can insert
DROP POLICY IF EXISTS "Allow insert listing revisions" ON public.listing_revisions;
CREATE POLICY "Allow insert listing revisions" ON public.listing_revisions 
  FOR INSERT WITH CHECK (
    auth.uid() = owner_id 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- UPDATE: Owners can update their own draft/rejected revisions; admins can update any revision (approve/reject)
DROP POLICY IF EXISTS "Allow update listing revisions" ON public.listing_revisions;
CREATE POLICY "Allow update listing revisions" ON public.listing_revisions 
  FOR UPDATE USING (
    auth.uid() = owner_id 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- DELETE: Owners can delete own draft revisions; admins can delete any
DROP POLICY IF EXISTS "Allow delete listing revisions" ON public.listing_revisions;
CREATE POLICY "Allow delete listing revisions" ON public.listing_revisions 
  FOR DELETE USING (
    auth.uid() = owner_id 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 6. RPC Function: Atomically apply an approved listing revision to pg_listings, rooms, and listing_images
CREATE OR REPLACE FUNCTION public.apply_approved_listing_revision(
  p_revision_id TEXT,
  p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rev RECORD;
  v_changes JSONB;
  v_listing_id TEXT;
  v_rooms JSONB;
  v_images JSONB;
  r JSONB;
  img JSONB;
  idx INTEGER := 1;
BEGIN
  -- 1. Fetch revision
  SELECT * INTO v_rev FROM public.listing_revisions WHERE id = p_revision_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Revision % not found', p_revision_id;
  END IF;

  v_listing_id := v_rev.listing_id;
  v_changes := v_rev.proposed_changes;

  -- 2. Update pg_listings core fields
  UPDATE public.pg_listings SET
    name = COALESCE(v_changes->>'name', name),
    tagline = COALESCE(v_changes->>'tagline', tagline),
    description = COALESCE(v_changes->>'description', description),
    property_type = COALESCE(v_changes->>'property_type', property_type),
    gender_preference = COALESCE(v_changes->>'gender_preference', gender_preference),
    address = COALESCE(v_changes->>'address', address),
    locality = COALESCE(v_changes->>'locality', locality),
    city = COALESCE(v_changes->>'city', city),
    state = COALESCE(v_changes->>'state', state),
    postal_code = COALESCE(v_changes->>'postal_code', postal_code),
    landmark = COALESCE(v_changes->>'landmark', landmark),
    google_maps_url = COALESCE(v_changes->>'google_maps_url', google_maps_url),
    min_monthly_rent = COALESCE((v_changes->>'min_monthly_rent')::NUMERIC, min_monthly_rent),
    max_monthly_rent = COALESCE((v_changes->>'max_monthly_rent')::NUMERIC, max_monthly_rent),
    security_deposit = COALESCE((v_changes->>'security_deposit')::NUMERIC, security_deposit),
    maintenance_charge = COALESCE((v_changes->>'maintenance_charge')::NUMERIC, maintenance_charge),
    electricity_policy = COALESCE(v_changes->>'electricity_policy', electricity_policy),
    notice_period_days = COALESCE((v_changes->>'notice_period_days')::INTEGER, notice_period_days),
    lock_in_months = COALESCE((v_changes->>'lock_in_months')::INTEGER, lock_in_months),
    food_type = COALESCE(v_changes->>'food_type', food_type),
    food_description = COALESCE(v_changes->>'food_description', food_description),
    meals_provided = CASE WHEN v_changes ? 'meals_provided' THEN v_changes->'meals_provided' ELSE meals_provided END,
    amenities = CASE WHEN v_changes ? 'amenities' THEN v_changes->'amenities' ELSE amenities END,
    house_rules = CASE WHEN v_changes ? 'house_rules' THEN v_changes->'house_rules' ELSE house_rules END,
    nearby_colleges = CASE WHEN v_changes ? 'nearby_colleges' THEN v_changes->'nearby_colleges' ELSE nearby_colleges END,
    publication_status = 'published',
    has_pending_revision = false,
    pending_revision_id = NULL,
    updated_at = NOW()
  WHERE id = v_listing_id;

  -- 3. Replace rooms if provided in proposed changes
  IF v_changes ? 'rooms' AND jsonb_array_length(v_changes->'rooms') > 0 THEN
    DELETE FROM public.rooms WHERE listing_id = v_listing_id;
    FOR r IN SELECT * FROM jsonb_array_elements(v_changes->'rooms') LOOP
      INSERT INTO public.rooms (
        id, listing_id, room_type, room_name, monthly_rent, rent_per_bed,
        deposit_amount, total_capacity, available_beds, has_attached_washroom,
        is_air_conditioned, has_balcony, room_amenities, created_at
      ) VALUES (
        COALESCE(r->>'id', 'rm_' || floor(extract(epoch from now()))::text || '_' || substr(md5(random()::text), 1, 4)),
        v_listing_id,
        COALESCE(r->>'room_type', 'double'),
        r->>'room_name',
        COALESCE((r->>'rent_per_bed')::NUMERIC, 8000),
        COALESCE((r->>'rent_per_bed')::NUMERIC, 8000),
        COALESCE((r->>'deposit_amount')::NUMERIC, 15000),
        COALESCE((r->>'total_capacity')::INTEGER, 2),
        COALESCE((r->>'available_beds')::INTEGER, 1),
        COALESCE((r->>'has_attached_washroom')::BOOLEAN, true),
        COALESCE((r->>'is_air_conditioned')::BOOLEAN, false),
        COALESCE((r->>'has_balcony')::BOOLEAN, false),
        COALESCE(r->'room_amenities', '[]'::jsonb),
        NOW()
      );
    END LOOP;
  END IF;

  -- 4. Replace listing_images if provided in proposed changes
  IF v_changes ? 'images' AND jsonb_array_length(v_changes->'images') > 0 THEN
    DELETE FROM public.listing_images WHERE listing_id = v_listing_id;
    idx := 1;
    FOR img IN SELECT * FROM jsonb_array_elements(v_changes->'images') LOOP
      INSERT INTO public.listing_images (
        id, listing_id, image_url, caption, category, is_primary, display_order, created_at
      ) VALUES (
        COALESCE(img->>'id', 'img_' || floor(extract(epoch from now()))::text || '_' || idx::text),
        v_listing_id,
        img->>'image_url',
        img->>'caption',
        COALESCE(img->>'category', 'common'),
        COALESCE((img->>'is_primary')::BOOLEAN, (idx = 1)),
        COALESCE((img->>'display_order')::INTEGER, idx),
        NOW()
      );
      idx := idx + 1;
    END LOOP;
  END IF;

  -- 5. Mark revision as approved
  UPDATE public.listing_revisions SET
    status = 'approved',
    reviewed_at = NOW(),
    reviewed_by = p_admin_id,
    updated_at = NOW()
  WHERE id = p_revision_id;

  RETURN jsonb_build_object(
    'success', true,
    'listing_id', v_listing_id,
    'revision_id', p_revision_id,
    'status', 'approved'
  );
END;
$$;
