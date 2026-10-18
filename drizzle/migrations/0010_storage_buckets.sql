INSERT INTO storage.buckets (id, name, public)
VALUES
  ('teacher-avatars', 'teacher-avatars', false),
  ('lesson-films', 'lesson-films', false)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;
