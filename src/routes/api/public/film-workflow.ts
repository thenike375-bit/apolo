import { createFileRoute } from "@tanstack/react-router";
async function handle(request: Request) {
  const { filmWorkflowHandler } = await import("@/lib/film-workflow.server");
  return filmWorkflowHandler()(request);
}
export const Route = createFileRoute("/api/public/film-workflow")({ server: { handlers: {
  GET: ({ request }) => handle(request), POST: ({ request }) => handle(request), PUT: ({ request }) => handle(request),
} } });