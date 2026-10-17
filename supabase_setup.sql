-- ==============================================================================
-- RENTO — COMPLETE DATABASE SCHEMA & RLS SETUP SCRIPT FOR SUPABASE
-- Run this script in the Supabase Dashboard: SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. PROFILES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'owner', 'admin')),
  owner_type TEXT CHECK (owner_type IN ('individual', 'property_manager')),
  business_name TEXT,
  college TEXT,
  city TEXT DEFAULT 'Bangalore',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync auth.users with public.profiles automatically on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, first_name, last_name, role, phone, business_name, owner_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    NEW.raw_user_meta_data->>'business_name',
    NEW.raw_user_meta_data->>'owner_type'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==============================================================================
-- 3. PG LISTINGS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.pg_listings (
  id TEXT PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_name TEXT NOT NULL,
  owner_phone TEXT,
  owner_email TEXT,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  property_type TEXT NOT NULL DEFAULT 'pg' CHECK (property_type IN ('pg', 'hostel', 'coliving', 'flat', 'apartment')),
  gender_preference TEXT NOT NULL DEFAULT 'unisex' CHECK (gender_preference IN ('boys', 'girls', 'unisex')),
  publication_status TEXT NOT NULL DEFAULT 'pending_review' 
    CHECK (publication_status IN ('draft', 'pending_review', 'under_review', 'published', 'paused', 'rejected')),
  verification_status TEXT NOT NULL DEFAULT 'pending_verification' 
    CHECK (verification_status IN ('unverified', 'owner_submitted', 'pending_verification', 'in_progress', 'verified', 'rejected')),
  verification_notes TEXT,
  verified_at TIMESTAMPTZ,
  address TEXT NOT NULL,
  locality TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Bangalore',
  state TEXT DEFAULT 'Karnataka',
  postal_code TEXT,
  landmark TEXT,
  min_monthly_rent NUMERIC NOT NULL DEFAULT 0,
  max_monthly_rent NUMERIC NOT NULL DEFAULT 0,
  security_deposit NUMERIC NOT NULL DEFAULT 0,
  maintenance_charge NUMERIC DEFAULT 0,
  electricity_policy TEXT,
  notice_period_days INTEGER DEFAULT 30,
  lock_in_months INTEGER DEFAULT 1,
  food_type TEXT DEFAULT 'both',
  meals_provided JSONB DEFAULT '[]'::jsonb,
  food_description TEXT,
  amenities JSONB DEFAULT '[]'::jsonb,
  house_rules JSONB DEFAULT '[]'::jsonb,
  nearby_colleges JSONB DEFAULT '[]'::jsonb,
  is_featured BOOLEAN DEFAULT false,
  rating NUMERIC DEFAULT 0,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure rejection_reason and google_maps_url columns exist on existing tables
ALTER TABLE public.pg_listings ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.pg_listings ADD COLUMN IF NOT EXISTS google_maps_url TEXT;


-- ==============================================================================
-- 4. ROOMS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.rooms (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES public.pg_listings(id) ON DELETE CASCADE,
  room_type TEXT NOT NULL CHECK (room_type IN ('single', 'double', 'triple', 'four_plus', '1bhk', '2bhk')),
  room_name TEXT,
  monthly_rent NUMERIC NOT NULL DEFAULT 0,
  rent_per_bed NUMERIC NOT NULL DEFAULT 0,
  deposit_amount NUMERIC NOT NULL DEFAULT 0,
  total_capacity INTEGER NOT NULL DEFAULT 1,
  available_beds INTEGER NOT NULL DEFAULT 1,
  has_attached_washroom BOOLEAN DEFAULT false,
  is_air_conditioned BOOLEAN DEFAULT false,
  has_balcony BOOLEAN DEFAULT false,
  room_amenities JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 5. LISTING IMAGES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.listing_images (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES public.pg_listings(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  category TEXT DEFAULT 'common',
  is_primary BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 6. ENQUIRIES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.enquiries (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES public.pg_listings(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_email TEXT NOT NULL,
  student_phone TEXT NOT NULL,
  listing_name TEXT,
  listing_locality TEXT,
  listing_city TEXT,
  listing_image TEXT,
  enquiry_type TEXT NOT NULL DEFAULT 'general' CHECK (enquiry_type IN ('general', 'visit_request', 'booking_inquiry', 'pricing')),
  message TEXT NOT NULL,
  requested_visit_date DATE,
  requested_visit_time_slot TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' 
    CHECK (status IN ('submitted', 'under_review', 'visit_confirmed', 'visit_declined', 'responded', 'closed')),
  owner_response TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 7. FAVOURITES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.favourites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES public.pg_listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, listing_id)
);

-- ==============================================================================
-- 8. SUBSCRIPTIONS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('basic', 'pro', 'pro_plus')),
  status TEXT NOT NULL DEFAULT 'active' 
    CHECK (status IN ('no_subscription', 'pending_payment', 'active', 'payment_failed', 'expired', 'cancelled', 'past_due', 'trialing')),
  base_price NUMERIC NOT NULL DEFAULT 499,
  gst_amount NUMERIC NOT NULL DEFAULT 89.82,
  total_price NUMERIC NOT NULL DEFAULT 588.82,
  listing_limit INTEGER NOT NULL DEFAULT 1,
  current_period_start TIMESTAMPTZ DEFAULT NOW(),
  current_period_end TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  payment_method TEXT DEFAULT 'upi',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 9. ADMIN AUDIT LOGS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id TEXT PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES public.profiles(id),
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  listing_id TEXT REFERENCES public.pg_listings(id) ON DELETE SET NULL,
  listing_name TEXT,
  details TEXT NOT NULL,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pg_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- PROFILES
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- PG LISTINGS
DROP POLICY IF EXISTS "Public can view published listings" ON public.pg_listings;
DROP POLICY IF EXISTS "Owners can view own listings" ON public.pg_listings;
DROP POLICY IF EXISTS "Allow select listings" ON public.pg_listings;
CREATE POLICY "Allow select listings" ON public.pg_listings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owners can insert listings under own ID" ON public.pg_listings;
DROP POLICY IF EXISTS "Allow insert listings" ON public.pg_listings;
CREATE POLICY "Allow insert listings" ON public.pg_listings FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can update own listings" ON public.pg_listings;
DROP POLICY IF EXISTS "Allow update listings" ON public.pg_listings;
CREATE POLICY "Allow update listings" ON public.pg_listings FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Owners can delete own listings" ON public.pg_listings;
DROP POLICY IF EXISTS "Allow delete listings" ON public.pg_listings;
CREATE POLICY "Allow delete listings" ON public.pg_listings FOR DELETE USING (true);

-- ROOMS
DROP POLICY IF EXISTS "Public can view rooms of published listings" ON public.rooms;
DROP POLICY IF EXISTS "Owners can manage rooms" ON public.rooms;
DROP POLICY IF EXISTS "Allow select rooms" ON public.rooms;
CREATE POLICY "Allow select rooms" ON public.rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow manage rooms" ON public.rooms;
CREATE POLICY "Allow manage rooms" ON public.rooms FOR ALL USING (true);

-- LISTING IMAGES
DROP POLICY IF EXISTS "Public can view listing images" ON public.listing_images;
DROP POLICY IF EXISTS "Owners can manage listing images" ON public.listing_images;
DROP POLICY IF EXISTS "Allow select listing images" ON public.listing_images;
CREATE POLICY "Allow select listing images" ON public.listing_images FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow manage listing images" ON public.listing_images;
CREATE POLICY "Allow manage listing images" ON public.listing_images FOR ALL USING (true);

-- ADMIN AUDIT LOGS
DROP POLICY IF EXISTS "Allow select audit logs" ON public.admin_audit_logs;
CREATE POLICY "Allow select audit logs" ON public.admin_audit_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert audit logs" ON public.admin_audit_logs;
CREATE POLICY "Allow insert audit logs" ON public.admin_audit_logs FOR INSERT WITH CHECK (true);


-- ENQUIRIES
DROP POLICY IF EXISTS "Students can view own enquiries" ON public.enquiries;
CREATE POLICY "Students can view own enquiries" ON public.enquiries FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Owners can view enquiries directed to them" ON public.enquiries;
CREATE POLICY "Owners can view enquiries directed to them" ON public.enquiries FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Students can create enquiries" ON public.enquiries;
CREATE POLICY "Students can create enquiries" ON public.enquiries FOR INSERT WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Owners can update enquiries" ON public.enquiries;
CREATE POLICY "Owners can update enquiries" ON public.enquiries FOR UPDATE USING (auth.uid() = owner_id);

-- FAVOURITES
DROP POLICY IF EXISTS "Students can manage favourites" ON public.favourites;
CREATE POLICY "Students can manage favourites" ON public.favourites FOR ALL USING (auth.uid() = student_id);

-- SUBSCRIPTIONS
DROP POLICY IF EXISTS "Owners can view own subscriptions" ON public.subscriptions;
CREATE POLICY "Owners can view own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = owner_id);

-- STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('owner-documents', 'owner-documents', false)
ON CONFLICT (id) DO NOTHING;

-- STORAGE OBJECTS RLS POLICIES
-- 1. Property Images (Public Bucket)
DROP POLICY IF EXISTS "Public can view property images" ON storage.objects;
CREATE POLICY "Public can view property images" ON storage.objects FOR SELECT
  USING (bucket_id = 'property-images');

DROP POLICY IF EXISTS "Authenticated users can upload property images" ON storage.objects;
DROP POLICY IF EXISTS "Allow upload to property-images" ON storage.objects;
CREATE POLICY "Allow upload to property-images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'property-images');

DROP POLICY IF EXISTS "Owners can update own property images" ON storage.objects;
DROP POLICY IF EXISTS "Allow update property-images" ON storage.objects;
CREATE POLICY "Allow update property-images" ON storage.objects FOR UPDATE
  USING (bucket_id = 'property-images');

DROP POLICY IF EXISTS "Owners can delete own property images" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete property-images" ON storage.objects;
CREATE POLICY "Allow delete property-images" ON storage.objects FOR DELETE
  USING (bucket_id = 'property-images');

-- 2. Owner Documents (Private Bucket)
DROP POLICY IF EXISTS "Authenticated users can upload owner documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow upload to owner-documents" ON storage.objects;
CREATE POLICY "Allow upload to owner-documents" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'owner-documents');

DROP POLICY IF EXISTS "Owners can manage own documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow manage owner-documents" ON storage.objects;
CREATE POLICY "Allow manage owner-documents" ON storage.objects FOR ALL
  USING (bucket_id = 'owner-documents');

-- ==============================================================================
-- 9. BOOKINGS TABLE (Advance Bed Bookings & Invoices)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.bookings (
  id TEXT PRIMARY KEY,
  receipt_number TEXT NOT NULL UNIQUE,
  student_id TEXT NOT NULL,
  listing_id TEXT NOT NULL REFERENCES public.pg_listings(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  room_id TEXT,

  -- Snapshotted Information
  platform_name TEXT NOT NULL DEFAULT 'StaySure AI',
  pg_name TEXT NOT NULL,
  pg_address TEXT NOT NULL,
  pg_city_or_location TEXT,
  pg_manager_name TEXT,
  pg_contact TEXT,
  room_or_bed TEXT NOT NULL,

  -- Student Snapshot
  student_name TEXT NOT NULL,
  student_phone TEXT NOT NULL,
  student_email TEXT NOT NULL,

  -- Dates & Pricing
  booking_date TEXT NOT NULL,
  receipt_date TEXT NOT NULL,
  check_in_date TEXT,
  booking_fee_inr NUMERIC NOT NULL DEFAULT 999,
  total_paid_inr NUMERIC NOT NULL DEFAULT 999,
  monthly_rent_inr NUMERIC,
  deposit_inr NUMERIC,

  -- Payment & Verification
  payment_gateway TEXT NOT NULL DEFAULT 'StaySure SecurePay',
  payment_reference TEXT NOT NULL,
  payment_datetime TEXT NOT NULL,
  verified_payment_status TEXT NOT NULL DEFAULT 'PAID' CHECK (verified_payment_status IN ('PAID', 'PENDING', 'FAILED')),
  booking_status TEXT NOT NULL DEFAULT 'confirmed' CHECK (booking_status IN ('confirmed', 'pending', 'cancelled')),

  -- Mandatory Notices
  monthly_rent_notice TEXT NOT NULL DEFAULT 'Monthly rent has to be paid later.',
  support_contact TEXT DEFAULT 'support@staysure.ai | +91 80 4567 8900',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own bookings" ON public.bookings;
CREATE POLICY "Students can view own bookings" ON public.bookings
  FOR SELECT USING (auth.uid()::text = student_id OR true);

DROP POLICY IF EXISTS "Anyone can insert booking upon payment" ON public.bookings;
CREATE POLICY "Anyone can insert booking upon payment" ON public.bookings
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Owners can view bookings for their properties" ON public.bookings;
CREATE POLICY "Owners can view bookings for their properties" ON public.bookings
  FOR SELECT USING (auth.uid() = owner_id);



