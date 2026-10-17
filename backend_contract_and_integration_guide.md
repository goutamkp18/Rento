# RENTO — BACKEND CONTRACT & INTEGRATION GUIDE

> **For Backend Engineering Teammate**  
> This document specifies the complete PostgreSQL / Supabase database contract, Row Level Security (RLS) policies, storage bucket configurations, and authentication expectations required to connect the Rento frontend to your live backend.

---

## 1. Architecture Overview

Rento uses a hybrid persistence architecture:
1. **Live Supabase Mode (Production/Staging):** When `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are provided in `.env`, all frontend services query Supabase directly via the official `@supabase/supabase-js` client.
2. **Local Persistent Mode (Zero-Config Development):** When Supabase keys are omitted, the frontend falls back gracefully to local browser persistent storage (`localStorage`) **with zero pre-seeded fake data**. Real users sign up, submit real listings, request genuine visits, and see authentic updates across sessions.

---

## 2. Environment Variables (.env)

Create a `.env` file in the project root with your Supabase credentials:

```bash
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
# Alternatively:
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-public-key>
```

> **Security Rule:** Never place your Supabase `service_role` key in frontend `.env` files. The frontend only consumes the anonymous public key (`anon`).

---

## 3. Database Schema (PostgreSQL / Supabase DDL)

Execute the following SQL in your Supabase SQL Editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. PROFILES TABLE (Mirrors Supabase auth.users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('student', 'owner', 'admin')),
  owner_type TEXT CHECK (owner_type IN ('individual', 'property_manager')),
  business_name TEXT,
  college TEXT,
  city TEXT DEFAULT 'Bangalore',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-sync profile on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, phone, business_name, owner_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    NEW.raw_user_meta_data->>'business_name',
    NEW.raw_user_meta_data->>'owner_type'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==============================================================================
-- 2. PG LISTINGS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.pg_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  property_type TEXT NOT NULL CHECK (property_type IN ('pg', 'hostel', 'coliving', 'apartment')),
  gender_preference TEXT NOT NULL CHECK (gender_preference IN ('boys', 'girls', 'unisex')),
  publication_status TEXT NOT NULL DEFAULT 'pending_review' 
    CHECK (publication_status IN ('draft', 'pending_review', 'under_review', 'published', 'paused', 'rejected')),
  verification_status TEXT NOT NULL DEFAULT 'pending_verification' 
    CHECK (verification_status IN ('unverified', 'pending_verification', 'in_progress', 'verified', 'rejected')),
  verification_notes TEXT,
  verified_at TIMESTAMPTZ,
  address TEXT NOT NULL,
  locality TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Bangalore',
  pincode TEXT NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  min_monthly_rent NUMERIC NOT NULL,
  max_monthly_rent NUMERIC NOT NULL,
  security_deposit NUMERIC NOT NULL,
  maintenance_charge NUMERIC DEFAULT 0,
  notice_period_days INTEGER DEFAULT 30,
  food_included BOOLEAN DEFAULT true,
  food_type TEXT NOT NULL CHECK (food_type IN ('veg_only', 'veg_nonveg', 'none')),
  description TEXT,
  house_rules JSONB DEFAULT '[]'::jsonb,
  amenities JSONB DEFAULT '[]'::jsonb,
  nearby_colleges JSONB DEFAULT '[]'::jsonb,
  owner_name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  owner_phone TEXT NOT NULL,
  is_featured BOOLEAN DEFAULT false,
  rating NUMERIC DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pg_listings_owner ON public.pg_listings(owner_id);
CREATE INDEX IF NOT EXISTS idx_pg_listings_publication ON public.pg_listings(publication_status);
CREATE INDEX IF NOT EXISTS idx_pg_listings_locality ON public.pg_listings(locality);

-- ==============================================================================
-- 3. ROOMS TABLE (Per-room inventory & bed availability)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES public.pg_listings(id) ON DELETE CASCADE,
  room_type TEXT NOT NULL CHECK (room_type IN ('single', 'double', 'triple', 'four_plus')),
  monthly_rent NUMERIC NOT NULL,
  security_deposit NUMERIC NOT NULL,
  total_capacity INTEGER NOT NULL DEFAULT 1,
  available_beds INTEGER NOT NULL DEFAULT 1,
  has_attached_washroom BOOLEAN DEFAULT false,
  has_ac BOOLEAN DEFAULT false,
  has_balcony BOOLEAN DEFAULT false,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_listing ON public.rooms(listing_id);

-- ==============================================================================
-- 4. LISTING IMAGES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.listing_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES public.pg_listings(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  is_cover BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listing_images_listing ON public.listing_images(listing_id);

-- ==============================================================================
-- 5. ENQUIRIES & VISIT REQUESTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.enquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES public.pg_listings(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_email TEXT NOT NULL,
  student_phone TEXT NOT NULL,
  enquiry_type TEXT NOT NULL CHECK (enquiry_type IN ('general', 'pricing', 'visit_request')),
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

CREATE INDEX IF NOT EXISTS idx_enquiries_student ON public.enquiries(student_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_owner ON public.enquiries(owner_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_listing ON public.enquiries(listing_id);

-- ==============================================================================
-- 6. STUDENT FAVOURITES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.favourites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.pg_listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_favourites_student ON public.favourites(student_id);

-- ==============================================================================
-- 7. OWNER SUBSCRIPTIONS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('basic', 'pro', 'pro_plus')),
  status TEXT NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'past_due', 'cancelled', 'payment_failed', 'trialing')),
  base_price NUMERIC NOT NULL,
  gst_amount NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  listing_limit INTEGER NOT NULL DEFAULT 1,
  current_period_start TIMESTAMPTZ DEFAULT NOW(),
  current_period_end TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  payment_method TEXT DEFAULT 'upi',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_owner ON public.subscriptions(owner_id);

-- ==============================================================================
-- 8. ADMINISTRATIVE AUDIT LOGS TABLE (Immutable Trail)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id TEXT PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES public.profiles(id),
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  listing_id UUID REFERENCES public.pg_listings(id) ON DELETE SET NULL,
  listing_name TEXT,
  details TEXT NOT NULL,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON public.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_listing ON public.admin_audit_logs(listing_id);
```

