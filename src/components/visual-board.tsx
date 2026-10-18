import { ChevronLeft, ChevronRight, Presentation } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { MessageResponse } from "@/components/ai-elements/message";
import { BoardScene } from "@/components/board-scene";
import { useI18n } from "@/lib/i18n";
import type { BoardCard } from "@/lib/learning.server";

const at = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

/** Hand-drawn rough box drawn stroke by stroke. */
function SketchBox({ delay, className }: { delay: number; className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
    >
      <path
        d="M3,5 Q30,2 60,4 T97,3 Q99,20 96,37 Q60,39 30,36 T4,37 Q1,20 3,5"
        pathLength={1}
        fill="none"
        strokeWidth={2.2}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        className={`chalk-stroke ${className}`}
        style={at(delay)}
      />
    </svg>
  );
}

function ChalkArrow({ delay }: { delay: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 40 20" className="h-5 w-9 shrink-0 overflow-visible">
      <path
        d="M2,11 Q20,7 36,10 M28,4 L37,10 L28,16"
        pathLength={1}
        fill="none"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="chalk-stroke stroke-chalk-yellow"
        style={at(delay)}
      />
    </svg>
  );
}

export function VisualBoard({
  cards,
  index,
  onIndex,
  loading,
  teacher,
  chalkOnly = false,
}: {
  cards: BoardCard[];
  index: number;
  onIndex: (i: number) => void;
  loading: boolean;
  teacher?: ReactNode;
  chalkOnly?: boolean;
}) {
  const { t } = useI18n();
  const card = cards[index];
  let d = 0;
  const next = (step: number) => (d += step);
  return (
    <section className="chalkboard relative flex min-h-[34rem] flex-col overflow-hidden rounded-lg p-5 pb-48 text-chalk">
      {teacher}
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold opacity-80">
          <Presentation className="size-4" />
          {t.board}
        </h2>
        {cards.length > 0 && (
          <div className="flex items-center gap-1 text-xs">
            <Button
              size="icon"
              variant="ghost"
              aria-label={t.boardPrev}
              disabled={index === 0}
              onClick={() => onIndex(index - 1)}
            >
              <ChevronLeft />
            </Button>
            {index + 1} / {cards.length}
            <Button
              size="icon"
              variant="ghost"
              aria-label={t.boardNext}
              disabled={index >= cards.length - 1}
              onClick={() => onIndex(index + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        )}
      </header>
      {!card ? (
        <p className="m-auto max-w-xs text-center font-hand text-2xl opacity-70">
          {loading ? t.boardDrawing : t.boardEmpty}
        </p>
      ) : (
        <div key={index} className="space-y-5 font-hand">
          {card.scene && !chalkOnly && (
            <div className="board-pop overflow-hidden rounded-md border-4 border-chalk/80 shadow-lg" style={at(0.1)}>
              <BoardScene scene={card.scene} />
            </div>
          )}
          <div className="inline-block">
            <h3 className="chalk-write text-4xl leading-tight font-bold" style={at(next(0))}>
              {card.title}
            </h3>
            <svg
              aria-hidden="true"
              viewBox="0 0 200 10"
              preserveAspectRatio="none"
              className="h-3 w-full"
            >
              <path
                d="M2,6 Q50,2 100,6 T198,5"
                pathLength={1}
                fill="none"
                strokeWidth={2.5}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className="chalk-stroke stroke-chalk-yellow"
                style={at(next(0.8))}
              />
            </svg>
          </div>
          <ul className="space-y-2">
            {card.points.map((p, i) => (
              <li key={i} className="board-pop flex items-start gap-3 text-2xl leading-snug" style={at(0.3 + i * 0.35)}>
                <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-1.5 size-5 shrink-0">
                  <path
                    d="M10,2 C16,2 18,8 17,12 C15,18 5,18 3,12 C1,7 5,2 11,3"
                    pathLength={1}
                    fill="none"
                    strokeWidth={2}
                    className="chalk-stroke stroke-chalk-blue"
                    style={at(next(0.6))}
                  />
                </svg>
                <span className="chalk-write" style={at(d + 0.2)}>
                  <MessageResponse>{p}</MessageResponse>
                </span>
              </li>
            ))}
          </ul>
          {card.diagram.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              {card.diagram.map((label, i) => (
                <span key={i} className="flex items-center gap-2">
                  <span className="relative px-4 py-2 text-xl">
                    <SketchBox delay={next(0.6)} className="stroke-chalk" />
                    <span className="chalk-write relative" style={at(d + 0.4)}>
                      {label}
                    </span>
                  </span>
                  {i < card.diagram.length - 1 && <ChalkArrow delay={next(0.5)} />}
                </span>
              ))}
            </div>
          )}
          {card.formula.trim() && (
            <div className="relative overflow-x-auto px-5 py-3 text-center text-chalk-yellow">
              <SketchBox delay={next(0.7)} className="stroke-chalk-yellow" />
              <div className="chalk-write relative font-sans" style={at(d + 0.4)}>
                <MessageResponse>{`$$${card.formula}$$`}</MessageResponse>
              </div>
            </div>
          )}
          {card.analogy.trim() && (
            <p className="flex items-start gap-2 text-2xl text-chalk-pink">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7 shrink-0">
                <path
                  d="M12,3 C7,3 5,7 6,10 C7,13 9,13 9,17 L15,17 C15,13 17,13 18,10 C19,7 17,3 12,3 M10,20 L14,20"
                  pathLength={1}
                  fill="none"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  className="chalk-stroke stroke-chalk-pink"
                  style={at(next(0.7))}
                />
              </svg>
              <span className="chalk-write" style={at(d + 0.3)}>
                {card.analogy}
              </span>
            </p>
          )}
          {loading && <p className="text-lg opacity-60">{t.boardDrawing}</p>}
        </div>
      )}
    </section>
  );
}
