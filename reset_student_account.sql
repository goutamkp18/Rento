-- ==============================================================================
-- RENTO — RESET STUDENT ACCOUNT & PERMIT DELETES
-- File: reset_student_account.sql
-- Run this in Supabase Dashboard -> SQL Editor -> Run
-- ==============================================================================

-- 1. Ensure DELETE policies exist so records can be cleared when resetting
DROP POLICY IF EXISTS "Allow delete payment requests" ON public.payment_requests;
CREATE POLICY "Allow delete payment requests" ON public.payment_requests
  FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow delete student subscriptions" ON public.student_subscriptions;
CREATE POLICY "Allow delete student subscriptions" ON public.student_subscriptions
  FOR DELETE USING (true);

-- 2. Cleanly reset student gangadharkp.dev@gmail.com to a fresh account
DELETE FROM public.student_subscriptions 
WHERE student_id IN (SELECT id FROM public.profiles WHERE email = 'gangadharkp.dev@gmail.com');

DELETE FROM public.payment_requests 
WHERE user_id IN (SELECT id FROM public.profiles WHERE email = 'gangadharkp.dev@gmail.com');

-- 3. Reload schema cache
NOTIFY pgrst, 'reload schema';
