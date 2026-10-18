import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleTranscribe } = await import("@/lib/voice.server");
        return handleTranscribe(request);
      },
    },
  },
});
