import { describe, expect, it } from "vitest";
import { classifyFrame, createCueTracker, type FaceCue } from "./face-cues";

describe("face cues", () => {
  it("reports no_face when no face is found", () => {
    expect(classifyFrame(null)).toBe("no_face");
  });
  it("detects closed eyes", () => {
    expect(classifyFrame({ eyeBlinkLeft: 0.9, eyeBlinkRight: 0.8 })).toBe("eyes_closed");
  });
  it("detects head turned away", () => {
    expect(classifyFrame({}, 45, 0)).toBe("away");
  });
  it("detects smiling and lowered brows", () => {
    expect(classifyFrame({ mouthSmileLeft: 0.7, mouthSmileRight: 0.7 })).toBe("smiling");
    expect(classifyFrame({ browDownLeft: 0.6, browDownRight: 0.6 })).toBe("brows_lowered");
  });
  it("only reports a cue after it holds", () => {
    const seen: FaceCue[] = [];
    const track = createCueTracker((c) => seen.push(c));
    track("away", 0);
    track("away", 3000);
    expect(seen).toEqual([]);
    track("away", 5000);
    track("away", 6000);
    expect(seen).toEqual(["away"]);
  });
});

import { createFocusTracker as cft, focusScore as fs } from "./face-cues";
describe("focus score", () => {
  it("is 100 when facing the screen", () => expect(fs({}, 0, 0)).toBe(100));
  it("is 0 with no face", () => expect(fs(null)).toBe(0));
  it("drops below 40 when the head is turned 45 degrees", () => expect(fs({}, 45, 0)).toBeLessThan(40));
  it("reports low only after it holds for 6 seconds", () => {
    const bands: string[] = [];
    const track = cft((b) => bands.push(b));
    track(20, 0);
    track(20, 5000);
    expect(bands).toEqual([]);
    track(20, 6000);
    expect(bands).toEqual(["low"]);
  });
});
