import { z } from "zod";

export type QuizQ = { question: string; options: string[]; correct_index: number; explanation: string };

const quizQuestionSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string()).min(2),
  correct_index: z.number().int().nonnegative(),
  explanation: z.string(),
}).superRefine((question, context) => {
  if (question.correct_index >= question.options.length) {
    context.addIssue({ code: "custom", path: ["correct_index"], message: "Correct answer is outside the options." });
  }
});

export function parseQuizQuestions(value: unknown): QuizQ[] | null {
  const parsed = z.array(quizQuestionSchema).min(1).safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function scoreQuiz(questions: QuizQ[], answers: number[]) {
  let score = 0;
  const missed: (QuizQ & { answered: number })[] = [];
  questions.forEach((q, i) => {
    if (answers[i] === q.correct_index) score++;
    else missed.push({ ...q, answered: answers[i] ?? -1 });
  });
  return { score, total: questions.length, missed };
}
