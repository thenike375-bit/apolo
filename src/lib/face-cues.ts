// Observable face cues from MediaPipe Face Landmarker blendshapes.
// These describe what the camera sees (eyes closed, looking away, smiling, brows lowered),
// never a claim about the learner's mind. The teacher uses them only to check in.

export type FaceCue = "attending" | "away" | "eyes_closed" | "smiling" | "brows_lowered" | "frowning" | "no_face";

export const FACE_CUES: FaceCue[] = ["attending", "away", "eyes_closed", "smiling", "brows_lowered", "frowning", "no_face"];

export type Shapes = Record<string, number>;

/** Classify one frame. `yaw`/`pitch` are head angles in degrees (0 = facing screen). */
export function classifyFrame(shapes: Shapes | null, yaw = 0, pitch = 0): FaceCue {
  if (!shapes) return "no_face";
  const s = (k: string) => shapes[k] ?? 0;
  const blink = (s("eyeBlinkLeft") + s("eyeBlinkRight")) / 2;
  if (blink > 0.6) return "eyes_closed";
  const lookOut = Math.max(
    (s("eyeLookOutLeft") + s("eyeLookInRight")) / 2,
    (s("eyeLookInLeft") + s("eyeLookOutRight")) / 2,
    (s("eyeLookDownLeft") + s("eyeLookDownRight")) / 2,
  );
  if (Math.abs(yaw) > 30 || Math.abs(pitch) > 25 || lookOut > 0.6) return "away";
  if ((s("mouthSmileLeft") + s("mouthSmileRight")) / 2 > 0.5) return "smiling";
  if ((s("mouthFrownLeft") + s("mouthFrownRight")) / 2 > 0.4) return "frowning";
  if ((s("browDownLeft") + s("browDownRight")) / 2 > 0.45) return "brows_lowered";
  return "attending";
}

/** How long (ms) a cue must hold before it is reported. */
export const CUE_HOLD_MS: Record<FaceCue, number> = {
  attending: 4000,
  away: 5000,
  eyes_closed: 4000,
  smiling: 2500,
  brows_lowered: 3000,
  frowning: 3000,
  no_face: 6000,
};

/** Debounces frame cues into stable cue changes. */
export function createCueTracker(onCue: (cue: FaceCue) => void) {
  let candidate: FaceCue | null = null;
  let since = 0;
  let reported: FaceCue | null = null;
  return (cue: FaceCue, now: number) => {
    if (cue !== candidate) {
      candidate = cue;
      since = now;
      return;
    }
    if (cue !== reported && now - since >= CUE_HOLD_MS[cue]) {
      reported = cue;
      onCue(cue);
    }
  };
}

/** Head yaw/pitch (degrees) from a 4x4 column-major facial transformation matrix. */
export function headAngles(m: ArrayLike<number> | undefined): { yaw: number; pitch: number } {
  if (!m || m.length < 16) return { yaw: 0, pitch: 0 };
  const yaw = Math.asin(Math.max(-1, Math.min(1, -(m[2] ?? 0)))) * (180 / Math.PI);
  const pitch = Math.atan2(m[6] ?? 0, m[10] ?? 1) * (180 / Math.PI);
  return { yaw, pitch };
}

/** Concentration score 0–100 from observable signals (head turned, gaze off-screen, eyes closing, yawning). */
export function focusScore(shapes: Shapes | null, yaw = 0, pitch = 0): number {
  if (!shapes) return 0;
  const s = (k: string) => shapes[k] ?? 0;
  const blink = (s("eyeBlinkLeft") + s("eyeBlinkRight")) / 2;
  const lookOut = Math.max(
    (s("eyeLookOutLeft") + s("eyeLookInRight")) / 2,
    (s("eyeLookInLeft") + s("eyeLookOutRight")) / 2,
    (s("eyeLookDownLeft") + s("eyeLookDownRight")) / 2,
    (s("eyeLookUpLeft") + s("eyeLookUpRight")) / 2,
  );
  let score = 100;
  score -= Math.max(0, Math.abs(yaw) - 10) * 2.2;
  score -= Math.max(0, Math.abs(pitch) - 8) * 2.2;
  score -= Math.max(0, lookOut - 0.25) * 90;
  score -= Math.max(0, blink - 0.35) * 80;
  if (s("jawOpen") > 0.6) score -= 30;
  return Math.round(Math.max(0, Math.min(100, score)));
}

export type FocusBand = "high" | "medium" | "low";
export const focusBand = (score: number): FocusBand =>
  score >= 70 ? "high" : score >= 40 ? "medium" : "low";

/** Reports a focus band only after it holds for `holdMs`, and repeats "low" at most every `repeatMs`. */
export function createFocusTracker(onBand: (band: FocusBand) => void, holdMs = 6000, repeatMs = 25000) {
  let candidate: FocusBand | null = null;
  let since = 0;
  let reported: FocusBand | null = null;
  let reportedAt = -Infinity;
  return (score: number, now: number) => {
    const band = focusBand(score);
    if (band !== candidate) {
      candidate = band;
      since = now;
      return;
    }
    if (now - since < holdMs) return;
    const repeat = band === "low" && reported === "low" && now - reportedAt >= repeatMs;
    if (band !== reported || repeat) {
      reported = band;
      reportedAt = now;
      onBand(band);
    }
  };
}
