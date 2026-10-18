-- The durable Inngest workflow owns new preparation jobs; retire no-op legacy triggers.
DROP TRIGGER IF EXISTS retry_visual_preparation ON public.prepared_lessons;
DROP TRIGGER IF EXISTS wake_visual_preparation ON public.prepared_lessons;
DROP FUNCTION IF EXISTS public.wake_preparation();
DROP FUNCTION IF EXISTS public.claim_preparation();

-- This trigger function is invoked only by the auth.users trigger, never through RPC.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
