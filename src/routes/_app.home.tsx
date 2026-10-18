import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, Brain, ChevronRight, NotebookPen, Video, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeacherAvatar } from "@/components/brand";
import { QuizDialog } from "@/components/quiz-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { createThread, lessonsQuery, memoriesQuery, profileQuery, quizzesQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app/home")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Home — PostFactum" },
      { name: "description", content: "Your learning dashboard: lessons, quizzes and your AI teacher." },
      { property: "og:title", content: "Home — PostFactum" },
      { property: "og:description", content: "Your learning dashboard." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const profile = useQuery({ ...profileQuery(user?.id ?? ""), enabled: !!user });
  const lessons = useQuery(lessonsQuery());
  const quizzes = useQuery(quizzesQuery());
  const memories = useQuery(memoriesQuery());

  async function newChat() {
    const id = await createThread(t.newChatTitle);
    navigate({ to: "/chat/$threadId", params: { threadId: id } });
  }

  const actionCls = "card-surface group flex items-center gap-4 p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-lift";

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden border-b border-border py-6 text-foreground md:py-10">
        
        <div className="relative flex items-center gap-5">
          <TeacherAvatar size={72} className="animate-float" />
          <div>
            <h1 className="text-2xl font-semibold md:text-3xl">
              {t.hello}, {profile.data?.display_name ?? ""} 👋
            </h1>
            <p className="mt-1 text-muted-foreground">{t.homeSub}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              {memories.data?.length ?? 0} {t.memoryCount} · Apollo
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-6 border-y border-accent/25 bg-glow py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4"><span className="flex size-14 items-center justify-center rounded-full bg-accent/15 text-accent"><Video /></span><div><h2 className="text-2xl font-semibold">{t.liveLesson}</h2><p className="mt-1 text-muted-foreground">{t.liveSub}</p></div></div>
        <Button asChild size="lg"><Link to="/lessons/live">{t.liveStart}<ArrowUpRight /></Link></Button>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        <Button variant="ghost" onClick={newChat} className={`${actionCls} h-auto whitespace-normal`}>
          <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground"><Brain className="size-5" /></span>
          <span className="flex-1"><span className="block font-semibold">{t.askTeacher}</span><span className="text-sm text-muted-foreground">{t.askTeacherSub}</span></span>
          <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </Button>
        <Link to="/lessons/new" className={actionCls}>
          <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><NotebookPen className="size-5" /></span>
          <span className="flex-1"><span className="block font-semibold">{t.captureLesson}</span><span className="text-sm text-muted-foreground">{t.captureLessonSub}</span></span>
          <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </Link>
        <QuizDialog>
          <Button variant="ghost" className={`${actionCls} h-auto whitespace-normal`}>
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><BookOpenCheck className="size-5" /></span>
            <span className="flex-1"><span className="block font-semibold">{t.quickQuiz}</span><span className="text-sm text-muted-foreground">{t.quickQuizSub}</span></span>
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </Button>
        </QuizDialog>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t.recentLessons}</h2>
          <div className="card-surface divide-y divide-border">
            {(lessons.data ?? []).slice(0, 5).map((l) => (
              <Link key={l.id} to="/lessons/$lessonId" params={{ lessonId: l.id }} className="flex items-center justify-between p-4 hover:bg-muted/50">
                <span>
                  <span className="block font-medium">{l.title}</span>
                  <span className="text-xs text-muted-foreground">{l.subject ?? l.status}</span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
            {lessons.data?.length === 0 && <p className="p-5 text-sm text-muted-foreground">{t.noLessons}</p>}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t.recentQuizzes}</h2>
          <div className="card-surface divide-y divide-border">
            {(quizzes.data ?? []).slice(0, 5).map((q) => (
              <Link key={q.id} to="/quiz/$quizId" params={{ quizId: q.id }} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/50">
                <span className="font-medium">{q.topic}</span>
                {q.completed_at ? (
                  <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
                    {q.score}/{q.total}
                  </span>
                ) : (
                  <ChevronRight className="size-4 text-muted-foreground" />
                )}
              </Link>
            ))}
            {quizzes.data?.length === 0 && <p className="p-5 text-sm text-muted-foreground">{t.noQuizzes}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
