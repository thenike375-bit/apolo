import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Clapperboard, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { prepareLesson, resumeFilm } from "@/lib/preparation.functions";
import { preparationColumns } from "@/lib/prepared-lesson";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";

/** Ask what you didn't understand → Apollo prepares an animated film you can play later. */
export function ExplainerVideo({ lessonId }: { lessonId: string | null }) {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const enqueue = useServerFn(prepareLesson);
  const resume = useServerFn(resumeFilm);
  const { data: preparations = [], refetch, error: listError } = useQuery({ queryKey: ["preparations", lessonId, user?.id], enabled: !loading && Boolean(user), queryFn: async () => {
    let query = supabase.from("prepared_lessons").select(preparationColumns).order("created_at", { ascending: false }).limit(10);
    query = lessonId ? query.eq("lesson_id", lessonId) : query.is("lesson_id", null);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }, refetchInterval: (q) => q.state.data?.some(r => ["queued", "preparing"].includes(r.status)) ? 2500 : false });

  async function make() {
    if (loading || !user) { toast.error(t.preparationSignIn); return; }
    if (question.trim().length < 2) return;
    setBusy(true);
    try {
      await enqueue({ data: { question: question.trim(), lessonId } });
      setQuestion("");
      await refetch();
    } catch (e) {
      toast.error((e as Error).message);
      await refetch();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 border-y border-border py-6">
      <h2 className="flex items-center gap-2 font-semibold">
        <Clapperboard className="size-4" /> {t.videoTitle}
      </h2>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void make();
        }}
      >
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t.videoPlaceholder} maxLength={500} />
        <Button type="submit" disabled={loading || !user || busy || question.trim().length < 2}>
          {busy && <Loader2 className="size-4 animate-spin" />} {t.videoMake}
        </Button>
      </form>
      {busy && <p className="text-sm text-muted-foreground">{t.videoMaking}</p>}
      {listError && <div role="alert" className="flex items-center justify-between gap-3 text-sm text-destructive"><span>{t.preparationListError}</span><Button size="sm" variant="outline" onClick={() => void refetch()}>{t.retry}</Button></div>}
      <p className="text-xs text-muted-foreground">{t.filmBilling}</p>
      <p className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs">{t.demoCreditsNotice}</p>
      {preparations.map(row => <article key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-accent pl-4 py-2">
        <div className="min-w-0"><p className="break-words font-medium">{row.question}</p><p className="text-xs text-muted-foreground">{row.stage.startsWith("generating_") ? `${t.preparingStages.generating} (${row.stage.split("_").slice(1).join(" / ")})` : t.preparingStages[row.stage as keyof typeof t.preparingStages] ?? row.status}</p>{row.error && <p role="alert" className="text-sm text-destructive">{row.error}</p>}</div>
        {row.status === "ready" ? <Button asChild><Link to="/lessons/live" search={{ prepared: row.id }}><Play />{row.scene_index > 0 ? t.continueLearning : t.startLearning}</Link></Button> : ["queued", "preparing"].includes(row.status) ? <Loader2 className="size-4 animate-spin text-accent" /> : row.status === "failed" ? <Button variant="outline" onClick={async () => { try { await resume({ data: { id: row.id } }); await refetch(); } catch (e) { toast.error((e as Error).message); } }}>Resume (keeps finished clips)</Button> : null}
      </article>)}
    </section>
  );
}
