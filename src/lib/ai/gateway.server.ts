import { createOpenAI } from "@ai-sdk/openai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId } from "./run-id.server";

export const GATEWAY_URL = "https://ai.gateway.lovable.dev";
export const CHAT_MODEL = "openai/gpt-6-astra";
export const TRANSCRIBE_MODEL = "openai/gpt-transcribe";
export const TTS_MODEL = "google/gemini-3.1-flash-tts-preview";

export function requireApiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured (missing LOVABLE_API_KEY)");
  return key;
}

export function createGateway(request?: Request) {
  const apiKey = requireApiKey();
  const runIdFetch = createLovableAiGatewayRunIdFetch(request ? getLovableAiGatewayRunId(request) : undefined);
  const provider = createOpenAI({
    baseURL: `${GATEWAY_URL}/v1`,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  return { provider, runIdFetch };
}

export const reasoningOptions = {
  openai: {
    store: false,
    forceReasoning: true,
    reasoningEffort: "medium",
    reasoningSummary: "auto",
    include: ["reasoning.encrypted_content"],
  },
} as const;

export const lightReasoningOptions = {
  openai: { ...reasoningOptions.openai, reasoningEffort: "low" },
} as const;

/** Verify the bearer token on a server route and return an RLS-scoped client. */
export async function authFromRequest(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const supabase = createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { supabase, userId: data.user.id };
}

export function languageName(_code?: string | null) {
  return "English"; // app is English-only
}

export function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
