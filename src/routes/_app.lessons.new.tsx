import { MAX_UPLOAD_BYTES, splitAudio } from "@/lib/audio-chunks";
import { MAX_DOCUMENT_BYTES } from "@/lib/document-input";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { prepareLesson } from "@/lib/preparation.functions";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FileAudio, Loader2, Mic, NotebookPen, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { analyzeLesson } from "@/lib/learning.functions";
import { useI18n } from "@/lib/i18n";
import { Recorder, transcribeBlob } from "@/lib/voice-client";

export const Route = createFileRoute("/_app/lessons/new")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Capture a lesson — PostFactum" },
      { name: "description", content: "Record, upload or paste your class and get a summary and topics to study." },
      { property: "og:title", content: "Capture a lesson — PostFactum" },
      { property: "og:description", content: "Turn your class into study material." },
    ],
  }),
  component: NewLesson,
});

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function NewLesson() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const prepare = useServerFn(prepareLesson);
  const [question, setQuestion] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [rec, setRec] = useState<"idle" | "recording">("idle");
  const [seconds, setSeconds] = useState(0);
  const [phase, setPhase] = useState<"idle" | "transcribing" | "analyzing">("idle");
  const recorder = useRef<Recorder | null>(null);

  useEffect(() => () => {
    recorder.current?.abort();
    recorder.current = null;
  }, []);

  useEffect(() => {
    if (rec !== "recording") return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [rec]);

  async function addTranscript(blob: Blob) {
    if (blob.size > MAX_UPLOAD_BYTES) {
      toast.error("File is larger than 200 MB");
      return;
    }
    setPhase("transcribing");
    const progress = toast.loading("…");
    try {
      const parts = await splitAudio(blob);
      const texts: string[] = [];
      for (let i = 0; i < parts.length; i++) {
        toast.loading(`${i + 1} / ${parts.length}`, { id: progress });
        const part = parts[i];
        if (part) texts.push(await transcribeBlob(part, lang));
      }
      const text = texts.join(" ").trim();
      setNotes((n) => (n ? n + "\n\n" : "") + text);
      toast.success("✓");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      toast.dismiss(progress);
      setPhase("idle");
    }
  }

  async function toggleRec() {
    if (rec === "idle") {
      try {
        recorder.current = new Recorder();
        await recorder.current.start();
        setSeconds(0);
        setRec("recording");
      } catch {
        toast.error(t.micDenied);
      }
    } else {
      setRec("idle");
      const activeRecorder = recorder.current;
      recorder.current = null;
      if (!activeRecorder) return;
      const blob = await activeRecorder.stop();
      await addTranscript(blob);
    }
  }

  async function analyze() {
    if (phase !== "idle" || notes.trim().length < 20) return;
    setPhase("analyzing");
    let lessonId: string;
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) throw new Error(t.signIn);
      const { data, error } = await supabase
        .from("lessons")
        .insert({ user_id: auth.user.id, title: title.trim() || "Untitled lesson", transcript: notes.trim() })
        .select("id")
        .single();
      if (error) throw error;
      lessonId = data.id;
    } catch (error) {
      setPhase("idle");
      toast.error(error instanceof Error ? error.message : t.preparationSaveError);
      return;
    }

    try {
      await analyzeLesson({ data: { lessonId } });
    } catch (e) {
      toast.error((e as Error).message);
    }
    try {
      await prepare({ data: { lessonId, question: question.trim() || title.trim() || "Explain the important concepts in this lesson" } });
    } catch (e) {
      toast.error((e as Error).message);
    }
    await qc.invalidateQueries({ queryKey: ["lessons"] });
    navigate({ to: "/lessons/$lessonId", params: { lessonId } });
  }

  const working = phase !== "idle";
  const captureBusy = working || rec === "recording";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-semibold">{t.newLesson}</h1>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.lessonTitle} />
      <Tabs defaultValue="record" className="card-surface p-4">
        <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="record"><Mic className="size-4" /> {t.recordClass}</TabsTrigger>
          <TabsTrigger value="upload"><FileAudio className="size-4" /> {t.uploadAudio}</TabsTrigger>
          <TabsTrigger value="paste"><NotebookPen className="size-4" /> {t.pasteNotes}</TabsTrigger>
          <TabsTrigger value="document"><NotebookPen className="size-4" /> {t.sourceDocument}</TabsTrigger>
        </TabsList>
        <TabsContent value="record" className="flex flex-col items-center gap-4 py-8">
          <Button variant="secondary"
            onClick={toggleRec}
            disabled={working}
            className={`flex size-24 items-center justify-center rounded-full text-secondary-foreground shadow-lift transition-transform active:scale-95 ${rec === "recording" ? "animate-speaking bg-destructive" : "bg-secondary"}`}
            aria-label={rec === "recording" ? t.stopRecording : t.startRecording}
          >
            {rec === "recording" ? <Square className="size-8" /> : <Mic className="size-9" />}
          </Button>
          <p className="font-display text-2xl tabular-nums">{fmt(seconds)}</p>
          <p className="text-sm text-muted-foreground">{rec === "recording" ? t.stopRecording : t.startRecording}</p>
          <p className="max-w-sm text-center text-xs text-muted-foreground">{t.recordingPrivacy}</p>
        </TabsContent>
        <TabsContent value="upload" className="py-8 text-center">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-6 py-8 text-sm text-muted-foreground hover:bg-muted">
            <FileAudio className="size-5" /> {t.uploadAudio} (≤ 200 MB)
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              disabled={captureBusy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) addTranscript(f);
                e.target.value = "";
              }}
            />
          </label>
        </TabsContent>
        <TabsContent value="paste" className="pt-3">
          <p className="text-xs text-muted-foreground">{t.pasteHint}</p>
        </TabsContent>
        <TabsContent value="document" className="py-6"><Input type="file" aria-label={t.sourceDocument} accept=".pdf,.docx,.pptx,.txt,.md,.csv" disabled={captureBusy} onChange={async e=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;if(file.size>MAX_DOCUMENT_BYTES){toast.error(t.documentTooLarge);return;}setPhase("transcribing");try{const { extractDocument }=await import("@/lib/document-input");const text=await extractDocument(file);setNotes(n=>(n?n+"\n\n":"")+text);}catch(err){toast.error((err as Error).message);}finally{setPhase("idle");}}}/></TabsContent>
      </Tabs>

      <div className="space-y-2">
        <label className="text-sm font-medium">{t.transcript}</label>
        <Textarea rows={10} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.pasteHint} />
      </div>
      <Input value={question} onChange={e=>setQuestion(e.target.value)} placeholder={t.videoPlaceholder} maxLength={500} />
      <p className="text-xs text-muted-foreground">{t.filmBilling}</p>
      <p className="border-l-2 border-accent pl-3 text-xs text-muted-foreground">{t.demoCreditsNotice}</p>

      <Button size="lg" className="w-full rounded-xl" disabled={captureBusy || notes.trim().length < 20} onClick={analyze}>
        {working && <Loader2 className="size-4 animate-spin" />}
        {phase === "transcribing" ? t.transcribing : phase === "analyzing" ? t.analyzing : t.videoMake}
      </Button>
    </div>
  );
}
