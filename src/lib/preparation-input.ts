import { z } from "zod";

// Ownership is deliberately absent: only verified auth middleware supplies it.
export const preparationInput = z.object({
  lessonId: z.string().uuid().nullable(),
  question: z.string().trim().min(2).max(500),
});