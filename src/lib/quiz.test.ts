import { describe, expect, it } from "vitest";
import { scoreQuiz } from "./quiz";

const qs = [
  { question: "a", options: ["1", "2"], correct_index: 0, explanation: "" },
  { question: "b", options: ["1", "2"], correct_index: 1, explanation: "" },
  { question: "c", options: ["1", "2"], correct_index: 1, explanation: "" },
];

describe("scoreQuiz", () => {
  it("counts correct answers and lists missed questions", () => {
    const r = scoreQuiz(qs, [0, 0, 1]);
    expect(r.score).toBe(2);
    expect(r.total).toBe(3);
    expect(r.missed.map((m) => m.question)).toEqual(["b"]);
  });
  it("treats unanswered questions as missed", () => {
    expect(scoreQuiz(qs, [0]).score).toBe(1);
  });
});
