import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/prepare")({
  server: { handlers: { POST: async () => Response.json({ error: "Illustrated preparation was retired. New films use the durable cinematic workflow." }, { status: 410 }) } },
});