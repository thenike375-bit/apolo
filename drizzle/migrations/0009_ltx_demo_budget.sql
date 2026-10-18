ALTER TABLE public.prepared_lessons ADD COLUMN video_provider text NOT NULL DEFAULT 'gateway' CHECK (video_provider IN ('gateway','ltx'));
GRANT SELECT (video_provider) ON public.prepared_lessons TO authenticated;
CREATE TABLE public.ltx_demo_reservations (
 preparation_id uuid PRIMARY KEY REFERENCES public.prepared_lessons(id),
 reserved_cents integer NOT NULL DEFAULT 120 CHECK (reserved_cents = 120),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ltx_demo_reservations TO service_role;
REVOKE ALL ON public.ltx_demo_reservations FROM anon, authenticated;
ALTER TABLE public.ltx_demo_reservations ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.ltx_clip_submissions (
 preparation_id uuid NOT NULL REFERENCES public.ltx_demo_reservations(preparation_id),
 clip_index integer NOT NULL CHECK (clip_index BETWEEN 0 AND 3),
 provider_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (preparation_id, clip_index)
);
GRANT ALL ON public.ltx_clip_submissions TO service_role;
REVOKE ALL ON public.ltx_clip_submissions FROM anon, authenticated;
ALTER TABLE public.ltx_clip_submissions ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.reserve_ltx_demo(job_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(1250040);
 IF EXISTS (SELECT 1 FROM public.ltx_demo_reservations WHERE preparation_id = job_id) THEN RETURN true; END IF;
 IF (SELECT coalesce(sum(reserved_cents),0) FROM public.ltx_demo_reservations) + 120 > 125 THEN RETURN false; END IF;
 INSERT INTO public.ltx_demo_reservations(preparation_id) VALUES(job_id);
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_ltx_demo(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ltx_demo(uuid) TO service_role;
COMMENT ON TABLE public.ltx_demo_reservations IS 'Conservative app-local USD 1.25 promotional budget; reservations are never automatically refunded. Not a provider balance.';
COMMENT ON TABLE public.ltx_clip_submissions IS 'Write before paid submission; an unresolved submission must never be automatically recreated.';