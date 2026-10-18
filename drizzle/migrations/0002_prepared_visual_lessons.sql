CREATE TABLE public.prepared_lessons (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 lesson_id uuid REFERENCES public.lessons(id) ON DELETE CASCADE,
 question text NOT NULL,
 status text NOT NULL DEFAULT 'queued',
 stage text NOT NULL DEFAULT 'queued',
 scenes jsonb NOT NULL DEFAULT '[]'::jsonb,
 scene_index integer NOT NULL DEFAULT 0,
 completed boolean NOT NULL DEFAULT false,
 error text,
 lease_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prepared_lessons TO authenticated;
GRANT ALL ON public.prepared_lessons TO service_role;
ALTER TABLE public.prepared_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Learners read own preparations" ON public.prepared_lessons FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Learners create own preparations" ON public.prepared_lessons FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND (lesson_id IS NULL OR EXISTS (SELECT 1 FROM public.lessons l WHERE l.id=lesson_id AND l.user_id=auth.uid())));
CREATE POLICY "Learners update own preparations" ON public.prepared_lessons FOR UPDATE TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid() AND (lesson_id IS NULL OR EXISTS (SELECT 1 FROM public.lessons l WHERE l.id=lesson_id AND l.user_id=auth.uid())));
CREATE POLICY "Learners delete own preparations" ON public.prepared_lessons FOR DELETE TO authenticated USING (user_id=auth.uid());
CREATE INDEX prepared_lessons_user_created ON public.prepared_lessons(user_id, created_at DESC);
CREATE TABLE public.preparation_control (id boolean PRIMARY KEY DEFAULT true, paused_reason text, blocked_kind text, lease_until timestamptz);
GRANT ALL ON public.preparation_control TO service_role;
ALTER TABLE public.preparation_control ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.claim_preparation() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE job uuid;
BEGIN
 INSERT INTO public.preparation_control(id) VALUES(true) ON CONFLICT DO NOTHING;
 UPDATE public.preparation_control SET lease_until=now()+interval '10 minutes' WHERE id=true AND paused_reason IS NULL AND (lease_until IS NULL OR lease_until<now());
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT id INTO job FROM public.prepared_lessons WHERE status='queued' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF job IS NULL THEN UPDATE public.preparation_control SET lease_until=NULL WHERE id=true; RETURN NULL; END IF;
 UPDATE public.prepared_lessons SET status='preparing',stage='reading',lease_until=now()+interval '10 minutes',updated_at=now() WHERE id=job;
 RETURN job;
END $$;
REVOKE ALL ON FUNCTION public.claim_preparation() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_preparation() TO service_role;