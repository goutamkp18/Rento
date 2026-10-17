-- ==============================================================================
-- RENTO: ENABLE PERMANENT DELETE POLICIES IN SUPABASE
-- Run this in your Supabase SQL Editor: Dashboard -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. PG LISTINGS: Allow delete operations
DROP POLICY IF EXISTS "Owners can delete own listings" ON public.pg_listings;
DROP POLICY IF EXISTS "Allow delete listings" ON public.pg_listings;
CREATE POLICY "Allow delete listings" ON public.pg_listings FOR DELETE USING (true);

-- 2. ROOMS: Allow manage (select, insert, update, delete)
DROP POLICY IF EXISTS "Allow manage rooms" ON public.rooms;
CREATE POLICY "Allow manage rooms" ON public.rooms FOR ALL USING (true);

-- 3. LISTING IMAGES: Allow manage (select, insert, update, delete)
DROP POLICY IF EXISTS "Allow manage listing images" ON public.listing_images;
CREATE POLICY "Allow manage listing images" ON public.listing_images FOR ALL USING (true);

-- 4. ENQUIRIES: Allow delete operations
DROP POLICY IF EXISTS "Allow delete enquiries" ON public.enquiries;
CREATE POLICY "Allow delete enquiries" ON public.enquiries FOR DELETE USING (true);

-- 5. FAVOURITES: Allow delete operations
DROP POLICY IF EXISTS "Allow delete favourites" ON public.favourites;
CREATE POLICY "Allow delete favourites" ON public.favourites FOR DELETE USING (true);

-- 6. STORAGE BUCKET: Allow delete of property images from property-images bucket
DROP POLICY IF EXISTS "Owners can delete own property images" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete property-images" ON storage.objects;
CREATE POLICY "Allow delete property-images" ON storage.objects FOR DELETE USING (bucket_id = 'property-images');
