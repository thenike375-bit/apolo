import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { parseScenes, clampScene, preparationColumns } from "./prepared-lesson";
import { parseFilm, clampFilmTime, filmIndexAt } from "./film";
import { preparationInput } from "./preparation-input";
import { dicts } from "./i18n";

export const prepareLesson = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => preparationInput.parse(d))
  .handler(async ({ data, context }) => {
    const { requireLtxKey } = await import("./ltx-video.server");
    requireLtxKey();
    if (data.lessonId) {
      const { data: lesson, error } = await context.supabase.from("lessons").select("id").eq("id", data.lessonId).eq("user_id", context.userId).maybeSingle();
      if (error) throw new Error(dicts.en.preparationSaveError);
      if (!lesson) throw new Error("Lesson not found");
    }
    const { data: row, error } = await context.supabase.from("prepared_lessons").insert({ user_id: context.userId, lesson_id: data.lessonId, question: data.question, video_provider: "ltx" }).select(preparationColumns).single();
    if (error) {
      console.error("Prepared lesson INSERT/RETURNING failed", { code: error.code, message: error.message });
      throw new Error(error.code === "42501" ? dicts.en.preparationAccessError : dicts.en.preparationSaveError);
    }
    try {
      // Ownership was authenticated above. Privileged access is only for the shared spending reservation.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: reserved, error: budgetError } = await supabaseAdmin.rpc("reserve_ltx_demo", { job_id: row.id });
      if (budgetError) throw budgetError;
      if (!reserved) throw new Error("The $1.25 LTX demo budget is already reserved. Watch a finished film instead.");
      const { enqueueFilm } = await import("./film-workflow.server");
      await enqueueFilm(row.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Film queue failed";
      const { error: stateError } = await context.supabase.rpc("mark_preparation_enqueue_failed", {
        job_id: row.id,
        failure_message: message,
      });
      if (stateError) console.error("Failed to mark preparation enqueue failure", stateError);
      throw error;
    }
    return row;
  });
export const saveLearningProgress = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), index: z.number().int().nonnegative(), completed: z.boolean(), seconds: z.number().nonnegative().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: lesson } = await context.supabase.from("prepared_lessons").select("scenes,film").eq("id", data.id).eq("user_id", context.userId).eq("status", "ready").maybeSingle();
    if (!lesson) throw new Error("Prepared lesson not found");
    const scenes = parseScenes(lesson.scenes);
    const film = parseFilm(lesson.film);
    const seconds = clampFilmTime(film, data.seconds ?? film[data.index]?.start ?? 0);
    const { error } = await context.supabase.from("prepared_lessons").update({ scene_index: film.length ? filmIndexAt(film, seconds) : clampScene(data.index, scenes.length), ...(film.length ? { playback_seconds: seconds } : {}), completed: data.completed, updated_at: new Date().toISOString() }).eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getFilmPlayback = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("prepared_lessons").select("film,playback_seconds").eq("id", data.id).eq("user_id", context.userId).eq("status", "ready").single();
    if (!row) throw new Error("Film is not ready");
    const clips = parseFilm(row.film);
    const signed = await Promise.all(clips.map(async clip => {
      if (!clip.path) throw new Error("This film is missing footage");
      const { data: url, error } = await context.supabase.storage.from("lesson-films").createSignedUrl(clip.path, 3600);
      if (error) throw error;
      return { ...clip, url: url.signedUrl };
    }));
    return { clips: signed, seconds: row.playback_seconds };
  });
/** Restarts a stopped film from its first unfinished clip; finished clips are reused, never re-rendered. */
export const resumeFilm = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase.from("prepared_lessons").select("video_provider").eq("id", data.id).eq("user_id", context.userId).maybeSingle();
    if (!existing) throw new Error("This film can't be resumed");
    if (existing.video_provider === "ltx") {
      const { requireLtxKey } = await import("./ltx-video.server");
      requireLtxKey();
    }
    const { data: restartedId, error } = await context.supabase.rpc("retry_preparation", { job_id: data.id });
    if (error || !restartedId) throw new Error("This film can't be resumed");
    try {
      const { enqueueFilm } = await import("./film-workflow.server");
      await enqueueFilm(restartedId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Film queue failed";
      const { error: stateError } = await context.supabase.rpc("mark_preparation_enqueue_failed", {
        job_id: restartedId,
        failure_message: message,
      });
      if (stateError) console.error("Failed to mark resumed preparation enqueue failure", stateError);
      throw error;
    }
    return { ok: true };
  });
