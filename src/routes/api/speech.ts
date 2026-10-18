import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/speech")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleSpeech } = await import("@/lib/voice.server");
        return handleSpeech(request);
      },
    },
  },
});
