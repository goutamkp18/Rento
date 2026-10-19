-- ==============================================================================
-- RENTO — QUICK FIX: ALLOW ADMIN CONSOLE TO VIEW ALL PAYMENT REQUESTS
-- Run this query in Supabase Dashboard -> SQL Editor -> Run
-- ==============================================================================

-- 1. Enable RLS and grant application access
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_audit_events ENABLE ROW LEVEL SECURITY;

-- 2. Update payment_requests policies to allow admin console and students
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

-- 3. Update student_subscriptions policies
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

-- 4. Update audit events policies
DROP POLICY IF EXISTS "Admins can view audit events" ON public.payment_audit_events;
DROP POLICY IF EXISTS "Allow select audit events" ON public.payment_audit_events;
CREATE POLICY "Allow select audit events" ON public.payment_audit_events
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "System can insert audit events" ON public.payment_audit_events;
DROP POLICY IF EXISTS "Allow insert audit events" ON public.payment_audit_events;
CREATE POLICY "Allow insert audit events" ON public.payment_audit_events
  FOR INSERT WITH CHECK (true);

-- 5. Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