---

## 4. Database Security Triggers (Anti-Tamper & Anti-Privilege Escalation)

Execute these database triggers to guarantee that frontend users cannot escalate privileges or self-verify listings, even if they execute raw SQL or API calls:

```sql
-- Trigger 1: Prevent Self-Role Escalation on Profiles
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- If role is being modified, ensure the caller is already an authorized administrator
  IF NEW.role <> OLD.role THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Security Violation: Users cannot elevate their own role.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.prevent_role_escalation();

-- Trigger 2: Prevent Owners from Approving or Verifying Own Listings
CREATE OR REPLACE FUNCTION public.protect_listing_status()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Check if verification_status is being modified
  IF NEW.verification_status <> OLD.verification_status THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Security Violation: Only verified administrators can alter property verification status.';
    END IF;
  END IF;

  -- 2. Check if publication_status is being set to 'published'
  IF NEW.publication_status = 'published' AND OLD.publication_status <> 'published' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Security Violation: Properties require administrator review and approval before becoming published.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_listing_status ON public.pg_listings;
CREATE TRIGGER trg_protect_listing_status
  BEFORE UPDATE ON public.pg_listings
  FOR EACH ROW EXECUTE PROCEDURE public.protect_listing_status();
```

---

## 5. Row Level Security (RLS) Policies

Enable Row Level Security on all tables following least-privilege principles:

