import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getJudgeExamples } from "@/lib/showcase.functions";

export const Route = createFileRoute("/_app/examples")({
  head: () => ({
    meta: [
      { title: "Examples for Judges — PostFactum" },
      { name: "description", content: "Three films Apollo prepared from real lessons, with the question, source material and video." },
      { property: "og:title", content: "Examples for Judges — PostFactum" },
      { property: "og:description", content: "Three prepared films with their questions and source material." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExamplesPage,
});

function fmt(ms: number) {
  const m = Math.max(1, Math.round(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

function ClipPlayer({ clips }: { clips: { title: string; url: string }[] }) {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLVideoElement>(null);
  const clip = clips[i];
  if (!clip) return <p className="text-sm text-muted-foreground">No footage.</p>;
  return (
    <div className="space-y-2">
      <video ref={ref} src={clip.url} controls preload="auto" playsInline className="aspect-video w-full rounded-xl bg-muted"
        onEnded={() => { if (i + 1 < clips.length) { setI(i + 1); requestAnimationFrame(() => ref.current?.play()); } }} />
      <div className="flex flex-wrap gap-1">
        {clips.map((c, n) => (
          <button key={n} title={c.title} onClick={() => setI(n)}
            className={`size-7 rounded-full text-xs font-medium ${n === i ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>{n + 1}</button>
        ))}
      </div>
    </div>
  );
}

function ExamplesPage() {
  const fetchExamples = useServerFn(getJudgeExamples);
  const { data, isLoading, error } = useQuery({ queryKey: ["judge-examples"], queryFn: () => fetchExamples(), staleTime: 30 * 60 * 1000 });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Examples for Judges</h1>
        <p className="text-sm text-muted-foreground">Each film was made by Apollo from a real lesson and the question the learner asked.</p>
      </div>
      {isLoading && <p className="text-muted-foreground">Loading examples…</p>}
      {error && <p role="alert" className="text-destructive">Examples could not be loaded.</p>}
      {data?.map((ex) => (
        <article key={ex.id} className="card-surface grid gap-5 p-5 lg:grid-cols-[3fr_2fr]">
          <ClipPlayer clips={ex.clips} />
          <div className="space-y-4">
            <div>
              {ex.subject && <span className="text-xs font-medium uppercase tracking-wide text-secondary">{ex.subject}</span>}
              <h2 className="text-xl font-semibold">{ex.title}</h2>
              <p className="text-sm font-semibold text-accent">⏱ Made in {fmt(ex.prepMs)} · {ex.clips.length} clips</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Problem the learner gave</h3>
              <p className="text-sm">“{ex.question}”</p>
            </div>
            <details className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-sm font-semibold">Article / voice transcript</summary>
              <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">{ex.transcript || "—"}</p>
            </details>
            <Button asChild size="sm"><Link to="/lessons/live" search={{ prepared: ex.id }}><Video />Watch with Apollo</Link></Button>
          </div>
        </article>
      ))}
    </div>
  );
}
