import { useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageResponse } from "@/components/ai-elements/message";
import { useI18n } from "@/lib/i18n";

export type StageLine = { role: "user" | "assistant"; text: string };

/** Wraps a lesson stage; in fullscreen the transcript sits in a left column, never over the picture. */
export function FullscreenStage({ lines, children }: { lines: StageLine[]; children: ReactNode }) {
  const { t } = useI18n();
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const sync = () => { if (!document.fullscreenElement) setFull(false); };
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  useEffect(() => {
    if (!full) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") void exit(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [full]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [lines, full]);
  async function enter() {
    setFull(true);
    try { await root.current?.requestFullscreen?.(); } catch { /* CSS fallback stays */ }
  }
  async function exit() {
    setFull(false);
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  }
  return (
    <div ref={root} className={full ? "fixed inset-0 z-50 flex bg-background" : "relative"}>
      {full && (
        <aside className="flex w-[28%] min-w-56 max-w-sm flex-col border-r border-border bg-card">
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">{t.transcript}</h2>
          <div ref={list} className="flex-1 space-y-3 overflow-y-auto p-4">
            {lines.length === 0 && <p className="text-sm text-muted-foreground">{t.transcriptEmpty}</p>}
            {lines.map((l, i) => (
              <div key={i} className={l.role === "user" ? "rounded-lg bg-secondary/15 p-3" : "rounded-lg bg-muted p-3"}>
                <p className={`mb-1 text-xs font-semibold ${l.role === "user" ? "text-secondary" : "text-accent"}`}>{l.role === "user" ? t.you : "Apollo"}</p>
                <div className="text-sm leading-6"><MessageResponse>{l.text}</MessageResponse></div>
              </div>
            ))}
          </div>
        </aside>
      )}
      <div className={full ? "relative flex flex-1 flex-col justify-center overflow-y-auto p-4" : "relative"}>
        <Button type="button" size="icon" variant="outline" className="fixed bottom-4 left-4 z-[60] size-9 rounded-full bg-background/90 shadow-md"
          aria-label={full ? t.exitFullscreen : t.fullscreen} title={full ? t.exitFullscreen : t.fullscreen}
          onClick={() => void (full ? exit() : enter())}>
          {full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </Button>
        {children}
      </div>
    </div>
  );
}
