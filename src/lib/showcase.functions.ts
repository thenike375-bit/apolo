import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseFilm } from "./film";

/** Fixed hackathon showcase films; only these rows are exposed to signed-in viewers. */
export const JUDGE_EXAMPLE_IDS = [
  "a437b1dc-cdf7-4282-b17a-37692aefab3a",
  "56ed52f9-474c-4bef-9d1b-4023d2f78404",
  "fd721eff-e210-4b18-9315-03f7f7cc1a9e",
] as const;

export const getJudgeExamples = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    // Caller is signed in; admin read is limited to the fixed showcase IDs and safe columns.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("prepared_lessons")
      .select("id,lesson_id,question,film,created_at,updated_at,status")
      .in("id", [...JUDGE_EXAMPLE_IDS]);
    if (error) throw new Error("Examples could not be loaded");
    const out = [];
    for (const id of JUDGE_EXAMPLE_IDS) {
      const row = rows?.find((r) => r.id === id);
      if (!row || row.status !== "ready") continue;
      const { data: lesson } = row.lesson_id
        ? await supabaseAdmin.from("lessons").select("title,subject,transcript").eq("id", row.lesson_id).maybeSingle()
        : { data: null };
      const clips = await Promise.all(parseFilm(row.film).filter((c) => c.path).map(async (c) => {
        const { data: s } = await supabaseAdmin.storage.from("lesson-films").createSignedUrl(c.path!, 3600);
        return { title: c.title, url: s?.signedUrl ?? "" };
      }));
      out.push({
        id: row.id,
        title: lesson?.title ?? row.question,
        subject: lesson?.subject ?? null,
        question: row.question,
        transcript: lesson?.transcript ?? "",
        prepMs: new Date(row.updated_at).getTime() - new Date(row.created_at).getTime(),
        clips: clips.filter((c) => c.url),
      });
    }
    return out;
  });
