import { describe, expect, it } from "vitest";
import { initialPlayback, clampScene, sceneFromSpeech } from "./prepared-lesson";
describe("prepared learning rules", () => {
  it("never plays automatically when prepared", () => { expect(initialPlayback().playing).toBe(false); });
  it("keeps resume progress within the prepared scenes", () => { expect(clampScene(99, 6)).toBe(5); expect(clampScene(-2, 6)).toBe(0); });
  it("changes visuals only on a valid spoken scene marker", () => {
    const scenes = Array.from({length:6},()=>({})) as Parameters<typeof sceneFromSpeech>[1];
    expect(sceneFromSpeech("Scene 3. Water enters.",scenes,0)).toBe(2);
    expect(sceneFromSpeech("Scene 1. Introduction. Scene 3. Water enters.",scenes,0)).toBe(2);
    expect(sceneFromSpeech("Scene 99.",scenes,2)).toBe(2);
    expect(sceneFromSpeech("Let me answer your question",scenes,2)).toBe(2);
  });
});