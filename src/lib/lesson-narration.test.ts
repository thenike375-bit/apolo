import { describe, expect, it } from "vitest";
import { narrationChunks, narrationForCard } from "./lesson-narration";
import { decodeSpeechPCM } from "./lesson-speech";

describe("lesson narration", () => {
  it("reads the complete explanation, not truncated board bullets", () => {
    const text = "DNA stores the instructions. Genes are sections of DNA that carry instructions for proteins.";
    expect(narrationForCard({ title: "DNA", points: ["DNA stores…"], formula: "", diagram: [], analogy: "", scene: { setting: "lab", props: [], caption: "", actors: [], clash: false }, narration: text })).toBe(text);
  });
  it("keeps every word when narration exceeds one speech request", () => {
    const text = Array.from({ length: 900 }, (_, i) => `gene${i}`).join(" ");
    const chunks = narrationChunks(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(chunk => chunk.length <= 2300)).toBe(true);
    expect(chunks.join(" ")).toBe(text);
  });
  it("carries split PCM samples between audio events", () => {
    const first = decodeSpeechPCM(new Uint8Array(0), new Uint8Array([0, 64, 0]));
    expect(first.samples[0]).toBe(0.5);
    const second = decodeSpeechPCM(first.pending, new Uint8Array([192]));
    expect(second.samples[0]).toBe(-0.5);
    expect(second.pending.length).toBe(0);
  });
});