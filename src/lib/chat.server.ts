import { convertToModelMessages, isStepCount, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";
import {
  CHAT_MODEL,
  authFromRequest,
  createGateway,
  jsonError,
  languageName,
  reasoningOptions,
} from "./ai/gateway.server";
import { withLovableAiGatewayRunIdHeader } from "./ai/run-id.server";
import type { Json } from "@/integrations/supabase/types";

function textOf(m: UIMessage) {
  return m.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join(" ")
    .trim();
}

export async function handleChat(request: Request) {
  const auth = await authFromRequest(request);
  if (!auth) return jsonError(401, "Please sign in again.");
  const { supabase, userId } = auth;

  let body: { messages?: UIMessage[]; threadId?: string; cue?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request");
  }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const threadId = typeof body.threadId === "string" ? body.threadId : "";
  if (!threadId || messages.length === 0) return jsonError(400, "Missing conversation");

  const { data: thread } = await supabase.from("threads").select("*").eq("id", threadId).maybeSingle();
  if (!thread) return jsonError(404, "Conversation not found");

  const [{ data: profile }, { data: memories }, lessonRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("memories").select("kind, content").order("created_at", { ascending: false }).limit(60),
    thread.lesson_id
      ? supabase.from("lessons").select("title, subject, summary, key_points, topics, transcript").eq("id", thread.lesson_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const lesson = lessonRes.data;

  // Persist the newest user message before streaming.
  const last = messages[messages.length - 1]!;
  if (last.role === "user") {
    const { error } = await supabase.from("messages").insert({
      thread_id: threadId,
      user_id: userId,
      ui_id: last.id,
      role: "user",
      parts: last.parts as unknown as Json,
    });
    if (error) console.error("save user message failed", error);
    if (thread.title === "New chat" || thread.title === "ახალი საუბარი") {
      const title = textOf(last).slice(0, 60) || thread.title;
      await supabase.from("threads").update({ title, updated_at: new Date().toISOString() }).eq("id", threadId);
    }
  }

  const memoryText = (memories ?? []).map((m) => `- [${m.kind}] ${m.content}`).join("\n") || "(nothing yet)";
  const teacher = "Apollo";
  const instructions = `You are ${teacher}, the student's personal AI teacher inside PostFactum ("Your teacher. Your pace. Your potential.").
You are an AI, never claim to be human or to know feelings you cannot observe.

STUDENT PROFILE
- Name: ${profile?.display_name ?? "student"}
- Education level: ${profile?.education_level ?? "unknown"}
- Preferred learning style: ${profile?.learning_style ?? "step_by_step"}
- Subjects of interest: ${(profile?.subjects ?? []).join(", ") || "not set"}
- Reply language: ${languageName(profile?.language)} (always reply in this language unless the student writes in another one)

WHAT YOU REMEMBER ABOUT THIS STUDENT (shared across all conversations)
${memoryText}
${lesson ? `\nTHIS CONVERSATION IS ABOUT THE STUDENT'S CLASS LESSON\nTitle: ${lesson.title}\nSubject: ${lesson.subject ?? ""}\nSummary: ${lesson.summary ?? ""}\nTopics: ${JSON.stringify(lesson.topics)}\nTranscript excerpt: ${(lesson.transcript ?? "").slice(0, 6000)}\n` : ""}
TEACHING RULES
- Understanding before memorization: explain the why, build from prerequisites, use concrete examples and analogies.
- Adapt to the level and learning style above and to what you remember. If you adapt because of a memory, briefly say so, so the student can correct you.
- For homework, guide with hints and questions first; don't just hand over final answers unless the student has tried or asks for a worked example.
- Check understanding with a short question at the end of longer explanations.
- Be warm, patient and never judgmental about mistakes or slow progress.
- Use Markdown: headings for structure, lists, tables, LaTeX math with $...$ / $$...$$, and fenced code blocks.
- Pick the right method per subject (e.g. visual step-by-step derivations for math, timelines and cause/effect for history).
- Keep replies focused; ~250 words unless more is needed.

MEMORY
Use the "remember" tool whenever you learn something durable and useful about the student: a knowledge gap, a strength, a preference about how they like explanations, a goal or exam date. Don't store trivial chit-chat or sensitive personal data. Don't announce every save.${(() => {
    const cueText: Record<string, string> = {
      away: "the student's face has been turned away from the screen",
      eyes_closed: "the student's eyes have been closed for a while",
      smiling: "the student is smiling",
      brows_lowered: "the student's brows have been lowered for a few seconds",
      frowning: "the student's mouth corners have been turned down for a few seconds (they may look down or confused)",
      no_face: "no face is visible on camera",
      attending: "the student is facing the screen",
    };
    const c = typeof body.cue === "string" ? cueText[body.cue] : undefined;
    return c ? `\n\nCAMERA CUE (computed on the student's device, observable only): ${c}. If relevant, briefly check in (e.g. ask if that part was clear or if they want a break) — never assert what they feel.` : "";
  })()}`;

  const { provider, runIdFetch } = createGateway(request);
  const result = streamText({
    model: provider.responses(CHAT_MODEL),
    instructions,
    messages: await convertToModelMessages(messages, { ignoreIncompleteToolCalls: true }),
    abortSignal: request.signal,
    stopWhen: isStepCount(50),
    providerOptions: reasoningOptions,
    tools: {
      remember: tool({
        description: "Save a durable fact about the student to their shared learning memory.",
        inputSchema: z.object({
          kind: z.enum(["gap", "strength", "preference", "goal", "fact"]),
          content: z.string().describe("One short sentence, written in third person about the student."),
        }),
        execute: async ({ kind, content }) => {
          const { error } = await supabase.from("memories").insert({ user_id: userId, kind, content: content.slice(0, 400) });
          if (error) return { saved: false, error: error.message };
          return { saved: true, kind, content };
        },
      }),
    },
  });

  const response = result.toUIMessageStreamResponse({
    originalMessages: messages,
    sendReasoning: true,
    onError: (error) => {
      console.error("chat stream error", error);
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("402")) return "AI credits are used up. Please add credits to continue.";
      if (msg.includes("429")) return "The teacher is busy right now. Please try again in a moment.";
      return "Something went wrong while answering. Please try again.";
    },
    onEnd: async ({ responseMessage, isAborted }) => {
      if (!responseMessage || responseMessage.role !== "assistant") return;
      if (responseMessage.parts.length === 0) return;
      const { error } = await supabase.from("messages").insert({
        thread_id: threadId,
        user_id: userId,
        ui_id: responseMessage.id,
        role: "assistant",
        parts: responseMessage.parts as unknown as Json,
      });
      if (error) console.error("save assistant message failed", error, { isAborted });
      await supabase.from("threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
    },
  });
  return withLovableAiGatewayRunIdHeader(response, runIdFetch);
}
