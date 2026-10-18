import { useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createQuiz } from "@/lib/learning.functions";
import { useI18n } from "@/lib/i18n";

export function useStartQuiz() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const start = async (topic: string, lessonId: string | null = null) => {
    setBusy(true);
    try {
      const { id } = await createQuiz({ data: { topic, lessonId } });
      navigate({ to: "/quiz/$quizId", params: { quizId: id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };
  return { start, busy };
}

export function QuizDialog({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [topic, setTopic] = useState("");
  const { start, busy } = useStartQuiz();
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.quickQuiz}</DialogTitle>
        </DialogHeader>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (topic.trim()) start(topic.trim());
          }}
        >
          <Input autoFocus value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t.quizTopicPlaceholder} />
          <Button type="submit" disabled={busy || !topic.trim()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : t.generate}
          </Button>
        </form>
        {busy && <p className="text-sm text-muted-foreground">{t.generating}</p>}
      </DialogContent>
    </Dialog>
  );
}
