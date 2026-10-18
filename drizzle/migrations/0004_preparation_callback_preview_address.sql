CREATE OR REPLACE FUNCTION public.wake_preparation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
BEGIN
 IF NEW.status='queued' THEN
 PERFORM net.http_post(url:='https://id-preview--98c36b18-eb09-49e5-9912-97f14236efd1.lovable.app/api/public/prepare',body:=jsonb_build_object('id',NEW.id),headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||NEW.callback_token::text),timeout_milliseconds:=120000);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER retry_visual_preparation AFTER UPDATE OF status ON public.prepared_lessons FOR EACH ROW WHEN (NEW.status='queued' AND OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION public.wake_preparation();