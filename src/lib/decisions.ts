import { z } from "zod";

/** Snapshot cadence for the OpenAI teaching-decision loop (user asked for every 3–4 s). */
export const DECISION_INTERVAL_MS = 20000;
/** Minimum gap between spoken adaptations so Apollo isn't interrupted constantly. */
export const DECISION_SPEAK_COOLDOWN_MS = 20000;

export const decisionSchema = z.object({
  action: z.enum(["continue", "check_in", "simplify", "slow_down", "encourage", "pause", "smile", "tired", "surprised", "sad"]),
  apollo_expression: z.enum(["happy", "thinking", "caring", "cheer", "listening", "nudge"]),
  observation: z.string().max(160),
});
export type TeachingDecision = z.infer<typeof decisionSchema>;

/** Speak only for a non-"continue" action, when it changed or the cooldown has passed. */
export function shouldVoiceDecision(
  next: TeachingDecision["action"],
  last: { action: string; at: number } | null,
  now: number,
) {
  if (next === "continue") return false;
  if (!last) return true;
  return now - last.at >= DECISION_SPEAK_COOLDOWN_MS;
}
