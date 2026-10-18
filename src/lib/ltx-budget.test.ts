import { describe, expect, it } from "vitest";
import { assertLtxBudget, LTX_DEMO_CENTS, ltxRequestBody } from "./ltx-budget";

describe("LTX promotional demo", () => {
  it("reserves $1.20 for four ten-second clips", () => {
    expect(LTX_DEMO_CENTS).toBe(120);
    expect(() => assertLtxBudget(0)).not.toThrow();
  });
  it("never exceeds the user's $1.25 budget", () => {
    expect(() => assertLtxBudget(5)).not.toThrow();
    expect(() => assertLtxBudget(6)).toThrow("$1.25");
    expect(() => assertLtxBudget(120)).toThrow("$1.25");
    expect(() => assertLtxBudget(0, 360)).toThrow("$1.25");
  });
  it("uses explicit 720p ten-second silent video, not automatic duration", () => {
    expect(ltxRequestBody("DNA replication")).toEqual({ prompt: "DNA replication", model: "ltx-2-3-fast", duration: 10, resolution: "1280x720", fps: 24, generate_audio: false });
  });
});