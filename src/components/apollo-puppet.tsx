import { useEffect, useRef, useState, useId } from "react";
import type { ApolloMood } from "@/lib/avatars";

export type PuppetAction = "idle" | "wave" | "point" | "cheer" | "walk" | "think" | "write";

/**
 * Apollo drawn entirely in code (SVG rig): body, rays, eyes, mouth, two jointed arms and feet.
 * Each limb rotates around its own joint, so waving / pointing / walking are real animations,
 * not swapped pictures. The mouth opens with the live voice level.
 */
export function ApolloPuppet({
  action = "idle",
  level = 0,
  className = "",
  mood = "happy",
}: {
  action?: PuppetAction;
  level?: number;
  className?: string;
  mood?: ApolloMood;
}) {
  const [mouth, setMouth] = useState(0);
  const target = useRef(0);
  target.current = Math.min(1, Math.max(0, (level - 0.03) * 3.5));
  useEffect(() => {
    let raf = 0;
    let m = 0;
    const tick = () => {
      const t = target.current;
      m += (t - m) * (t > m ? 0.55 : 0.22);
      setMouth((prev) => (Math.abs(prev - m) > 0.01 ? m : prev));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const rays = Array.from({ length: 12 }, (_, i) => i * 30);
  const unique = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 200 230" className={`apollo-puppet puppet-${action} expression-${mood} ${className}`} aria-label="Apollo">
      <defs>
        <radialGradient id={`${unique}-body`} cx="35%" cy="28%" r="75%"><stop stopColor="var(--mascot-highlight)"/><stop offset=".6" stopColor="var(--mascot-body)"/><stop offset="1" stopColor="var(--mascot-shadow)"/></radialGradient>
        <linearGradient id={`${unique}-ray`} x2="1" y2="1"><stop stopColor="var(--mascot-highlight)"/><stop offset="1" stopColor="var(--apollo-ray)"/></linearGradient>
      </defs>
      <g className="puppet-body">
        {/* feet */}
        <g className="puppet-foot-l">
          <ellipse cx="80" cy="212" rx="16" ry="8" style={{ fill: "var(--apollo-ink)" }} />
        </g>
        <g className="puppet-foot-r">
          <ellipse cx="120" cy="212" rx="16" ry="8" style={{ fill: "var(--apollo-ink)" }} />
        </g>
        <line x1="85" y1="160" x2="80" y2="206" strokeWidth="7" strokeLinecap="round" style={{ stroke: "var(--apollo-ink)" }} />
        <line x1="115" y1="160" x2="120" y2="206" strokeWidth="7" strokeLinecap="round" style={{ stroke: "var(--apollo-ink)" }} />

        {/* rays */}
        <g className="puppet-rays" style={{ transformOrigin: "100px 100px" }}>
          {rays.map((r) => (
            <path key={r} d="M91 42Q81 26 98 10Q104 1 112 23Q118 35 109 44Z" transform={`rotate(${r} 100 100)`} fill={`url(#${unique}-ray)`} />
          ))}
        </g>

        {/* left arm (viewer's left) — shoulder joint at 50,110 */}
        <g className="puppet-arm-l" style={{ transformOrigin: "52px 110px" }}>
          <path d="M52 110 Q30 120 24 140" fill="none" strokeWidth="8" strokeLinecap="round" style={{ stroke: "var(--apollo-ink)" }} />
          <circle cx="23" cy="143" r="9" style={{ fill: "var(--apollo-sun)", stroke: "var(--apollo-ink)" }} strokeWidth="3" />
        </g>
        {/* right arm — waving / pointing arm, shoulder at 148,110, elbow joint inside */}
        <g className="puppet-arm-r" style={{ transformOrigin: "148px 110px" }}>
          <path d="M148 110 L168 124" fill="none" strokeWidth="8" strokeLinecap="round" style={{ stroke: "var(--apollo-ink)" }} />
          <g className="puppet-forearm-r" style={{ transformOrigin: "168px 124px" }}>
            <path d="M168 124 L178 146" fill="none" strokeWidth="8" strokeLinecap="round" style={{ stroke: "var(--apollo-ink)" }} />
            <circle cx="179" cy="149" r="9" style={{ fill: "var(--apollo-sun)", stroke: "var(--apollo-ink)" }} strokeWidth="3" />
             {action === "write" && <g className="puppet-chalk"><rect x="176" y="137" width="6" height="22" rx="2" fill="var(--chalk)" transform="rotate(-20 179 149)" /><path d="M178 159l-3 4m8-2 2 4" stroke="var(--chalk)" strokeWidth="1" fill="none" /></g>}
          </g>
        </g>

        {/* head / sun body */}
        <g className="puppet-head" style={{ transformOrigin: "100px 150px" }}>
          <circle cx="100" cy="100" r="58" fill={`url(#${unique}-body)`} />
          <path d={mood === "caring" ? "M72 73Q80 72 89 64M112 64Q120 72 128 73" : mood === "thinking" || mood === "nudge" ? "M72 73Q80 64 89 65M112 70Q120 66 128 70" : mood === "cheer" ? "M72 68Q80 60 89 65M112 65Q120 60 128 68" : "M73 72Q80 64 89 69M112 69Q120 64 128 72"} className="mascot-brow" />
          <ellipse cx="68" cy="116" rx="9" ry="6" style={{ fill: "var(--apollo-cheek)" }} opacity="0.7" />
          <ellipse cx="132" cy="116" rx="9" ry="6" style={{ fill: "var(--apollo-cheek)" }} opacity="0.7" />
          <g className="puppet-eyes" style={{ transformOrigin: "100px 92px" }}>
            <ellipse cx="80" cy="92" rx="11" ry={mood === "cheer" ? 10 : mood === "caring" ? 13 : 16} style={{ fill: "var(--mascot-eye)" }} />
            <ellipse cx="120" cy="92" rx="11" ry={mood === "cheer" ? 10 : 16} style={{ fill: "var(--mascot-eye)" }} />
            <g className="puppet-gaze"><circle cx={mood === "thinking" ? 78 : 84} cy="86" r="4" style={{ fill: "var(--mascot-highlight)" }} />
            <circle cx={mood === "thinking" ? 118 : 124} cy="86" r="4" style={{ fill: "var(--mascot-highlight)" }} /></g>
          </g>
          {/* mouth: smile when quiet, opens with voice */}
          {mouth < 0.08 ? (
            <path d={mood === "thinking" || mood === "listening" ? "M90 124 Q100 128 110 124" : mood === "caring" ? "M86 123 Q100 131 114 123" : "M84 120 Q100 134 116 120"} fill="none" strokeWidth="4" strokeLinecap="round" style={{ stroke: "var(--apollo-ink)" }} />
          ) : (
            <ellipse cx="100" cy={124} rx={10 + mouth * 4} ry={3 + mouth * 11} style={{ fill: "var(--apollo-ink)" }} />
          )}
        </g>
      </g>
    </svg>
  );
}
