import { describe, it, expect } from "vitest";
import { filmIndexAt, clampFilmTime, interruptedPlayback, type FilmClip } from "./film";
const clips = [{ start: 0, duration: 10 }, { start: 10, duration: 10 }] as FilmClip[];
describe("interactive educational film", () => {
  it("selects the visible scene from actual playback time", () => { expect(filmIndexAt(clips, 9.9)).toBe(0); expect(filmIndexAt(clips, 10)).toBe(1); });
  it("interrupts without losing the exact resume time", () => { expect(interruptedPlayback(14.25)).toEqual({ playing: false, seconds: 14.25 }); });
  it("never saves resume beyond the film duration", () => { expect(clampFilmTime(clips, 99)).toBe(20); expect(clampFilmTime(clips, -4)).toBe(0); });
});