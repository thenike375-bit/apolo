import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

export const analyzeLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lessonId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: lesson, error } = await supabase.from("lessons").select("*").eq("id", data.lessonId).maybeSingle();
    if (error || !lesson) throw new Error("Lesson not found");
    if (lesson.transcript.trim().length < 20) throw new Error("The lesson content is too short to analyze.");
    const { data: profile } = await supabase.from("profiles").select("language, education_level").eq("id", userId).maybeSingle();
    await supabase.from("lessons").update({ status: "processing" }).eq("id", lesson.id);
    try {
      const { analyzeLessonText } = await import("./learning.server");
      const a = await analyzeLessonText(lesson.transcript, {
        language: profile?.language ?? "en",
        level: profile?.education_level ?? "high_school",
        title: lesson.title === "Untitled lesson" ? undefined : lesson.title,
      });
      const { error: upErr } = await supabase
        .from("lessons")
        .update({
          title: lesson.title === "Untitled lesson" ? a.title : lesson.title,
          subject: a.subject,
          summary: a.summary,
          key_points: a.key_points as unknown as Json,
          topics: a.topics as unknown as Json,
          status: "ready",
        })
        .eq("id", lesson.id);
      if (upErr) throw upErr;
      return { ok: true };
    } catch (e) {
      await supabase.from("lessons").update({ status: "failed" }).eq("id", lesson.id);
      console.error(e);
      throw new Error("Could not analyze the lesson. Please try again.");
    }
  });

export const createQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ topic: z.string().min(1).max(300), lessonId: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: mems }, lessonRes] = await Promise.all([
      supabase.from("profiles").select("language, education_level").eq("id", userId).maybeSingle(),
      supabase.from("memories").select("kind, content").in("kind", ["gap", "strength"]).limit(30),
      data.lessonId
        ? supabase.from("lessons").select("summary, transcript, topics").eq("id", data.lessonId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const l = lessonRes.data;
    const context_ = l ? `${l.summary ?? ""}\n${JSON.stringify(l.topics)}\n${l.transcript}` : "";
    const { makeQuiz } = await import("./learning.server");
    let questions;
    try {
      questions = await makeQuiz({
        topic: data.topic,
        context: context_,
        language: profile?.language ?? "en",
        level: profile?.education_level ?? "high_school",
        memories: (mems ?? []).map((m) => `- [${m.kind}] ${m.content}`).join("\n"),
      });
    } catch (e) {
      console.error(e);
      throw new Error("Could not create the quiz. Please try again.");
    }
    const { data: quiz, error } = await supabase
      .from("quizzes")
      .insert({
        user_id: userId,
        topic: data.topic,
        lesson_id: data.lessonId,
        questions: questions as unknown as Json,
        total: questions.length,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: quiz.id };
  });

export const createBoardCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        topic: z.string().max(200),
        speech: z.string().min(1).max(4000),
        language: z.enum(["en", "ka", "ru"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("language")
      .eq("id", context.userId)
      .maybeSingle();
    const { makeBoardCard } = await import("./learning.server");
    return makeBoardCard({
      topic: data.topic,
      speech: data.speech,
      language: data.language ?? profile?.language ?? "en",
    });
  });

export const createExplainerVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        question: z.string().min(2).max(500),
        lessonId: z.string().uuid().nullable(),
        language: z.enum(["en", "ka", "ru"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const l = data.lessonId
      ? (await context.supabase.from("lessons").select("summary, transcript").eq("id", data.lessonId).maybeSingle()).data
      : null;
    const { makeExplainerVideo } = await import("./learning.server");
    try {
      return await makeExplainerVideo({
        question: data.question,
        context: l ? `${l.summary ?? ""}\n${l.transcript}` : "",
        language: data.language,
      });
    } catch (e) {
      console.error(e);
      throw new Error("Could not create the video. Please try again.");
    }
  });
