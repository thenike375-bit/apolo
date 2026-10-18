import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BookOpenCheck, Brain, Mic, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo, TeacherAvatar } from "@/components/brand";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "PostFactum — Your teacher. Your pace. Your potential." },
      { name: "description", content: "A personal AI teacher that captures your lessons, explains what you missed, speaks with you and quizzes you." },
      { property: "og:title", content: "PostFactum — Your personal AI teacher" },
      { property: "og:description", content: "Capture lessons, understand them deeply, and test yourself with an AI teacher that remembers how you learn." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  useEffect(() => {
    if (!loading && user) navigate({ to: "/home" });
  }, [loading, user, navigate]);

  const features = [
    { icon: NotebookPen, title: t.captureLesson, body: t.captureLessonSub },
    { icon: Brain, title: t.askTeacher, body: t.askTeacherSub },
    { icon: Mic, title: t.voiceMode, body: t.listen + " · " + t.recordClass },
    { icon: BookOpenCheck, title: t.quickQuiz, body: t.quickQuizSub },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/auth">{t.signIn}</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-16 pt-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-hero p-8 text-foreground shadow-lift md:p-14">
          <div className="pointer-events-none absolute inset-0 bg-glow" />
          <div className="relative grid items-center gap-10 md:grid-cols-[1.3fr_1fr]">
            <div>
              <p className="mb-4 inline-block rounded-full border border-primary-foreground/20 px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground">
                {t.tagline}
              </p>
              <h1 className="text-4xl font-semibold leading-tight md:text-6xl">{t.heroTitle}</h1>
              <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">{t.heroBody}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" variant="secondary" className="rounded-full px-7">
                  <Link to="/auth">{t.getStarted}</Link>
                </Button>
              </div>
            </div>
            <div className="flex justify-center">
              <TeacherAvatar size={260} className="animate-float ring-4 ring-accent/30" />
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="card-surface p-6">
              <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                <f.icon className="size-5" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
