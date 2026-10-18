import { authHeader } from "@/hooks/use-auth";

export function stripMarkdown(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, " (code example) ")
    .replace(/\$\$[\s\S]*?\$\$/g, " (formula) ")
    .replace(/[#*_`>|~]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

let current: HTMLAudioElement | null = null;
let currentAbort: AbortController | null = null;
let currentUrl: string | null = null;

export function stopSpeaking() {
  currentAbort?.abort();
  currentAbort = null;
  if (current) {
    current.onended = null;
    current.onerror = null;
    current.pause();
    current = null;
  }
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = null;
}

export async function speak(text: string, voice: string, onEnd?: () => void) {
  stopSpeaking();
  const ac = new AbortController();
  currentAbort = ac;
  const res = await fetch("/api/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ text: stripMarkdown(text).slice(0, 2500), voice }),
    signal: ac.signal,
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? "Voice unavailable");
  }
  const blob = await res.blob();
  if (ac.signal.aborted) return;
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  current = audio;
  currentUrl = url;
  const cleanup = () => {
    URL.revokeObjectURL(url);
    if (current === audio) {
      current = null;
      currentUrl = null;
    }
  };
  audio.onended = () => {
    cleanup();
    onEnd?.();
  };
  audio.onerror = cleanup;
  try {
    await audio.play();
  } catch (error) {
    cleanup();
    throw error;
  }
}

export async function transcribeBlob(blob: Blob, language?: string): Promise<string> {
  const fd = new FormData();
  const type = blob.type.replace("video/", "audio/") || "audio/webm";
  const ext = type.includes("wav") ? "wav" : type.includes("mpeg") || type.includes("mp3") ? "mp3" : type.includes("mp4") || type.includes("m4a") ? "m4a" : "webm";
  fd.append("file", new File([blob], `recording.${ext}`, { type }));
  if (language) fd.append("language", language);
  const res = await fetch("/api/transcribe", { method: "POST", headers: await authHeader(), body: fd });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? "Transcription failed");
  return j.text ?? "";
}

export class Recorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private cancelled = false;

  private stopTracks() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  async start() {
    this.cancelled = false;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (this.cancelled) {
      stream.getTracks().forEach((track) => track.stop());
      throw new DOMException("Recording was cancelled.", "AbortError");
    }
    this.stream = stream;
    try {
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      this.rec = recorder;
      this.chunks = [];
      recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
      recorder.start(1000);
    } catch (error) {
      this.rec = null;
      this.stopTracks();
      throw error;
    }
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      const recorder = this.rec;
      if (!recorder) return resolve(new Blob());
      const finish = () => {
        this.stopTracks();
        if (this.rec === recorder) this.rec = null;
        resolve(new Blob(this.chunks, { type: recorder.mimeType || "audio/webm" }));
      };
      if (recorder.state === "inactive") return finish();
      recorder.onstop = finish;
      try {
        recorder.stop();
      } catch {
        finish();
      }
    });
  }

  abort() {
    this.cancelled = true;
    const recorder = this.rec;
    this.rec = null;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        // The stream is stopped below even if the recorder has already ended.
      }
    }
    this.stopTracks();
    this.chunks = [];
  }
}
