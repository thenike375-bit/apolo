import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Plus, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { lessonsQuery } from "@/lib/queries";
import { preparationColumns } from "@/lib/prepared-lesson";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/lessons/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Lessons — PostFactum" },
      { name: "description", content: "Your captured class lessons, summarized and ready to study." },
      { property: "og:title", content: "Lessons — PostFactum" },
      { property: "og:description", content: "Your captured class lessons." },
    ],
  }),
  component: LessonsPage,
});

function LessonsPage() {
  const { t } = useI18n();
  const lessons = useQuery(lessonsQuery());
  const preparedQuery = useQuery({ queryKey: ["prepared-library"], queryFn: async () => { const { data, error } = await supabase.from("prepared_lessons").select(preparationColumns).order("created_at", { ascending:false }).limit(100); if(error) throw error; return data ?? []; }, refetchInterval: q=>q.state.data?.some(r=>["queued","preparing"].includes(r.status))?4000:false });
  const { data: prepared = [] } = preparedQuery;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t.lessons}</h1>
        <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/lessons/live"><Video />{t.liveLesson}</Link></Button><Button asChild className="rounded-full" variant="secondary">
          <Link to="/lessons/new"><Plus className="size-4" /> {t.newLesson}</Link>
        </Button></div>
      </div>
      {lessons.isError && <div role="alert" className="card-surface flex items-center justify-between gap-3 p-4 text-sm"><span>{t.pageLoadError}</span><Button size="sm" variant="outline" onClick={() => void lessons.refetch()}>{t.retry}</Button></div>}
      {preparedQuery.isError && <div role="alert" className="card-surface flex items-center justify-between gap-3 p-4 text-sm"><span>{t.pageLoadError}</span><Button size="sm" variant="outline" onClick={() => void preparedQuery.refetch()}>{t.retry}</Button></div>}
      {(() => { const demos = prepared.filter(p => p.status === "ready" && Array.isArray(p.film) && p.film.length > 0).slice(0, 3); return demos.length > 0 && <section className="space-y-3"><div><h2 className="text-lg font-semibold">{t.demoTitle}</h2><p className="text-sm text-muted-foreground">{t.demoSubtitle}</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{demos.map(p => <article key={p.id} className="card-surface flex flex-col justify-between gap-3 p-4"><h3 className="break-words font-medium">{p.question}</h3><div className="space-y-2"><p className="text-sm font-semibold text-accent">⏱ {t.demoPrepTime} {formatDuration(new Date(p.updated_at).getTime() - new Date(p.created_at).getTime())} · {(p.film as unknown[]).length} {t.demoClips}</p><Button asChild size="sm"><Link to="/lessons/live" search={{ prepared: p.id }}><Video />{t.startLearning}</Link></Button></div></article>)}</div></section>; })()}
      {prepared.length > 0 && <section className="space-y-3 border-y border-border py-5"><h2 className="font-semibold">{t.preparedLessons}</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{prepared.map(p=><article key={p.id} className="card-surface space-y-3 p-4"><h3 className="break-words font-medium">{p.question}</h3><p className="text-xs text-accent">{p.completed ? t.finish : t.preparingStages[p.stage as keyof typeof t.preparingStages] ?? p.status}</p>{p.status==="ready"&&<Button asChild size="sm"><Link to="/lessons/live" search={{prepared:p.id}}><Video />{p.scene_index>0?t.continueLearning:t.startLearning}</Link></Button>}{p.error&&<p role="alert" className="text-xs text-destructive">{p.error}</p>}</article>)}</div></section>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(lessons.data ?? []).map((l) => (
          <Link key={l.id} to="/lessons/$lessonId" params={{ lessonId: l.id }} className="card-surface group p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift">
            <span className="text-xs font-medium uppercase tracking-wide text-secondary">{l.subject ?? l.status}</span>
            <h3 className="mt-1 font-semibold">{l.title}</h3>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              {new Date(l.created_at).toLocaleDateString()}
              <ChevronRight className="size-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </div>
      {lessons.data?.length === 0 && <p className="card-surface p-8 text-center text-muted-foreground">{t.noLessons}</p>}
    </div>
  );
}

function formatDuration(ms: number) {
  const m = Math.max(1, Math.round(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}
