import { describe, expect, it } from "vitest";
import { preparationInput } from "./preparation-input";

describe("prepared lesson ownership", () => {
  it("ignores a caller-supplied alternative owner", () => {
    const parsed = preparationInput.parse({ lessonId: null, question: "Explain gravity", user_id: "00000000-0000-4000-8000-000000000001" });
    expect(parsed).not.toHaveProperty("user_id");
  });
});