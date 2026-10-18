import { describe, expect, it } from "vitest";
import { assertPreparationBudget, preparationDeadline } from "./preparation-budget";

describe("film preparation deadline", () => {
  const created = "2026-10-17T22:34:00.000Z";
  it("allows preparation before the maximum 20 minutes", () => {
    expect(preparationDeadline(created)).toBe(Date.parse("2026-10-17T22:54:00.000Z"));
    expect(() => assertPreparationBudget(created, Date.parse("2026-10-17T22:53:59.999Z"))).not.toThrow();
  });
  it("stops exactly at 20 minutes including queue time", () => {
    expect(() => assertPreparationBudget(created, Date.parse("2026-10-17T22:54:00.000Z"))).toThrow("20-minute limit");
  });
});