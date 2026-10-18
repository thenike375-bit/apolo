ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_avatar_id_valid;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_id_valid CHECK (avatar_id = ANY (ARRAY['apollo','nova','atlas','lyra','orion','custom']));
ALTER TABLE public.profiles ALTER COLUMN avatar_id SET DEFAULT 'apollo';
ALTER TABLE public.profiles ALTER COLUMN teacher_name SET DEFAULT 'Apollo';
ALTER TABLE public.profiles ALTER COLUMN teacher_voice SET DEFAULT 'Aoede';