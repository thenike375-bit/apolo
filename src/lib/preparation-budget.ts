export const PREPARATION_LIMIT_MS = 20 * 60 * 1000;
export const PREPARATION_TIMEOUT_MESSAGE = "Preparation stopped at the 20-minute limit. The film is not complete; no clips were resubmitted.";

export function preparationDeadline(createdAt: string) {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) throw new Error("Invalid preparation start time");
  return created + PREPARATION_LIMIT_MS;
}
export function assertPreparationBudget(createdAt: string, now = Date.now()) {
  if (now >= preparationDeadline(createdAt)) throw new Error(PREPARATION_TIMEOUT_MESSAGE);
}