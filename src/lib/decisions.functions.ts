import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { decisionSchema } from "./decisions";

const input = z.object({
  image: z.string().startsWith("data:image/jpeg;base64,").max(200_000),
  topic: z.string().max(200).optional(),
});

/** OpenAI vision "decision engine": one webcam snapshot in, one teaching decision out. */
export const decideTeaching = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data }) => {
    const { generateText, Output } = await import("ai");
    const { createGateway } = await import("./ai/gateway.server");
    const { provider } = createGateway();
    try {
      const { output } = await generateText({
        model: provider.chat("openai/gpt-5-mini"),
        output: Output.object({ schema: decisionSchema }),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You help Apollo, a friendly AI teacher, react to the learner's facial expression in a live video lesson. Look closely at the webcam snapshot and describe the visible expression in a short phrase (e.g. 'big smile', 'yawning', 'furrowed brows', 'eyes wide, mouth open', 'mouth corners down', 'looking away'). Never comment on appearance, identity or surroundings. Choose: smile (smiling, grinning or laughing → expression 'cheer'), simplify (puzzled: furrowed brows, squinting, head tilt, hand on forehead/chin → 'caring'), tired (yawning, heavy eyelids, head resting on hand → 'caring'), surprised (eyes wide, raised brows, open mouth → 'happy'), sad (mouth corners down, downcast look → 'caring'), check_in (looking away or not visible → 'nudge'), slow_down, encourage, pause, or continue (only for a neutral, relaxed face). Prefer a specific expression action whenever one is visible. Lesson topic: ${data.topic || "unspecified"}.`,
              },
              { type: "image", image: data.image },
            ],
          },
        ],
      });
      return output;
    } catch (e) {
      console.error("decision failed", e);
      return null;
    }
  });
