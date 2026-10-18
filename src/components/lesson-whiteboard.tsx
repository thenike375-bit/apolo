import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VisualBoard } from "@/components/visual-board";
import { FullscreenStage, type StageLine } from "@/components/fullscreen-stage";
import { BoardApollo } from "@/components/board-apollo";
import type { BoardCard } from "@/lib/learning.server";
import { useI18n } from "@/lib/i18n";
import { narrationForCard, type NarratedCard } from "@/lib/lesson-narration";
import { LessonSpeech } from "@/lib/lesson-speech";
import { stripMarkdown } from "@/lib/voice-client";

type Topic = { name: string; explanation: string };

const blankScene: BoardCard["scene"] = { setting: "lab", props: [], caption: "", actors: [], clash: false };
const short = (s: string, n = 90) => (s.length > n && !s.includes("$") ? `${s.slice(0, n).trimEnd()}…` : s);
const sentences = (s: string) => s.replace(/[*#_`]/g, "").split(/(?<=[.!?])\s+/).filter((x) => x.trim().length > 3);

/** Turns a captured lesson into energetic whiteboard cards that Apollo presents. */
export function buildLessonCards(title: string, summary: string | null, points: string[], topics: Topic[]): NarratedCard[] {
  const card = (t: string, p: string[], narration: string): NarratedCard => ({ title: t, points: p.slice(0, 4).map((x) => short(x)), formula: "", diagram: [], analogy: "", scene: blankScene, narration });
  const cards: NarratedCard[] = [];
  if (summary) cards.push(card(title, sentences(summary).slice(0, 3), `${title}. ${summary}`));
  for (let i = 0; i < points.length; i += 3) cards.push(card(i === 0 ? "Key points" : "Keep going!", points.slice(i, i + 3), points.slice(i, i + 3).join(". ")));
  for (const tp of topics) cards.push(card(tp.name, sentences(tp.explanation).slice(0, 3), `${tp.name}. ${tp.explanation}`));
  return cards;
}

export function LessonWhiteboard({ cards }: { cards: NarratedCard[] }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [level, setLevel] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const player = useRef<LessonSpeech | null>(null);
  const run = useRef(0);
  const active = useRef(false);
  const paused = useRef(false);
  const completed = useRef(false);
  useEffect(() => () => { run.current++; player.current?.dispose(); }, []);

  async function startAt(start: number) {
    const id = ++run.current;
    player.current ??= new LessonSpeech(setLevel, () => setLoading(false));
    const speech = player.current;
    active.current = true; paused.current = false; completed.current = false;
    setPlaying(true); setError("");
    try {
      for (let i = start; i < cards.length; i++) {
        if (run.current !== id) return;
        const card = cards[i];
        if (!card) break;
        setIndex(i); setLoading(true);
        await speech.play(stripMarkdown(narrationForCard(card)));
      }
      if (run.current === id) { active.current = false; completed.current = true; setPlaying(false); setLoading(false); }
    } catch (e) {
      if (run.current !== id) return;
      speech.stop(); active.current = false; setPlaying(false); setLoading(false);
      setError(e instanceof Error ? e.message : t.narrationError);
    }
  }

  async function toggle() {
    if (!active.current) { await startAt(completed.current ? 0 : index); return; }
    const speech = player.current;
    if (!speech) return;
    paused.current = !paused.current;
    setPlaying(!paused.current);
    try { if (paused.current) await speech.pause(); else await speech.resume(); }
    catch (e) { run.current++; speech.stop(); active.current = false; setPlaying(false); setLoading(false); setError(e instanceof Error ? e.message : t.narrationError); }
  }

  function selectCard(i: number) {
    const wasPlaying = active.current && !paused.current;
    run.current++; player.current?.stop(); active.current = false; completed.current = false;
    setIndex(i); setPlaying(false); setLoading(false); setError("");
    if (wasPlaying) void startAt(i);
  }

  const [spokenUpTo, setSpokenUpTo] = useState(-1);
  useEffect(() => { if (playing) setSpokenUpTo(m => Math.max(m, index)); }, [playing, index]);
  const spokenLines: StageLine[] = cards.slice(0, spokenUpTo + 1).map(c => ({ role: "assistant", text: stripMarkdown(narrationForCard(c)) }));
  if (cards.length === 0) return null;
  return (
    <section className="space-y-3">
      <FullscreenStage lines={spokenLines}>
      <VisualBoard
        cards={cards}
        index={index}
        onIndex={selectCard}
        loading={false}
        chalkOnly
        teacher={<BoardApollo mood={playing && !loading ? "talking" : "happy"} level={level} speaking={playing && !loading} writing={playing && !loading} cardIndex={index} />}
      />
      </FullscreenStage>
      <div className="flex flex-wrap gap-2">
        <Button className="rounded-full" onClick={() => void toggle()}>
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />} {playing ? t.pauseLesson : t.playExplainer}
        </Button>
        <Button variant="outline" className="rounded-full" onClick={() => void startAt(0)}>
          <RotateCcw className="size-4" /> {t.videoReplay}
        </Button>
      </div>
      {loading && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{t.previewLoading}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
