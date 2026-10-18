import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { MessageResponse } from "@/components/ai-elements/message";
import { TeacherAvatar } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { createThread } from "@/lib/queries";
import { parseQuizQuestions, scoreQuiz } from "@/lib/quiz";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/quiz/$quizId")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Quiz — PostFactum" },
      { name: "description", content: "Test your understanding with a personalized quiz." },
      { property: "og:title", content: "Quiz — PostFactum" },
      { property: "og:description", content: "Test your understanding with a personalized quiz." },
    ],
  }),
  component: QuizPage,
});

function QuizPage() {
  const { quizId } = Route.useParams();
  const { t } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: quiz, isPending, isError, refetch } = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: async () => {
      const { data, error } = await supabase.from("quizzes").select("*").eq("id", quizId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [memoryError, setMemoryError] = useState(false);
  const finishing = useRef(false);

  useEffect(() => {
    setIdx(0);
    setAnswers([]);
    setPicked(null);
    setChecked(false);
    setDone(false);
    setSaving(false);
    setSaveError("");
    setMemoryError(false);
    finishing.current = false;
  }, [quizId]);

  useEffect(() => {
    if (quiz?.id === quizId && quiz.completed_at && Array.isArray(quiz.answers)) {
      setAnswers(quiz.answers as number[]);
      setDone(true);
    }
  }, [quizId, quiz]);

  if (isPending) return <div className="py-20 text-center text-muted-foreground">…</div>;
  if (isError) return <div className="mx-auto max-w-xl space-y-4 py-20 text-center"><p role="alert">{t.quizLoadError}</p><Button onClick={() => void refetch()}>{t.retry}</Button><Button asChild variant="outline"><Link to="/home">{t.backHome}</Link></Button></div>;
  if (!quiz) return <div className="mx-auto max-w-xl space-y-4 py-20 text-center"><p role="alert">{t.quizLoadError}</p><Button asChild variant="outline"><Link to="/home">{t.backHome}</Link></Button></div>;
  const currentQuiz = quiz;
  const parsedQuestions = parseQuizQuestions(currentQuiz.questions);
  if (!parsedQuestions) return <div className="mx-auto max-w-xl space-y-4 py-20 text-center"><p role="alert">{t.quizInvalid}</p><Button asChild variant="outline"><Link to="/home">{t.backHome}</Link></Button></div>;
  const qs = parsedQuestions;
  const q = qs[idx];

  async function finish(all: number[]) {
    if (finishing.current) return;
    finishing.current = true;
    setSaving(true);
    setSaveError("");
    setMemoryError(false);
    const { score, total, missed } = scoreQuiz(qs, all);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw authError ?? new Error("User session is missing.");
      const { data: saved, error: updateError } = await supabase
        .from("quizzes")
        .update({ answers: all, score, total, completed_at: new Date().toISOString() })
        .eq("id", quizId)
        .select("id")
        .maybeSingle();
      if (updateError || !saved) throw updateError ?? new Error("Quiz was not saved.");
      setAnswers(all);
      setDone(true);
      const kind = score / total >= 0.8 ? "strength" : "gap";
      const content = kind === "strength"
        ? `Scored ${score}/${total} on a quiz about "${currentQuiz.topic}" — solid understanding.`
        : `Scored ${score}/${total} on "${currentQuiz.topic}"; struggled with: ${missed.map((m) => m.question).join(" | ").slice(0, 300)}`;
      try {
        const { error: memoryInsertError } = await supabase.from("memories").insert({ user_id: auth.user.id, kind, content });
        if (memoryInsertError) setMemoryError(true);
      } catch {
        setMemoryError(true);
      }
      void qc.invalidateQueries({ queryKey: ["quizzes"] });
      void qc.invalidateQueries({ queryKey: ["memories"] });
    } catch {
      setSaveError(t.quizSaveError);
    } finally {
      finishing.current = false;
      setSaving(false);
    }
  }

  async function review() {
    const { missed } = scoreQuiz(qs, answers);
    const id = await createThread(`${currentQuiz.topic} — review`, currentQuiz.lesson_id);
    const list = missed.map((m) => `- ${m.question} (I answered: "${m.options[m.answered] ?? "—"}", correct: "${m.options[m.correct_index]}")`).join("\n");
    navigate({ to: "/chat/$threadId", params: { threadId: id }, search: { q: `I just took a quiz on "${currentQuiz.topic}" and got these wrong:\n${list}\nPlease help me understand my mistakes.` } });
  }

  if (done) {
    const { score, total, missed } = scoreQuiz(qs, answers);
    return (
      <div className="mx-auto max-w-xl space-y-6 text-center">
        <TeacherAvatar size={96} className="mx-auto animate-float" />
        <div>
          <p className="text-sm text-muted-foreground">{t.yourScore}</p>
          <p className="font-display text-6xl font-semibold text-gradient">{score}/{total}</p>
          <p className="mt-2 text-muted-foreground">{quiz.topic}</p>
        </div>
        <div className="space-y-3 text-left">
          {qs.map((qq, i) => (
            <div key={i} className="card-surface flex gap-3 p-4">
              {answers[i] === qq.correct_index ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />}
              <div className="text-sm">
                <MessageResponse>{qq.question}</MessageResponse>
                <div className="mt-1 text-muted-foreground"><MessageResponse>{qq.explanation}</MessageResponse></div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {missed.length > 0 && <Button className="rounded-full" onClick={review}>{t.reviewWithTeacher}</Button>}
          <Button asChild variant="outline" className="rounded-full"><Link to="/home">{t.backHome}</Link></Button>
        </div>
        {memoryError && <p role="status" className="text-sm text-muted-foreground">{t.quizMemoryError}</p>}
      </div>
    );
  }

  if (!q) return null;
  const isCorrect = picked === q.correct_index;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <div className="mb-2 flex justify-between text-sm text-muted-foreground">
          <span>{quiz.topic}</span>
          <span>{t.question} {idx + 1}/{qs.length}</span>
        </div>
        <Progress value={((idx + (checked ? 1 : 0)) / qs.length) * 100} />
      </div>
      <div className="card-surface p-6">
        <div className="text-lg font-medium"><MessageResponse>{q.question}</MessageResponse></div>
        <div className="mt-5 space-y-2">
          {q.options.map((o, i) => (
            <button
              key={i}
              disabled={checked}
              onClick={() => setPicked(i)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border border-border p-3.5 text-left text-sm transition-colors hover:bg-muted",
                picked === i && !checked && "border-secondary bg-secondary/10",
                checked && i === q.correct_index && "border-success bg-success/10",
                checked && picked === i && !isCorrect && "border-destructive bg-destructive/10",
              )}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">{String.fromCharCode(65 + i)}</span>
              <MessageResponse>{o}</MessageResponse>
            </button>
          ))}
        </div>
        {checked && (
          <div className={cn("mt-5 rounded-xl p-4 text-sm", isCorrect ? "bg-success/10" : "bg-destructive/10")}>
            <p className="mb-1 font-semibold">{isCorrect ? t.correct : t.incorrect}</p>
            <MessageResponse>{q.explanation}</MessageResponse>
          </div>
        )}
      </div>
      <Button
        size="lg"
        className="w-full rounded-xl"
        disabled={picked === null || saving}
        onClick={() => {
          if (!checked) return setChecked(true);
          const all = [...answers, picked!];
          if (idx + 1 >= qs.length) {
            void finish(all);
          } else {
            setAnswers(all);
            setPicked(null);
            setChecked(false);
            setIdx(idx + 1);
          }
        }}
      >
        {saving ? t.saving : !checked ? t.check : idx + 1 >= qs.length ? t.finish : t.next}
      </Button>
      {saveError && <p role="alert" className="text-center text-sm text-destructive">{saveError}</p>}
    </div>
  );
}
