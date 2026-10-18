INSERT INTO public.profiles (id, display_name)
SELECT
  id,
  COALESCE(
    raw_user_meta_data->>'full_name',
    raw_user_meta_data->>'name',
    split_part(email, '@', 1)
  )
FROM auth.users
ON CONFLICT (id) DO NOTHING;
