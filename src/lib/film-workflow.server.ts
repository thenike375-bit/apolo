import { Inngest } from "inngest";
import { serve } from "inngest/edge";
import type { Json } from "@/integrations/supabase/types";
import { parseFilm } from "./film";
import { z } from "zod";
import { createFilmClip, pollFilmClip, videoRequest, writeFilmStoryboard, anonymizePrompt, FilmError } from "./film-generation.server";
import { createLtxClip, pollLtxClip, downloadLtxClip, requireLtxKey, LtxError } from "./ltx-video.server";
import { LTX_DEMO_CLIPS } from "./ltx-budget";

/** Durable sleeps release the worker; persisted provider ids prevent recreation on resume. */
export function filmWorkflowHandler() {
  const signingKey = process.env["INNGEST_SIGNING_KEY"];
  if (!signingKey) throw new Error("Film workflow signing is not configured");
  const client = new Inngest({ id: "postfactum-films", signingKey, isDev: false });
  // No time cap: the user wants every film to run to completion.
  const prepare = client.createFunction({ id: "prepare-cinematic-film", retries: 0, concurrency: { limit: 1 }, triggers: [{ event: "postfactum/film.prepare" }] }, async ({ event, step }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const id = z.string().uuid().parse(event.data["id"]);
    const job = await step.run("claim", async () => {
      const { data, error } = await db.from("prepared_lessons").select("*").eq("id", id).single();
      if (error || !data) throw new Error("Film job not found");
      const { data: claimed, error: claimError } = await db.rpc("claim_preparation_job", { job_id: id, secret: data.callback_token });
      if (claimError) throw claimError;
      return claimed ? data : null;
    });
    if (!job) return { status: "not_claimed" };
    const isLtx = job.video_provider === "ltx";
    const shotCount = isLtx ? LTX_DEMO_CLIPS : 12;
    const ensureActive = async () => {
      const { data, error } = await db.from("prepared_lessons").select("status").eq("id", id).maybeSingle();
      if (error) throw error;
      if (data?.status !== "preparing") throw new Error("Film preparation is no longer active");
    };
    try {
      if (isLtx) await step.run("reserve-ltx-budget", async () => {
        requireLtxKey();
        const { data: reserved, error } = await db.rpc("reserve_ltx_demo", { job_id: id });
        if (error) throw error;
        if (!reserved) throw new LtxError(402, "The $1.25 LTX demo budget is already reserved. Finished films remain available.");
      });
      let clips = await step.run("storyboard", async () => {
        await ensureActive();
        const { data: source } = job.lesson_id ? await db.from("lessons").select("transcript,summary").eq("id", job.lesson_id).eq("user_id", job.user_id).maybeSingle() : { data: null };
        const existing = parseFilm(job.film);
        if (existing.length === shotCount) {
          // Resume: keep finished clips (already paid for), clean only unfinished prompts.
          const film = isLtx ? existing : await Promise.all(existing.map(async c => c.path ? c : { ...c, prompt: await anonymizePrompt(c.prompt) }));
          await db.from("prepared_lessons").update({ film: film as unknown as Json, stage: "generating" }).eq("id", id);
          return film;
        }
        await db.from("prepared_lessons").update({ stage: "storyboard" }).eq("id", id);
        const film = await writeFilmStoryboard(job.question, source ? `${source.summary ?? ""}\n${source.transcript}` : "", shotCount);
        await ensureActive();
        const { error } = await db.from("prepared_lessons").update({ film: film as unknown as Json, film_version: 1, stage: "generating" }).eq("id", id);
        if (error) throw error;
        return film;
      });
      for (let index = 0; index < clips.length; index++) {
        const clip = clips[index];
        if (!clip) throw new Error("Missing film shot");
        if (clip.path) continue;
        const provider = await step.run(`create-${index}`, async () => {
          await ensureActive();
          const { data: latest } = await db.from("prepared_lessons").select("film").eq("id", id).single();
          const saved = parseFilm(latest?.film)[index];
          if (isLtx) {
            const { data: submitted, error: readError } = await db.from("ltx_clip_submissions").select("provider_id").eq("preparation_id", id).eq("clip_index", index).maybeSingle();
            if (readError) throw readError;
            const priorId = saved?.jobId ?? submitted?.provider_id;
            if (priorId) {
              const prior = await pollLtxClip(priorId);
              if (prior.status === "failed") throw new LtxError(prior.error?.type === "insufficient_funds_error" ? 402 : 422, prior.error?.message ?? "LTX generation failed", prior.error?.type);
              return { id: priorId };
            }
            if (submitted) throw new LtxError(409, "A previous LTX submission has an unknown outcome. Check the LTX console; it will not be submitted again.");
            const { error: intentError } = await db.from("ltx_clip_submissions").insert({ preparation_id: id, clip_index: index });
            if (intentError) throw new LtxError(409, "This LTX clip has already been submitted or reserved; no duplicate was created.");
            const result = await createLtxClip(clip.prompt);
            const { error: receiptError } = await db.from("ltx_clip_submissions").update({ provider_id: result.id }).eq("preparation_id", id).eq("clip_index", index);
            if (receiptError) throw receiptError;
            clips[index] = { ...clip, jobId: result.id };
            const { error: saveError } = await db.from("prepared_lessons").update({ film: clips as unknown as Json, stage: `generating_${index + 1}_${clips.length}` }).eq("id", id);
            if (saveError) throw saveError;
            return result;
          }
          if (saved?.jobId) {
            const prior = await pollFilmClip(saved.jobId);
            if (prior.status !== "failed") return prior;
          }
          const { data: control } = await db.from("preparation_control").select("paused_reason").eq("id", true).single();
          if (control?.paused_reason) throw new FilmError(403, control.paused_reason);
          const result = await createFilmClip(clip.prompt);
          clips[index] = { ...clip, jobId: result.id };
          const { error } = await db.from("prepared_lessons").update({ film: clips as unknown as Json, stage: `generating_${index + 1}_${clips.length}` }).eq("id", id);
          if (error) throw error;
          return result;
        });
        let done = false;
        for (let poll = 0; poll < 90; poll++) {
          await step.sleep(`wait-${index}-${poll}`, "10s");
          const status = await step.run(`poll-${index}-${poll}`, async () => {
            await ensureActive();
            if (!isLtx) return { ...await pollFilmClip(provider.id), videoUrl: "" };
            const value = await pollLtxClip(provider.id);
            return { id: value.id, status: value.status, seconds: "10", videoUrl: value.result?.video_url ?? "", error: value.error ? { message: value.error.message, code: value.error.type } : undefined };
          });
          if (status.status === "failed") {
            if (isLtx) throw new LtxError(status.error?.code === "insufficient_funds_error" ? 402 : 422, status.error?.message ?? "LTX generation failed", status.error?.code);
            throw new FilmError(400, status.error?.message ?? "Video generation failed", status.error?.code ?? "");
          }
          if (status.status === "completed") {
            const stored = await step.run(`store-${index}`, async () => {
              await ensureActive();
              const path = `${job.user_id}/${id}/${index}.mp4`;
              if (isLtx && !status.videoUrl) throw new Error("LTX completed without a download URL; no replacement will be generated.");
              const response = isLtx ? await downloadLtxClip(status.videoUrl) : await videoRequest(`/${encodeURIComponent(provider.id)}/content`);
              const bytes = await response.arrayBuffer();
              await ensureActive();
              const { error } = await db.storage.from("lesson-films").upload(path, bytes, { contentType: "video/mp4", upsert: true });
              if (error) throw error;
              return { path, duration: Number(status.seconds) || 10 };
            });
            clips[index] = { ...clip, jobId: provider.id, path: stored.path, duration: stored.duration };
            await step.run(`checkpoint-${index}`, async () => {
              let start = 0;
              clips = clips.map(c => { const next = { ...c, start }; start += c.duration; return next; });
              const { error } = await db.from("prepared_lessons").update({ film: clips as unknown as Json, updated_at: new Date().toISOString() }).eq("id", id);
              if (error) throw error;
            });
            done = true;
            break;
          }
        }
        if (!done) throw new Error("Video is still processing after 15 minutes; preparation stopped without resubmitting footage.");
      }
      await step.run("ready", async () => {
        await ensureActive();
        const { error } = await db.from("prepared_lessons").update({ status: "ready", stage: "ready", lease_until: null }).eq("id", id).eq("status", "preparing");
        if (error) throw error;
      });
      return { status: "ready" };
    } catch (error) {
      await step.run("record-failure", async () => {
        const cause = error as { status?: number; cause?: { status?: number; message?: string }; message?: string };
        const status = error instanceof FilmError || error instanceof LtxError ? error.status : cause.cause?.status ?? cause.status ?? 500;
        const message = error instanceof Error ? error.message : "Film preparation failed";
        if (!isLtx && (status === 402 || status === 403)) await db.from("preparation_control").upsert({ id: true, paused_reason: message, blocked_kind: String(status) });
        await db.from("prepared_lessons").update({ status: status === 402 || status === 403 ? "paused" : "failed", stage: "failed", error: message.slice(0, 500), lease_until: null }).eq("id", id).in("status", ["queued", "preparing"]);
      });
      return { status: "stopped" };
    }
  });
  return serve({ client, functions: [prepare] });
}

export async function enqueueFilm(id: string) {
  const key = process.env["INNGEST_API_KEY"];
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!key || !lovableKey) throw new Error("Connect Inngest to prepare films after closing the app.");
  const response = await fetch("https://connector-gateway.lovable.dev/inngest/e/", { method: "POST", headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ id, name: "postfactum/film.prepare", data: { id } }) });
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(error?.message ?? `Film queue failed (${response.status})`);
  }
}