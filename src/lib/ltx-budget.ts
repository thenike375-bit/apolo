// Price checked against https://docs.ltx.io/pricing on 2026-10-18.
export const LTX_MODEL = "ltx-2-3-fast";
export const LTX_DEMO_CLIPS = 4;
export const LTX_CLIP_SECONDS = 10;
export const LTX_CENTS_PER_SECOND = 3;
export const LTX_BUDGET_CENTS = 125;
export const LTX_DEMO_CENTS = LTX_DEMO_CLIPS * LTX_CLIP_SECONDS * LTX_CENTS_PER_SECOND;

export function assertLtxBudget(reservedCents: number, requestedCents = LTX_DEMO_CENTS) {
  if (!Number.isInteger(reservedCents) || reservedCents < 0 || !Number.isInteger(requestedCents) || requestedCents <= 0 || reservedCents + requestedCents > LTX_BUDGET_CENTS) {
    throw new Error("The $1.25 LTX demo budget cannot cover this request. Finished films remain available.");
  }
}

export function ltxRequestBody(prompt: string) {
  if (!prompt.trim()) throw new Error("A video prompt is required");
  return { prompt, model: LTX_MODEL, duration: LTX_CLIP_SECONDS, resolution: "1280x720", fps: 24, generate_audio: false };
}