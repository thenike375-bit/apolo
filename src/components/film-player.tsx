import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pause, Play, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApolloPuppet } from "./apollo-puppet";
import { getFilmPlayback, saveLearningProgress } from "@/lib/preparation.functions";
import { filmIndexAt } from "@/lib/film";
import { useI18n } from "@/lib/i18n";
import type { ApolloMood } from "@/lib/avatars";

export type FilmPlayerHandle = { pause(): void; resume(): void; seconds(): number };

/**
 * Two persistent <video> slots: one plays the current clip while the other
 * preloads the next, so clip changes swap instantly instead of re-buffering.
 */
export function FilmPlayer({ id, connected, level, mood = "happy", ref, onContext, onPlayingChange, onStart, starting = false }: {
  id: string; connected: boolean; level: number; ref: Ref<FilmPlayerHandle>;
  mood?: ApolloMood;
  onContext: (action: string, index: number, seconds: number, question?: string) => void;
  onPlayingChange?: (playing: boolean) => void;
  /** Starts the live call with Apollo when the corner button is pressed before connecting. */
  onStart?: () => void;
  starting?: boolean;
}) {
  const { t } = useI18n();
  const load = useServerFn(getFilmPlayback);
  const save = useServerFn(saveLearningProgress);
  const { data, error } = useQuery({ queryKey: ["film-playback", id], queryFn: () => load({ data: { id } }), staleTime: 30 * 60 * 1000 });
  const slots = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)];
  const [index, setIndex] = useState(0);
  const [active, setActive] = useState(0); // which slot shows the current clip
  const [playing, setPlaying] = useState(false);
  const [question, setQuestion] = useState("");
  const position = useRef(0);
  const lastSaved = useRef(0);
  const pendingSeek = useRef<number | null>(null);
  const initialized = useRef(false);
  const clip = data?.clips[index];
  const nextClip = data?.clips[index + 1];
  const current = () => slots[active]!.current;
  useEffect(() => { onPlayingChange?.(playing); }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps
  const persist = (completed = false, selectedIndex = index) => {
    if (!data) return;
    void save({ data: { id, index: selectedIndex, seconds: position.current, completed } }).catch(e => toast.error(e.message));
  };
  const pause = () => { setPlaying(false); current()?.pause(); persist(); };
  const resume = () => {
    if (!connected) return;
    setPlaying(true);
    void current()?.play().catch(e => { if (e?.name !== "AbortError") { setPlaying(false); toast.error(e.message); } });
  };
  useImperativeHandle(ref, () => ({ pause, resume, seconds: () => position.current }));
  useEffect(() => {
    if (!data || initialized.current) return;
    initialized.current = true;
    position.current = data.seconds;
    const at = filmIndexAt(data.clips, data.seconds);
    pendingSeek.current = Math.max(0, data.seconds - (data.clips[at]?.start ?? 0));
    setIndex(at);
  }, [data]);
  useEffect(() => { if (!connected) pause(); else resume(); }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const leave = () => persist();
    window.addEventListener("pagehide", leave);
    return () => { window.removeEventListener("pagehide", leave); slots.forEach(s => s.current?.pause()); persist(); };
  }, [id, data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the hidden slot loaded with the next clip.
  const urlFor = (slot: number) => (slot === active ? clip?.url : nextClip?.url);
  const select = (next: number, replay = false, auto = false) => {
    const selected = data?.clips[next];
    if (!selected) return;
    position.current = selected.start;
    pendingSeek.current = 0;
    const other = 1 - active;
    if (next === index + 1 && slots[other]!.current) {
      // Instant swap to the preloaded slot.
      current()?.pause();
      const v = slots[other]!.current!;
      v.currentTime = 0;
      pendingSeek.current = null;
      setActive(other);
      if (connected) { setPlaying(true); void v.play().catch(() => {}); }
    } else if (next === index && current()) {
      current()!.currentTime = 0;
      if (connected) resume();
    }
    setIndex(next);
    if (connected) {
      setPlaying(true);
      // Automatic advances only sync silently so Apollo keeps narrating without a fresh turn.
      onContext(auto ? "context" : replay ? "replay" : "scene", next, selected.start);
    }
    persist(false, next);
  };
  if (error) return <p role="alert" className="text-destructive">{error.message}</p>;
  if (!data || !clip) return <div className="aspect-video flex items-center justify-center bg-muted text-muted-foreground">{t.filmLoading}</div>;
  return <section className="space-y-4">
    <div className="relative aspect-video overflow-hidden rounded-lg bg-background">
      {slots.map((slot, s) => {
        const isActive = s === active;
        return <video key={s} ref={slot} src={urlFor(s)} muted playsInline preload="auto" aria-hidden={!isActive} aria-label={isActive ? clip.title : undefined}
          className={`absolute inset-0 h-full w-full object-contain ${isActive ? "opacity-100" : "pointer-events-none opacity-0"}`}
          onLoadedMetadata={() => {
            if (!isActive) return;
            const v = slot.current;
            if (v && pendingSeek.current !== null) { v.currentTime = Math.min(pendingSeek.current, v.duration); pendingSeek.current = null; }
            if (playing && connected) resume();
          }}
          onTimeUpdate={() => {
            if (!isActive) return;
            position.current = clip.start + (slot.current?.currentTime ?? 0);
            // Save rarely and never push mid-speech updates to Apollo: those interrupt her voice.
            if (Math.abs(position.current - lastSaved.current) >= 15) { lastSaved.current = position.current; persist(); }
          }}
          onEnded={() => {
            if (!isActive) return;
            if (index < data.clips.length - 1) select(index + 1, false, true);
            else { pause(); persist(true); onContext("pause", index, position.current); }
          }}
          onError={() => { if (isActive) { pause(); toast.error("This film clip could not be played."); } }} />;
      })}
      <div className="pointer-events-none absolute bottom-2 right-2 h-[24%] aspect-[200/230]">
        <ApolloPuppet action={level > 0.03 ? "point" : "idle"} level={level} mood={mood} />
      </div>
      {connected ? <Button type="button" size="icon" variant="secondary"
        className="absolute bottom-3 left-3 z-20 size-10 rounded-full shadow-md"
        aria-label={playing ? t.pauseLesson : t.resumeLesson} title={playing ? t.pauseLesson : t.resumeLesson}
        onClick={() => {
          if (playing) { pause(); onContext("pause", index, position.current); }
          else { resume(); onContext("resume", index, position.current); }
        }}>{playing ? <Pause /> : <Play />}</Button>
      : <Button type="button" variant="secondary" disabled={!onStart || starting}
        className="absolute bottom-3 left-3 z-20 h-10 rounded-full shadow-md"
        onClick={() => onStart?.()}><Play />Start learning with Apollo</Button>}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" disabled={!connected} onClick={() => {
        if (playing) { pause(); onContext("pause", index, position.current); }
        else { resume(); onContext("resume", index, position.current); }
      }}>{playing ? <Pause /> : <Play />}{playing ? t.pauseLesson : t.resumeLesson}</Button>
      <Button variant="outline" disabled={!connected} onClick={() => select(index, true)}><RotateCcw />{t.videoReplay}</Button>
      <Button variant="outline" disabled={!connected} onClick={() => { pause(); onContext("simpler", index, position.current); }}>{t.simplerLesson}</Button>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label={t.boardPrev} disabled={index === 0} onClick={() => select(index - 1)}><ChevronLeft /></Button>
        <span className="text-xs tabular-nums">{index + 1} / {data.clips.length}</span>
        <Button variant="ghost" size="icon" aria-label={t.boardNext} disabled={index >= data.clips.length - 1} onClick={() => select(index + 1)}><ChevronRight /></Button>
      </div>
    </div>
    <nav className="flex flex-wrap gap-2" aria-label="Film scenes">{data.clips.map((c, i) => <Button key={i} size="sm" variant={i === index ? "secondary" : "outline"} onClick={() => select(i)}>{c.title}</Button>)}</nav>
    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (!question.trim()) return; pause(); onContext("question", index, position.current, question.trim()); setQuestion(""); }}>
      <Input aria-label={t.placeholder} placeholder={t.placeholder} maxLength={1000} value={question} onChange={e => setQuestion(e.target.value)} disabled={!connected} />
      <Button disabled={!connected || !question.trim()}>{t.askTeacher}</Button>
    </form>
  </section>;
}
