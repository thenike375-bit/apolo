import { z } from "zod";

export const filmClipSchema = z.object({
  title: z.string(), prompt: z.string(), narration: z.string(), visible: z.string(),
  concepts: z.array(z.string()), duration: z.number(), start: z.number(),
  jobId: z.string().nullable(), path: z.string().nullable(),
});
export type FilmClip = z.infer<typeof filmClipSchema>;
export const filmStoryboardSchema = z.object({ scenes: z.array(z.object({
  title: z.string(), prompt: z.string(), narration: z.string(), visible: z.string(), concepts: z.array(z.string()),
})) });
export function parseFilm(value: unknown): FilmClip[] {
  const parsed = z.array(filmClipSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}
export function filmIndexAt(clips: FilmClip[], seconds: number) {
  const found = clips.findIndex(c => seconds >= c.start && seconds < c.start + c.duration);
  return found >= 0 ? found : Math.max(0, clips.length - 1);
}
export function clampFilmTime(clips: FilmClip[], seconds: number) {
  const last = clips.at(-1);
  return Math.max(0, Math.min(Number.isFinite(seconds) ? seconds : 0, last ? last.start + last.duration : 0));
}
export function interruptedPlayback(seconds: number) { return { playing: false, seconds }; }