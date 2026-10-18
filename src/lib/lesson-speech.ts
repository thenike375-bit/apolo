import { createParser } from "eventsource-parser";
import { authHeader } from "@/hooks/use-auth";
import { narrationChunks } from "./lesson-narration";

export function decodeSpeechPCM(pending: Uint8Array, incoming: Uint8Array) {
  const bytes = new Uint8Array(pending.length + incoming.length);
  bytes.set(pending); bytes.set(incoming, pending.length);
  const usable = bytes.length - bytes.length % 2;
  const view = new DataView(bytes.buffer);
  const samples = new Float32Array(usable / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
  return { samples, pending: bytes.slice(usable) };
}

/** One page-owned player: pause keeps its cursor; replay reuses completed audio. */
export class LessonSpeech {
  private context = new AudioContext({ sampleRate: 24000 });
  private controller = new AbortController();
  private sources = new Set<AudioBufferSourceNode>();
  private cache = new Map<string, Float32Array[]>();
  private analyser = this.context.createAnalyser();
  private frame = 0;

  constructor(private onLevel: (level: number) => void, private onAudio: () => void) {
    this.analyser.fftSize = 512;
    const compressor = this.context.createDynamicsCompressor();
    this.analyser.connect(compressor); compressor.connect(this.context.destination);
  }

  async resume() { await this.context.resume(); }
  async pause() { await this.context.suspend(); this.onLevel(0); }
  stop() {
    this.controller.abort();
    for (const source of this.sources) source.stop();
    this.sources.clear(); cancelAnimationFrame(this.frame); this.onLevel(0);
  }
  dispose() { this.stop(); this.cache.clear(); void this.context.close(); }

  async play(text: string) {
    this.stop();
    const controller = new AbortController();
    this.controller = controller;
    await this.resume();
    const data = new Uint8Array(this.analyser.fftSize);
    const tick = () => {
      this.analyser.getByteTimeDomainData(data);
      const sum = data.reduce((s, v) => s + ((v - 128) / 128) ** 2, 0);
      this.onLevel(this.context.state === "running" ? Math.min(1, Math.sqrt(sum / data.length) * 4) : 0);
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
    try {
      for (const chunk of narrationChunks(text)) {
        controller.signal.throwIfAborted();
        let head = this.context.currentTime + 0.05;
        let playback = Promise.resolve();
        const schedule = (samples: Float32Array) => {
          const buffer = this.context.createBuffer(1, samples.length, 24000);
          buffer.copyToChannel(new Float32Array(samples), 0);
          const source = this.context.createBufferSource();
          source.buffer = buffer; source.connect(this.analyser); this.sources.add(source);
          playback = new Promise<void>((resolve) => { source.onended = () => { this.sources.delete(source); resolve(); }; });
          head = Math.max(head, this.context.currentTime + 0.05);
          source.start(head); head += buffer.duration; this.onAudio();
        };
        const cached = this.cache.get(chunk);
        if (cached) cached.forEach(schedule);
        else {
          const response = await fetch("/api/speech", {
            method: "POST", headers: { "Content-Type": "application/json", ...(await authHeader()) },
            body: JSON.stringify({ text: chunk, voice: "Aoede", stream: true, lesson: true }), signal: controller.signal,
          });
          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error ?? `Voice unavailable (${response.status})`);
          }
          if (!response.body) throw new Error("Voice response is empty.");
          let done = false;
          let pending = new Uint8Array(0);
          const audio: Float32Array[] = [];
          const parser = createParser({ onEvent(event) {
            if (event.data === "[DONE]") return;
            const payload = JSON.parse(event.data);
            if (payload.type === "error" || payload.error || payload.type === "denied") throw new Error(payload.error?.message ?? payload.message ?? "Voice generation was denied.");
            if (payload.type === "speech.audio.done") { done = true; return; }
            if (payload.type !== "speech.audio.delta") return;
            if (done || typeof payload.audio !== "string") throw new Error("Invalid voice audio.");
            const decoded = decodeSpeechPCM(pending, Uint8Array.from(atob(payload.audio), c => c.charCodeAt(0)));
            pending = new Uint8Array(decoded.pending);
            if (decoded.samples.length) { audio.push(decoded.samples); schedule(decoded.samples); }
          } });
          const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
          try {
            while (true) { const next = await reader.read(); if (next.done) break; parser.feed(next.value); }
            parser.reset({ consume: true });
          } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
          if (!done || !audio.length || pending.length) throw new Error("Voice stream ended before the narration finished.");
          this.cache.set(chunk, audio);
        }
        await playback;
        controller.signal.throwIfAborted();
      }
    } finally {
      if (this.controller === controller) { cancelAnimationFrame(this.frame); this.onLevel(0); }
    }
  }
}