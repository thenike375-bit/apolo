import { decideTeaching } from "@/lib/decisions.functions";
import { shouldVoiceDecision } from "@/lib/decisions";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Play, ShieldCheck, Video, Pause, RotateCcw, ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { BoardScene } from "@/components/board-scene";
import { FilmPlayer, type FilmPlayerHandle } from "@/components/film-player";
import { parseFilm } from "@/lib/film";
import { ExplainerVideo } from "@/components/explainer-video";
import { parseScenes, sceneFromSpeech, preparationColumns } from "@/lib/prepared-lesson";
import { saveLearningProgress } from "@/lib/preparation.functions";
import { BoardApollo } from "@/components/board-apollo";
import type { ApolloMood } from "@/lib/avatars";
import type { FaceCue } from "@/lib/face-cues";
import { SessionCamera } from "@/components/session-camera";
import { FullscreenStage } from "@/components/fullscreen-stage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { useLiveVoice } from "@/hooks/use-live-voice";
import { useAudioLevel } from "@/hooks/use-audio-level";
import { VisualBoard } from "@/components/visual-board";
import { createBoardCard } from "@/lib/learning.functions";
import type { BoardCard } from "@/lib/learning.server";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/lessons/live")({
  validateSearch: (search: Record<string, unknown>): { prepared?: string } => typeof search["prepared"] === "string" ? { prepared: search["prepared"] } : {},
  head: () => ({
    meta: [
      { title: "Live lessons — PostFactum" },
      {
        name: "description",
        content: "Learn aloud with your personal teacher in a private, interactive live lesson.",
      },
      { property: "og:title", content: "Live lessons — PostFactum" },
      {
        property: "og:description",
        content:
          "Talk through concepts with your teacher, with optional on-device camera feedback.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LiveLesson,
});

function LiveLesson() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { prepared: preparedId } = Route.useSearch();
  const saveProgress = useServerFn(saveLearningProgress);
  const filmPlayer = useRef<FilmPlayerHandle>(null);
  const { data: prepared, isPending: preparedPending, isError: preparedError, refetch: refetchPrepared } = useQuery({ queryKey: ["prepared", preparedId], enabled: Boolean(preparedId), queryFn: async () => {
    const { data, error } = await supabase.from("prepared_lessons").select(preparationColumns).eq("id", preparedId ?? "").maybeSingle();
    if (error) throw error;
    return data;
  } });
  const preparedScenes = parseScenes(prepared?.scenes);
  const film = parseFilm(prepared?.film);
  const [paused, setPaused] = useState(true);
  const [question, setQuestion] = useState("");
  const spoken = useRef("");
  const scenesRef = useRef(preparedScenes);
  scenesRef.current = preparedScenes;
  const [visualNotice, setVisualNotice] = useState(false);
  const [topic, setTopic] = useState("");
  const [captions, setCaptions] = useState<
    Array<{ role: "user" | "assistant"; text: string; start: number; end: number }>
  >([]);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [cameraEnded, setCameraEnded] = useState(false);
  const [cards, setCards] = useState<BoardCard[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [filmPlaying, setFilmPlaying] = useState(false);
  const preparedStatus = prepared?.status;
  const preparedFilmVersion = prepared?.film_version;
  const preparedCompleted = prepared?.completed;
  useEffect(() => { if (prepared) setCardIndex(prepared.scene_index); }, [prepared?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!preparedId || preparedStatus !== "ready" || (preparedFilmVersion ?? 0) > 0) return;
    const timer = setTimeout(() => { void saveProgress({ data: { id: preparedId, index: cardIndex, completed: preparedCompleted ?? false } }).catch(e => toast.error(e.message)); }, 350);
    return () => clearTimeout(timer);
  }, [cardIndex, preparedId, preparedStatus, preparedFilmVersion, preparedCompleted, saveProgress]);
  const pendingSpeech = useRef("");
  const boardTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const topicRef = useRef(topic);
  topicRef.current = topic;
  const langRef = useRef(lang);
  langRef.current = lang;
  const drawBoard = () => {
    const speech = pendingSpeech.current.trim();
    if (speech.length < 80) return;
    pendingSpeech.current = "";
    setDrawing(true);
    createBoardCard({
      data: { topic: topicRef.current, speech: speech.slice(-4000), language: langRef.current },
    })
      .then((card) =>
        setCards((rows) => {
          setCardIndex(rows.length);
          return [...rows, card];
        }),
      )
      .catch((e) => toast.error(e.message))
      .finally(() => setDrawing(false));
  };
  useEffect(() => () => clearTimeout(boardTimer.current), []);
  const call = useLiveVoice({
    getStartData: async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error(t.signIn);
      return { token: data.session.access_token, topic: prepared?.question ?? topic, language: lang, ...(preparedId ? { prepared: preparedId } : {}) };
    },
    onEvent: (event) => {
      if (event.type === "gateway.session.created") setSeconds(15);
      if (event.type === "app.connected" && preparedId) { setPaused(false); filmPlayer.current?.resume(); }
      if (["app.closed", "app.stopping", "app.error", "session.input_transcript.delta", "input_audio_buffer.speech_started"].includes(event.type)) filmPlayer.current?.pause();
      if (event.type === "session.usage.updated" || event.type === "session.closed") {
        if (typeof event.usage?.seconds === "number") setSeconds(Math.max(15, event.usage.seconds));
      }
      if (
        event.type !== "session.input_transcript.delta" &&
        event.type !== "session.output_transcript.delta"
      )
        return;
      if (typeof event["delta"] !== "string") return;
      const text = event["delta"];
      const start = typeof event["start_ms"] === "number" ? event["start_ms"] : 0;
      const end = typeof event["end_ms"] === "number" ? event["end_ms"] : start;
      const role: "user" | "assistant" =
        event.type === "session.input_transcript.delta" ? "user" : "assistant";
      if (role === "assistant") {
        if (preparedId && !film.length) {
          spoken.current = (spoken.current + text).slice(-3000);
          setCardIndex(current => sceneFromSpeech(spoken.current, scenesRef.current, current));
        } else {
        pendingSpeech.current += text;
        clearTimeout(boardTimer.current);
        boardTimer.current = setTimeout(drawBoard, 2500);
        if (pendingSpeech.current.length > 700) drawBoard();
        }
      } else if (preparedId) {
        setPaused(true);
        const words = text.toLowerCase();
        if (/compartment|flood|watertight/.test(words) && preparedScenes.some(s=>s.card.scene.props.some(p=>p.emoji==="ship"))) {
          const cutaway = scenesRef.current.findIndex(s=>s.card.scene.shot === "cutaway");
          if (cutaway >= 0) setCardIndex(cutaway);
        }
      }
      setCaptions((rows) => {
        const index = rows.findIndex(
          (r) => r.role === role && start <= r.end + 800 && end >= r.start,
        );
        if (index < 0)
          return [...rows, { role, text, start, end }].sort((a, b) => a.start - b.start);
        return rows.map((r, i) =>
          i === index
            ? {
                ...r,
                text: r.text + text,
                end: Math.max(r.end, end),
                start: Math.min(r.start, start),
              }
            : r,
        );
      });
    },
  });
  const decide = useServerFn(decideTeaching);
  const deciding = useRef(false);
  const lastDecision = useRef<{ action: string; at: number } | null>(null);
  const [reaction, setReaction] = useState<ApolloMood | null>(null);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(reactionTimer.current), []);
  const react = (mood: ApolloMood | null) => {
    clearTimeout(reactionTimer.current);
    setReaction(mood);
    if (mood) reactionTimer.current = setTimeout(() => setReaction(null), 9000);
  };
  const level = useAudioLevel(call.audioRef, call.status === "connected");
  const mood: ApolloMood =
    reaction ??
    (level > 0.03
      ? "talking"
      : call.status === "connected" && captions.at(-1)?.role === "user"
        ? "listening"
        : "reading");
  const active =
    call.status === "connecting" || call.status === "connected" || call.status === "stopping";
  const status =
    call.status === "connected"
      ? t.connected
      : call.status === "connecting"
        ? t.connecting
        : call.status === "stopping"
          ? t.stopping
          : call.status === "closed"
            ? t.sessionEnded
            : t.sessionReady;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 flex items-center gap-2 text-sm text-accent">
            <Video className="size-4" />
            PostFactum
          </p>
          <h1 className="text-3xl font-semibold">{prepared?.question ?? t.liveLesson}</h1>
        </div>
        <span className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm">
          <span
            className={`size-2 rounded-full ${call.status === "connected" ? "bg-accent animate-pulse" : "bg-muted-foreground"}`}
          />
          {status}
        </span>
      </header>
      <p className="flex items-start gap-2 border-l-2 border-accent/60 pl-3 text-xs leading-5 text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
        {t.livePrivacy}
      </p>
      {preparedId && (preparedError || (!preparedPending && !prepared)) && <div role="alert" className="card-surface flex items-center justify-between gap-3 p-4 text-sm"><span>{t.preparationListError}</span><Button size="sm" variant="outline" onClick={() => void refetchPrepared()}>{t.retry}</Button></div>}
      {preparedId && preparedPending && <p className="text-sm text-muted-foreground">{t.analyzing}</p>}
      <div className={`grid gap-5 ${film.length ? "lg:grid-cols-[4fr_1fr]" : "lg:grid-cols-[1.6fr_1fr]"}`}>
        <FullscreenStage lines={captions}>
          {preparedId ? film.length ? <FilmPlayer id={preparedId} ref={filmPlayer} connected={call.status === "connected"} starting={active} onStart={() => { setCameraEnded(false); setCaptions([]); setSeconds(null); setFeedback(null); spoken.current = ""; pendingSpeech.current = ""; call.start(); }} level={level} mood={mood} onPlayingChange={setFilmPlaying} onContext={(action,index,seconds,question)=>call.sendLesson(action,index,question,seconds)} /> : <div className="flex aspect-video items-center justify-center border border-border p-6 text-center text-muted-foreground">{t.filmUnavailable}</div> : <VisualBoard
            cards={cards}
            index={cardIndex}
            onIndex={setCardIndex}
            loading={drawing}
            chalkOnly
            teacher={
              <BoardApollo mood={mood} level={level} speaking={level > 0.03} writing={drawing || level > 0.03} cardIndex={cardIndex} />
            }
          />}
          {preparedId && prepared?.status !== "ready" && <p role="alert" className="mt-3 text-sm text-muted-foreground">{preparedPending ? t.filmLoading : t.preparationFailed}</p>}
          {call.status === "connected" && (
            <span className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 text-xs font-semibold">
              <span className="size-2 animate-pulse rounded-full bg-destructive" />
              LIVE
            </span>
          )}
          <div className="absolute right-3 top-3 z-20 w-32 sm:w-40">
            <SessionCamera
              compact
              lite={filmPlaying}
              muted={call.muted}
              onMute={call.status === "connected" ? () => call.setMuted(!call.muted) : undefined}
              ended={cameraEnded}
              autoStart
              onCue={(cue) => {
                call.sendCue(cue);
              }}
              onFocus={(band, score) => {
                call.sendFocus(band, score);
              }}
              onSnapshot={(image) => {
                if (call.status !== "connected" || deciding.current) return;
                deciding.current = true;
                decide({ data: { image, topic: topic || undefined } })
                  .then((d) => {
                    if (!d) return;
                    if (d.action !== "continue") react(d.apollo_expression);
                    const now = Date.now();
                    if (shouldVoiceDecision(d.action, lastDecision.current, now)) {
                      lastDecision.current = { action: d.action, at: now };
                      call.sendDecision(d.action, d.observation);
                    }
                  })
                  .catch(() => {})
                  .finally(() => {
                    deciding.current = false;
                  });
              }}
            />
          </div>
        </FullscreenStage>
        <div className="space-y-5">
          <section className="flex items-center justify-between gap-2 rounded-lg border border-secondary/30 p-3">
            <div>
              <h2 className="text-lg font-semibold">Apollo</h2>
              <p className="text-xs text-muted-foreground">{t.liveSub}</p>
            </div>
            <div aria-hidden="true" className="flex h-6 items-center gap-0.5">
              {Array.from({ length: 9 }, (_, i) => (
                <span
                  key={i}
                  className="w-1 rounded-full bg-accent transition-[height] duration-75"
                  style={{
                    height: `${Math.max(3, Math.min(22, 3 + level * 36 * (0.5 + Math.abs(Math.sin(i * 1.7 + level * 9)))))}px`,
                  }}
                />
              ))}
            </div>
            <audio ref={call.audioRef} className="hidden" />
            {call.playbackBlocked && (
              <Button onClick={call.resumePlayback}>
                <Play />
                {t.listen}
              </Button>
            )}
          </section>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-y border-border py-4">
        {!preparedId && <>
        <Input
          aria-label={t.liveTopic}
          placeholder={t.liveTopic}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={200}
          disabled={active}
          className="min-w-0 flex-1 basis-64"
        />
        </>}
        {!active ? (
          <Button
            onClick={() => {
              setCameraEnded(false);
              setCaptions([]);
              setSeconds(null);
              setFeedback(null);
              if (!preparedId) { setCards([]); setCardIndex(0); }
              spoken.current = "";
              pendingSpeech.current = "";
              call.start();
            }}
            disabled={Boolean(preparedId) && (!prepared || prepared.status !== "ready" || !film.length)}
          >
            <Play />
            {preparedId ? t.startLearning : t.liveStart}
          </Button>
        ) : (
          <>
            <Button
              variant="destructive"
              disabled={call.status === "stopping"}
              onClick={() => {
                call.stop();
                filmPlayer.current?.pause();
                setPaused(true);
                setCameraEnded(true);
              }}
            >
              <PhoneOff />
              {t.liveEnd}
            </Button>
          </>
        )}
      </div>
      {preparedId && !film.length && preparedScenes.length > 0 && <section className="hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" disabled={call.status !== "connected"} onClick={() => { setPaused(!paused); call.sendLesson(paused ? "resume" : "pause", cardIndex); }}>{paused ? <Play /> : <Pause />}{paused ? t.resumeLesson : t.pauseLesson}</Button>
          <Button variant="outline" disabled={call.status !== "connected"} onClick={() => { setPaused(false); spoken.current = ""; call.sendLesson("replay", cardIndex); }}><RotateCcw />{t.videoReplay}</Button>
          <Button variant="outline" disabled={call.status !== "connected"} onClick={() => { setPaused(false); call.sendLesson("simpler", cardIndex); }}>{t.simplerLesson}</Button>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label={t.boardPrev} disabled={cardIndex===0} onClick={() => { const next=cardIndex-1; setCardIndex(next); setPaused(call.status!=="connected"); spoken.current=""; call.sendLesson("scene",next); }}><ChevronLeft /></Button>
            <span className="text-sm tabular-nums">{cardIndex+1} / {preparedScenes.length}</span>
            <Button variant="ghost" size="icon" aria-label={t.boardNext} disabled={cardIndex>=preparedScenes.length-1} onClick={() => { const next=cardIndex+1; setCardIndex(next); setPaused(call.status!=="connected"); spoken.current=""; call.sendLesson("scene",next); }}><ChevronRight /></Button>
          </div>
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="Lesson concepts">{preparedScenes.map((s,i)=><Button key={i} size="sm" variant={i===cardIndex?"secondary":"outline"} onClick={()=>{setCardIndex(i);setPaused(call.status!=="connected");spoken.current="";call.sendLesson("scene",i);}}>{i+1}. {s.card.title}</Button>)}</nav>
        <form className="flex gap-2" onSubmit={e=>{e.preventDefault();if(!question.trim())return;setPaused(true);call.sendLesson("question",cardIndex,question.trim());setVisualNotice(!/compartment|flood|watertight/i.test(question));if(/compartment|flood|watertight/i.test(question)){const idx=preparedScenes.findIndex(s=>s.card.scene.shot==="cutaway");if(idx>=0)setCardIndex(idx);}setQuestion("");}}><Input aria-label={t.placeholder} placeholder={t.placeholder} maxLength={1000} value={question} onChange={e=>setQuestion(e.target.value)} disabled={call.status!=="connected"}/><Button type="submit" disabled={call.status!=="connected"||!question.trim()}>{t.askTeacher}</Button></form>
        {visualNotice && <p className="text-xs text-muted-foreground">{t.visualUnavailable}</p>}
        {prepared?.lesson_id && <Button asChild variant="ghost"><Link to="/lessons/$lessonId" params={{lessonId:prepared.lesson_id}}><BookOpen />{t.sourceMaterial}</Link></Button>}
        <Button variant="ghost" onClick={async()=>{if(!preparedId)return;try{await saveProgress({data:{id:preparedId,index:cardIndex,completed:true}});call.stop();setPaused(true);setCameraEnded(true);toast.success(t.saved);}catch(e){toast.error((e as Error).message);}}}>{t.finishLesson}</Button>
      </section>}
      {!preparedId && !active && <ExplainerVideo lessonId={null} />}
      {call.error && (
        <p role="alert" className="text-sm text-destructive">
          {call.error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-2 text-sm text-muted-foreground">{t.selfFeedback}</span>
        {(
          [
            ["focused", t.focused],
            ["confused", t.confused],
            ["break", t.takeBreak],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={feedback === value ? "secondary" : "outline"}
            disabled={call.status !== "connected"}
            aria-pressed={feedback === value}
            onClick={() => {
              setFeedback(value);
              call.sendFeedback(value);
              react(value === "confused" ? "thinking" : value === "focused" ? "cheer" : "caring");
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <section>
        <h2 className="mb-3 font-semibold">{t.transcript}</h2>
        <Conversation className="h-64 border-y border-border">
          <ConversationContent>
            {captions.map((c, i) => (
              <Message key={i} from={c.role}>
                <span className="text-xs text-muted-foreground">
                  {c.role === "user" ? t.you : "Apollo"}
                </span>
                <MessageContent>
                  <MessageResponse>{c.text}</MessageResponse>
                </MessageContent>
              </Message>
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </section>
      <footer className="space-y-1 text-xs text-muted-foreground">
        {seconds !== null && (
          <p>
            {t.billableSeconds}: {Math.ceil(seconds)}
          </p>
        )}
        <p>{t.liveBilling}</p>
        <p>{t.liveVoiceNote}</p>
        <p>{t.aiNotice}</p>
      </footer>
    </div>
  );
}
