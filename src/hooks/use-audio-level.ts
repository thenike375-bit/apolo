import { useEffect, useState, type RefObject } from "react";

/** Reads the loudness (0–1) of the teacher's live audio so the avatar can animate while speaking. */
export function useAudioLevel(audioRef: RefObject<HTMLAudioElement | null>, active: boolean) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!active) {
      setLevel(0);
      return;
    }
    let ctx: AudioContext | undefined;
    let source: MediaStreamAudioSourceNode | undefined;
    let stream: MediaStream | null = null;
    let raf = 0;
    let analyser: AnalyserNode | undefined;
    const data = new Uint8Array(256);
    let smooth = 0;
    const tick = () => {
      const current = audioRef.current?.srcObject;
      if (current instanceof MediaStream && current !== stream && current.getAudioTracks().length) {
        stream = current;
        try {
          ctx ??= new AudioContext();
          source?.disconnect();
          source = ctx.createMediaStreamSource(current);
          analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          source.connect(analyser);
        } catch {
          analyser = undefined;
        }
      }
      if (analyser) {
        if (ctx?.state === "suspended") void ctx.resume();
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        const rms = Math.min(1, Math.sqrt(sum / data.length) * 4);
        smooth = smooth * 0.6 + rms * 0.4;
        setLevel(smooth < 0.02 ? 0 : smooth);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      source?.disconnect();
      void ctx?.close();
    };
  }, [audioRef, active]);
  return level;
}
