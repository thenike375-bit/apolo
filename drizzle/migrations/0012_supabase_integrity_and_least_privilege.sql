-- Keep preparation workflow state and callback secrets server-managed.
REVOKE ALL ON TABLE public.prepared_lessons FROM anon, authenticated;
GRANT SELECT (
  id, user_id, lesson_id, question, status, stage, scenes, scene_index, completed,
  error, lease_until, created_at, updated_at, film, film_version, playback_seconds,
  video_provider
) ON TABLE public.prepared_lessons TO authenticated;
GRANT INSERT (user_id, lesson_id, question, video_provider)
  ON TABLE public.prepared_lessons TO authenticated;
GRANT UPDATE (scene_index, playback_seconds, completed, updated_at)
  ON TABLE public.prepared_lessons TO authenticated;
GRANT ALL ON TABLE public.prepared_lessons TO service_role;
REVOKE ALL ON TABLE public.preparation_control FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.retry_preparation(job_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE restarted_id uuid;
BEGIN
  UPDATE public.prepared_lessons
  SET status = 'queued', stage = 'queued', error = NULL, updated_at = pg_catalog.now()
  WHERE id = job_id AND user_id = auth.uid() AND status = 'failed'
  RETURNING id INTO restarted_id;
  RETURN restarted_id;
END;
$$;
REVOKE ALL ON FUNCTION public.retry_preparation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retry_preparation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_preparation_enqueue_failed(job_id uuid, failure_message text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE did_update boolean := false;
BEGIN
  UPDATE public.prepared_lessons
  SET status = 'failed', stage = 'failed',
      error = pg_catalog.left(COALESCE(failure_message, 'Film queue failed'), 500),
      updated_at = pg_catalog.now()
  WHERE id = job_id AND user_id = auth.uid() AND status = 'queued';
  did_update := FOUND;
  RETURN did_update;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_preparation_enqueue_failed(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_preparation_enqueue_failed(uuid, text) TO authenticated;

-- A message must belong to a thread owned by the same authenticated user.
DROP POLICY IF EXISTS "own messages" ON public.messages;
CREATE POLICY "own messages" ON public.messages FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.threads t
      WHERE t.id = messages.thread_id AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.threads t
      WHERE t.id = messages.thread_id AND t.user_id = auth.uid()
    )
  );

-- Lesson-linked threads and quizzes may only reference the learner's own lesson.
DROP POLICY IF EXISTS "own threads" ON public.threads;
CREATE POLICY "own threads" ON public.threads FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (lesson_id IS NULL OR EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = threads.lesson_id AND l.user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "own quizzes" ON public.quizzes;
CREATE POLICY "own quizzes" ON public.quizzes FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (lesson_id IS NULL OR EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = quizzes.lesson_id AND l.user_id = auth.uid()
    ))
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'threads_lesson_id_fkey'
      AND conrelid = 'public.threads'::regclass
  ) THEN
    ALTER TABLE public.threads
      ADD CONSTRAINT threads_lesson_id_fkey
      FOREIGN KEY (lesson_id) REFERENCES public.lessons(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS memories_user_created_idx ON public.memories (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS threads_user_updated_idx ON public.threads (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS lessons_user_created_idx ON public.lessons (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quizzes_user_created_idx ON public.quizzes (user_id, created_at DESC);

ALTER TABLE public.prepared_lessons
  ADD CONSTRAINT prepared_lessons_scene_index_nonnegative CHECK (scene_index >= 0),
  ADD CONSTRAINT prepared_lessons_playback_seconds_nonnegative CHECK (playback_seconds >= 0);
