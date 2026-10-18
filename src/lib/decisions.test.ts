import { describe, expect, it } from "vitest";
import { DECISION_INTERVAL_MS, shouldVoiceDecision } from "./decisions";

describe("teaching decisions", () => {
  it("snapshots every 20 seconds", () => {
    expect(DECISION_INTERVAL_MS).toBe(20000);
  });
  it("never interrupts for continue", () => {
    expect(shouldVoiceDecision("continue", null, 0)).toBe(false);
  });
  it("waits 20s between spoken adaptations", () => {
    const last = { action: "simplify", at: 0 };
    expect(shouldVoiceDecision("check_in", last, 10000)).toBe(false);
    expect(shouldVoiceDecision("check_in", last, 20000)).toBe(true);
  });
});
