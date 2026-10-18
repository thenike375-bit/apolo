import {
  GATEWAY_URL,
  TRANSCRIBE_MODEL,
  TTS_MODEL,
  authFromRequest,
  jsonError,
  requireApiKey,
} from "./ai/gateway.server";
import { z } from "zod";

const MAX_AUDIO = 24 * 1024 * 1024;

/** Transcribe an uploaded recording. Streams from the gateway and returns the final text as JSON. */
export async function handleTranscribe(request: Request) {
  const auth = await authFromRequest(request);
  if (!auth) return jsonError(401, "Please sign in again.");
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "Invalid audio upload");
  }
  const file = form.get("file");
  const language = form.get("language");
  if (!(file instanceof File)) return jsonError(400, "No audio received");
  if (!file.size || file.size > MAX_AUDIO) return jsonError(400, "Recording is empty or larger than 24 MB");

  const type = file.type.startsWith("video/") ? file.type.replace("video/", "audio/") : file.type || "audio/webm";
  const upload = new File([await file.arrayBuffer()], file.name || "recording.webm", { type });
  const out = new FormData();
  out.append("model", TRANSCRIBE_MODEL);
  out.append("file", upload, upload.name);
  out.append("response_format", "json");
  out.append("stream", "true");
  if (language === "ka" || language === "en" || language === "ru") out.append("languages", language);

  const apiKey = requireApiKey();
  const res = await fetch(`${GATEWAY_URL}/v1/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: out,
    signal: request.signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    console.error("transcribe failed", res.status, text);
    return jsonError(res.status, res.status === 402 ? "AI credits are used up." : "Could not transcribe the audio.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let deltas = "";
  let final = "";
  let streamError: string | null = null;
  const consumeLine = (line: string) => {
    const t = line.trim();
    if (!t.startsWith("data:")) return;
    const data = t.slice(5).trim();
    if (!data || data === "[DONE]") return;
    try {
      const ev = JSON.parse(data);
      if (ev.type === "transcript.text.delta" && typeof ev.delta === "string") deltas += ev.delta;
      if (ev.type === "transcript.text.done" && typeof ev.text === "string") final = ev.text;
      if (ev.type === "error") streamError = ev.error?.message ?? "Transcription failed";
    } catch {
      // Ignore malformed or incomplete provider events.
    }
  };
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) consumeLine(line);
    if (streamError) {
      await reader.cancel().catch(() => {});
      return jsonError(502, streamError);
    }
  }
  buf += decoder.decode();
  if (buf.trim()) consumeLine(buf);
  if (streamError) return jsonError(502, streamError);
  return new Response(JSON.stringify({ text: (final || deltas).trim() }), {
    headers: { "content-type": "application/json" },
  });
}

/** Speak text with the teacher's voice. Returns a WAV file. */
export async function handleSpeech(request: Request) {
  const auth = await authFromRequest(request);
  if (!auth) return jsonError(401, "Please sign in again.");
  const parsed = z.object({
    text: z.string().max(20_000).optional(),
    voice: z.string().max(20).optional(),
    stream: z.boolean().optional(),
    lesson: z.boolean().optional(),
  }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Invalid speech request");
  const body = parsed.data;
  const text = (body.text ?? "").trim().slice(0, 2500);
  if (!text) return jsonError(400, "Nothing to read");
  const requestedVoice = body.voice ?? "";
  const voice = /^[A-Za-z]{2,20}$/.test(requestedVoice) ? requestedVoice : "Aoede";

  const apiKey = requireApiKey();
  const res = await fetch(`${GATEWAY_URL}/v1/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TTS_MODEL,
      contents: [{ role: "user", parts: [{ text: body.lesson ? `Read the following explanation as Apollo, an energetic, friendly teacher. Use clear, punchy sentences, brisk natural pacing and short pauses only. Do not read these directions aloud: ${text}` : `Say warmly and clearly, like a patient teacher: ${text}` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
      stream_format: body.stream ? "sse" : "audio",
    }),
    signal: request.signal,
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    console.error("tts failed", res.status, t);
    let safeMessage = "Could not generate the voice.";
    try { const error = JSON.parse(t); safeMessage = error.message ?? error.error?.message ?? safeMessage; } catch { /* do not expose raw provider bodies */ }
    return jsonError(res.status, safeMessage);
  }
  return new Response(res.body, {
    headers: { "content-type": res.headers.get("content-type") ?? (body.stream ? "text/event-stream" : "audio/wav"), "Cache-Control": "no-cache" },
  });
}
