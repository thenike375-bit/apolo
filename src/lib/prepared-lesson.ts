import { z } from "zod";

export const modelIds = ["ship", "iceberg", "person", "soldier", "tree", "rocket", "planet", "atom", "cell", "building", "car", "airplane", "water", "sun", "gear"] as const;
export const preparedSceneSchema = z.object({
  narration: z.string(),
  card: z.object({
    title: z.string(), points: z.array(z.string()), formula: z.string(), diagram: z.array(z.string()), analogy: z.string(),
    scene: z.object({
      setting: z.enum(["ocean", "battlefield", "city", "space", "nature", "lab", "night", "desert"]),
      props: z.array(z.object({ emoji: z.enum(modelIds), motion: z.enum(["sail", "fly", "drift", "sink", "roll", "still"]) })),
      caption: z.string(),
      actors: z.array(z.object({ emoji: z.enum(modelIds), label: z.string(), side: z.enum(["left", "right"]), action: z.enum(["march", "jump", "shake", "bounce", "fall", "wave"]), says: z.string() })),
      clash: z.boolean(),
      shot: z.enum(["wide", "collision", "cutaway", "sinking", "close"]),
    }),
  }),
});
export type PreparedScene = z.infer<typeof preparedSceneSchema>;
export const storyboardSchema = z.object({ scenes: z.array(preparedSceneSchema) });
export function parseScenes(value: unknown): PreparedScene[] {
  const parsed = z.array(preparedSceneSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}
export function clampScene(index: number, count: number) { return Math.max(0, Math.min(count - 1, Math.floor(index))) || 0; }
export function initialPlayback() { return { playing: false, index: 0 }; }
export function sceneFromSpeech(text: string, scenes: PreparedScene[], current: number): number {
  const match = Array.from(text.matchAll(/(?:scene|chapter|part)\s+(\d+)/gi)).at(-1);
  if (!match?.[1]) return current;
  const index = Number(match[1]) - 1;
  return index >= 0 && index < scenes.length ? index : current;
}
export const preparationColumns = "id,user_id,lesson_id,question,status,stage,scenes,scene_index,completed,error,created_at,updated_at,film,film_version,playback_seconds" as const;