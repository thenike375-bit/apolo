import { describe, expect, it } from "vitest";
import { APOLLO_POSES, TEACHER_NAME } from "./avatars";

describe("teacher", () => {
  it("is only Apollo", () => {
    expect(TEACHER_NAME).toBe("Apollo");
  });
  it("has caring, thinking and nudge reactions", () => {
    expect(Object.keys(APOLLO_POSES)).toEqual(expect.arrayContaining(["caring", "thinking", "nudge"]));
  });
});
