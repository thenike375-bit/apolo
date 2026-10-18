CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
ALTER TABLE public.prepared_lessons ADD COLUMN callback_token uuid NOT NULL DEFAULT gen_random_uuid();
REVOKE SELECT ON public.prepared_lessons FROM authenticated;
GRANT SELECT(id,user_id,lesson_id,question,status,stage,scenes,scene_index,completed,error,lease_until,created_at,updated_at) ON public.prepared_lessons TO authenticated;
CREATE FUNCTION public.claim_preparation_job(job_id uuid, secret uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.preparation_control(id) VALUES(true) ON CONFLICT DO NOTHING;
 IF EXISTS(SELECT 1 FROM public.preparation_control WHERE id=true AND paused_reason IS NOT NULL) THEN RETURN false; END IF;
 UPDATE public.prepared_lessons SET status='preparing',stage='reading',lease_until=now()+interval '10 minutes',updated_at=now() WHERE id=job_id AND callback_token=secret AND status='queued';
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.claim_preparation_job(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_preparation_job(uuid,uuid) TO service_role;
CREATE FUNCTION public.wake_preparation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
BEGIN
 IF NEW.status='queued' THEN
 PERFORM net.http_post(url:='https://project--98c36b18-eb09-49e5-9912-97f14236efd1-dev.lovable.app/api/public/prepare',body:=jsonb_build_object('id',NEW.id),headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||NEW.callback_token::text),timeout_milliseconds:=120000);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.wake_preparation() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER wake_visual_preparation AFTER INSERT ON public.prepared_lessons FOR EACH ROW EXECUTE FUNCTION public.wake_preparation();