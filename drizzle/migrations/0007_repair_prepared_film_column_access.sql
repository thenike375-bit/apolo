GRANT USAGE ON SCHEMA public TO authenticated, service_role;
REVOKE ALL ON TABLE public.prepared_lessons FROM anon;
GRANT SELECT (film, film_version, playback_seconds) ON public.prepared_lessons TO authenticated;
GRANT ALL ON TABLE public.prepared_lessons TO service_role;
COMMENT ON COLUMN public.prepared_lessons.callback_token IS 'Server-only preparation claim secret; intentionally excluded from authenticated SELECT grants.';