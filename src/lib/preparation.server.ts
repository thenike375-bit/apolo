import type { Json } from "@/integrations/supabase/types";
import { makeExplainerVideo } from "./learning.server";
import { z } from "zod";

/** One callback, one job. Database claim prevents duplicate billed work. No automated retries. */
export async function processPreparation(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  const secret = z.string().uuid().safeParse(token);
  const body = z.object({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!secret.success || !body.success) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: job } = await db.from("prepared_lessons").select("*").eq("id", body.data.id).eq("callback_token", secret.data).maybeSingle();
  if (!job) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { data: claimed, error } = await db.rpc("claim_preparation_job", { job_id: job.id, secret: secret.data });
  if (error) return Response.json({ error: "Preparation could not start" }, { status: 500 });
  if (!claimed) return Response.json({ status: "unchanged" });
  const stage = async (value: string) => {
    const { error: e } = await db.from("prepared_lessons").update({ stage: value, updated_at: new Date().toISOString() }).eq("id", job.id);
    if (e) throw e;
  };
  try {
    const { data: lesson } = job.lesson_id ? await db.from("lessons").select("transcript,summary").eq("id", job.lesson_id).eq("user_id", job.user_id).maybeSingle() : { data: null };
    await stage("storyboard");
    const scenes = await makeExplainerVideo({ question: job.question, context: lesson ? `${lesson.summary ?? ""}\n${lesson.transcript}` : "", language: "en" });
    await stage("assembling");
    const { error: saveError } = await db.from("prepared_lessons").update({ scenes: scenes as unknown as Json, status: "ready", stage: "ready", lease_until: null, updated_at: new Date().toISOString() }).eq("id", job.id);
    if (saveError) throw saveError;
    return Response.json({ status: "ready" });
  } catch (e) {
    const err = e as { statusCode?: number; message?: string; responseBody?: string };
    const status = err.statusCode ?? 500;
    let message = err.message ?? "Preparation failed";
    if (err.responseBody) {
      try { const b = JSON.parse(err.responseBody); message = b.message ?? b.error?.message ?? message; } catch { /* preserve safe message */ }
    }
    if (status === 402 || status === 403) await db.from("preparation_control").upsert({ id: true, paused_reason: message, blocked_kind: String(status) });
    await db.from("prepared_lessons").update({ status: status === 402 || status === 403 ? "paused" : "failed", stage: "failed", error: message.slice(0, 500), lease_until: null }).eq("id", job.id);
    return Response.json({ error: message }, { status: status >= 400 && status <= 599 ? status : 500 });
  }
}