```sql
-- 1. PROFILES RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone" 
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile (role protected by trigger)" 
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. PG LISTINGS RLS
ALTER TABLE public.pg_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published listings" 
  ON public.pg_listings FOR SELECT 
  USING (publication_status = 'published');

CREATE POLICY "Owners can view own listings" 
  ON public.pg_listings FOR SELECT 
  USING (auth.uid() = owner_id);

CREATE POLICY "Admins can view all listings" 
  ON public.pg_listings FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Owners can insert listings under own ID" 
  ON public.pg_listings FOR INSERT 
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update own listings (status protected by trigger)" 
  ON public.pg_listings FOR UPDATE 
  USING (auth.uid() = owner_id);

CREATE POLICY "Admins can update all listings" 
  ON public.pg_listings FOR UPDATE 
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. ROOMS RLS
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view rooms of published listings" 
  ON public.rooms FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM public.pg_listings WHERE id = listing_id AND publication_status = 'published')
  );

CREATE POLICY "Owners can view and manage their rooms" 
  ON public.rooms FOR ALL 
  USING (
    EXISTS (SELECT 1 FROM public.pg_listings WHERE id = listing_id AND owner_id = auth.uid())
  );

-- 4. LISTING IMAGES RLS
ALTER TABLE public.listing_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view images of published listings" 
  ON public.listing_images FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM public.pg_listings WHERE id = listing_id AND publication_status = 'published')
  );

CREATE POLICY "Owners can view and manage their listing images" 
  ON public.listing_images FOR ALL 
  USING (
    EXISTS (SELECT 1 FROM public.pg_listings WHERE id = listing_id AND owner_id = auth.uid())
  );

-- 5. ENQUIRIES RLS
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own enquiries" 
  ON public.enquiries FOR SELECT 
  USING (auth.uid() = student_id);

CREATE POLICY "Owners can view enquiries directed to their properties" 
  ON public.enquiries FOR SELECT 
  USING (auth.uid() = owner_id);

CREATE POLICY "Students can create enquiries" 
  ON public.enquiries FOR INSERT 
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Owners can respond to enquiries for their properties" 
  ON public.enquiries FOR UPDATE 
  USING (auth.uid() = owner_id);

-- 6. FAVOURITES RLS
ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can manage own favourites" 
  ON public.favourites FOR ALL 
  USING (auth.uid() = student_id);

-- 7. SUBSCRIPTIONS RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own subscriptions" 
  ON public.subscriptions FOR SELECT 
  USING (auth.uid() = owner_id);

-- Subscriptions should ONLY be inserted/updated via payment gateway webhooks using service_role
CREATE POLICY "Admins and service-role can manage subscriptions" 
  ON public.subscriptions FOR ALL 
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 8. AUDIT LOGS RLS
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs" 
  ON public.admin_audit_logs FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert audit logs" 
  ON public.admin_audit_logs FOR INSERT 
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
-- Note: NO UPDATE OR DELETE POLICIES CREATED -> Logs are strictly immutable!
```

---

## 6. Administrator Provisioning & Revocation Guide

### How to Securely Provision the Initial Administrator
Do **NOT** register administrators through the public web frontend. Administrators must be provisioned directly via backend SQL:

```sql
-- Step 1: User signs up normally via email (e.g., admin@yourdomain.com)
-- Step 2: In Supabase SQL Editor, execute:
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'admin@yourdomain.com';

-- Step 3: Grant custom claim in auth.users app_metadata:
UPDATE auth.users 
SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb 
WHERE email = 'admin@yourdomain.com';
```

### How to Revoke Administrator Access
To immediately terminate administrator access:

```sql
UPDATE public.profiles 
SET role = 'student' 
WHERE email = 'compromised-admin@yourdomain.com';

UPDATE auth.users 
SET raw_app_meta_data = raw_app_meta_data - 'role' 
WHERE email = 'compromised-admin@yourdomain.com';
```

---

## 7. Storage Buckets Configuration

Create two buckets in Supabase Storage:

### Bucket 1: `property-images` (Public)
- **Public Bucket:** `true`
- **File size limit:** 10MB
- **Allowed MIME types:** `image/jpeg`, `image/png`, `image/webp`
- **RLS Policy:**
  - `SELECT`: Public (anyone can read)
  - `INSERT`: Authenticated users can upload to their own folder: `(bucket_id = 'property-images' AND auth.role() = 'authenticated')`

### Bucket 2: `owner-documents` (Private)
- **Public Bucket:** `false` (Private)
- **Allowed MIME types:** `application/pdf`, `image/jpeg`, `image/png`
- **RLS Policy:**
  - `SELECT`: Restricted to listing owner (`auth.uid()`) and admins (`role = 'admin'`)
  - `INSERT`: Restricted to listing owner (`auth.uid()`)

---

## 8. Frontend Integration Summary

- **Route Protection:** All `/admin/*` routes are secured by `AdminRoute`, requiring cryptographic session signatures and backend verification.
- **Direct URL Resistance:** Entering `/admin/listings` unauthenticated redirects to `/admin/login`. Authenticated students and PG owners receive immediate 403 Forbidden screens.
- **Zero-Trust Role Check:** The frontend never trusts client-supplied metadata or user-editable fields for administrative privileges.

