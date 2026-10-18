import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BookOpenCheck, Loader2, MessageCircle, RotateCcw } from "lucide-react";
import { MessageResponse } from "@/components/ai-elements/message";
import { ExplainerVideo } from "@/components/explainer-video";
import { LessonWhiteboard, buildLessonCards } from "@/components/lesson-whiteboard";
import { useStartQuiz } from "@/components/quiz-dialog";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { analyzeLesson } from "@/lib/learning.functions";
import { useI18n } from "@/lib/i18n";
import { createThread } from "@/lib/queries";

type Topic = { name: string; explanation: string; difficulty: "easy" | "medium" | "hard" };

export const Route = createFileRoute("/_app/lessons/$lessonId")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Lesson — PostFactum" },
      { name: "description", content: "Summary, key points and topics from your class." },
      { property: "og:title", content: "Lesson — PostFactum" },
      { property: "og:description", content: "Summary, key points and topics from your class." },
    ],
  }),
  component: LessonPage,
});

function LessonPage() {
  const { lessonId } = Route.useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { start, busy: quizBusy } = useStartQuiz();
  const [retrying, setRetrying] = useState(false);
  const { data: lesson, refetch, isPending, isError } = useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: async () => {
      const { data, error } = await supabase.from("lessons").select("*").eq("id", lessonId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isPending) return <div className="py-20 text-center text-muted-foreground">…</div>;
  if (isError || !lesson) return (
    <div className="mx-auto max-w-xl space-y-4 py-20 text-center">
      <p className="text-muted-foreground">{isError ? t.pageLoadError : t.quizLoadError}</p>
      <div className="flex justify-center gap-2">
        <Button variant="outline" onClick={() => void refetch()}>{t.retry}</Button>
        <Button variant="ghost" onClick={() => navigate({ to: "/lessons" })}>{t.backHome}</Button>
      </div>
    </div>
  );
  const topics = (lesson.topics as unknown as Topic[]) ?? [];
  const points = (lesson.key_points as unknown as string[]) ?? [];

  async function explain(topic: string) {
    const id = await createThread(topic.slice(0, 60), lessonId);
    navigate({
      to: "/chat/$threadId",
      params: { threadId: id },
      search: { q: `${t.explainThis}: "${topic}"` },
    });
  }

  async function retry() {
    setRetrying(true);
    try {
      await analyzeLesson({ data: { lessonId } });
      await refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRetrying(false);
    }
  }

  const diff = { easy: "bg-success/15 text-success", medium: "bg-warning/20 text-foreground", hard: "bg-destructive/15 text-destructive" };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-secondary">{lesson.subject}</span>
        <h1 className="text-3xl font-semibold">{lesson.title}</h1>
      </div>

      {lesson.status !== "ready" && (
        <div className="card-surface flex items-center justify-between gap-3 p-4">
          <span className="text-sm text-muted-foreground">{lesson.status === "processing" ? t.analyzing : lesson.status}</span>
          <Button size="sm" variant="outline" onClick={retry} disabled={retrying}>
            {retrying ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} {t.retry}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button className="rounded-full" onClick={() => explain(lesson.title)}>
          <MessageCircle className="size-4" /> {t.askTeacher}
        </Button>
        <Button variant="secondary" className="rounded-full" disabled={quizBusy} onClick={() => start(lesson.title, lessonId)}>
          {quizBusy ? <Loader2 className="size-4 animate-spin" /> : <BookOpenCheck className="size-4" />} {quizBusy ? t.generating : t.quizMe}
        </Button>
      </div>

      <LessonWhiteboard cards={buildLessonCards(lesson.title, lesson.summary, points, topics)} />

      <ExplainerVideo lessonId={lessonId} />

      {lesson.summary && (
        <section className="card-surface p-6">
          <h2 className="mb-2 font-semibold">{t.summary}</h2>
          <MessageResponse>{lesson.summary}</MessageResponse>
        </section>
      )}

      {points.length > 0 && (
        <section className="card-surface p-6">
          <h2 className="mb-3 font-semibold">{t.keyPoints}</h2>
          <ul className="space-y-2">
            {points.map((p, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/25 text-[11px] font-bold text-accent-foreground">{i + 1}</span>
                <MessageResponse>{p}</MessageResponse>
              </li>
            ))}
          </ul>
        </section>
      )}

      {topics.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t.confusingTopics}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {topics.map((tp) => (
              <div key={tp.name} className="card-surface flex flex-col p-5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{tp.name}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${diff[tp.difficulty] ?? ""}`}>{tp.difficulty}</span>
                </div>
                <div className="flex-1 text-sm text-muted-foreground">
                  <MessageResponse>{tp.explanation}</MessageResponse>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => explain(tp.name)}>{t.explainThis}</Button>
                  <Button size="sm" variant="ghost" className="rounded-full" disabled={quizBusy} onClick={() => start(tp.name, lessonId)}>{t.quizMe}</Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Collapsible className="card-surface p-5">
        <CollapsibleTrigger className="text-sm font-medium text-muted-foreground">{t.transcript} ▾</CollapsibleTrigger>
        <CollapsibleContent>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{lesson.transcript}</p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
