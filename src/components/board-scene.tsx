import type { CSSProperties, ReactNode } from "react";
import type { BoardCard } from "@/lib/learning.server";
import { SceneModel } from "./scene-model";

type Scene = BoardCard["scene"] & { shot?: string };

/** Animated backdrop: sky, ground/sea and ambient motion drawn in SVG for each setting. */
function Backdrop({ setting }: { setting: Scene["setting"] }) {
  const sea = setting === "ocean";
  const sky = setting === "space" || setting === "night" ? "film-sky-night" : `film-sky-${setting}`;
  return (
    <div aria-hidden="true" className={`absolute inset-0 ${sky}`}>
      {(setting === "space" || setting === "night") && (
        <div className="film-stars absolute inset-0" />
      )}
      {setting !== "space" && setting !== "night" && (
        <>
          <span className="film-cloud illustrated-cloud absolute top-[10%]" />
          <span className="film-cloud film-cloud-2 illustrated-cloud absolute top-[22%]" />
        </>
      )}
      {setting === "space" && <span className="film-float absolute top-[12%] right-[14%] h-24 w-32"><SceneModel model="planet" /></span>}
      {setting === "night" && <span className="illustrated-moon absolute top-[8%] right-[12%]" />}
      {sea ? (
        <svg viewBox="0 0 400 100" preserveAspectRatio="none" className="absolute bottom-0 h-[42%] w-full">
          <path className="film-wave film-sea-back" d="M0 30 Q25 20 50 30 T100 30 T150 30 T200 30 T250 30 T300 30 T350 30 T400 30 T450 30 T500 30 V100 H0Z" />
          <path className="film-wave film-wave-fast film-sea-front" d="M0 45 Q25 35 50 45 T100 45 T150 45 T200 45 T250 45 T300 45 T350 45 T400 45 T450 45 T500 45 V100 H0Z" />
        </svg>
      ) : setting !== "space" ? (
        <svg viewBox="0 0 400 100" preserveAspectRatio="none" className="absolute bottom-0 h-[30%] w-full">
          <path className={`film-ground-${setting}`} d="M0 30 Q80 10 160 28 T320 22 T400 26 V100 H0Z" />
        </svg>
      ) : null}
      {setting === "city" && (
        <div className="absolute bottom-[24%] left-[20%] flex h-32 w-3/5">{[0,1,2,3].map(i=><SceneModel key={i} model="building" />)}</div>
      )}
      {setting === "nature" && <div className="absolute bottom-[24%] left-[28%] flex h-32 w-2/3">{[0,1,2].map(i=><SceneModel key={i} model="tree" />)}</div>}
      {setting === "lab" && <div className="absolute bottom-[24%] left-[30%] h-36 w-2/5"><SceneModel model="atom" /></div>}
      {setting === "battlefield" && <span className="film-smoke illustrated-cloud absolute bottom-[26%] left-[46%]" />}
    </div>
  );
}

/** One moment of an OverSimplified-style animated film: setting, moving props, cartoon actors, narrator. */
export function BoardScene({
  scene,
  delay = 0,
  narrator,
  subtitle,
  tall,
  paused = false,
}: {
  scene: Scene;
  delay?: number;
  narrator?: ReactNode;
  subtitle?: string | undefined;
  tall?: boolean;
  paused?: boolean;
}) {
  if (!scene) return null;
  const setting = scene.setting ?? "nature";
  const left = scene.actors.filter((a) => a.side === "left");
  const right = scene.actors.filter((a) => a.side === "right");
  void subtitle;
  const actor = (a: Scene["actors"][number], i: number, flip: boolean) => (
    <div
      key={`${a.label}-${i}`}
      className="scene-pop flex flex-col items-center"
      style={{ animationDelay: `${delay + i * 0.5}s` } as CSSProperties}
    >
      <span
        className={`scene-${a.action} h-24 w-28`}
        style={{ transform: flip ? "scaleX(-1)" : undefined }}
        aria-label={a.label}
      >
        <SceneModel model={a.emoji} action={a.action} />
      </span>
    </div>
  );
  return (
    <figure
      className={`educational-film relative w-full overflow-hidden rounded-lg ${paused ? "film-paused" : ""} ${tall ? "aspect-video" : "h-72"}`}
    >
      <div className={`film-camera shot-${scene.shot ?? "wide"} ${paused ? "film-scene-paused" : ""} absolute inset-0`}>
      <Backdrop setting={setting} />
      <div aria-hidden="true" className="film-light pointer-events-none absolute inset-0" />
      {(scene.props ?? []).map((p, i) => (
        <span
          key={`${p.emoji}-${i}`}
          className={`film-prop prop-${p.motion} absolute h-[30%] w-[45%]`}
          style={{ animationDelay: `${delay + i * 0.8}s`, bottom: setting === "ocean" ? "24%" : "28%", top: p.motion === "fly" ? `${12 + i * 10}%` : undefined } as CSSProperties}
        >
           <SceneModel model={p.emoji} />
        </span>
      ))}
      <div className="absolute inset-x-4 bottom-[8%] flex items-end justify-between gap-4">
        <div className="flex items-end gap-3">{left.map((a, i) => actor(a, i, false))}</div>
        {scene.clash && (
          <span className="scene-clash illustrated-impact absolute right-[20%] bottom-[38%] h-8 w-8" style={{ animationDelay: `${delay + 1}s` }}>
          </span>
        )}
        <div className="flex items-end gap-3">{right.map((a, i) => actor(a, i + left.length, true))}</div>
      </div>
      {scene.shot === "cutaway" && <svg viewBox="0 0 600 230" className="absolute left-[8%] top-[23%] w-[84%]" aria-label="Ship compartments progressively filling with water"><path className="model-hull" d="M5 50H590L560 205H50Z"/><path className="model-paper" d="M20 30H578V54H20Z"/>{Array.from({length:8},(_,i)=><g key={i}><rect className="model-metal" x={50+i*62} y="60" width="58" height="132"/><rect className="compartment-water model-water" style={{animationDelay:`${i*1.1}s`}} x={50+i*62} y="60" width="58" height="132"/></g>)}<path className="model-red" d="M562 172l12-15m-6 22l13-16"/></svg>}
      </div>
      <div aria-hidden="true" className="film-vignette pointer-events-none absolute inset-0" />
      {narrator}
    </figure>
  );
}
