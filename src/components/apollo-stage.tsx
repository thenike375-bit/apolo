import { useEffect, useRef, useState } from "react";
import { APOLLO_POSES, type ApolloMood } from "@/lib/avatars";

/**
 * Animated Apollo. While talking, the open-mouth pose fades in proportionally to the
 * smoothed live voice level every frame, so the mouth follows syllables and pauses.
 */
export function ApolloStage({
  mood,
  level,
  compact = false,
}: {
  mood: ApolloMood;
  level: number;
  compact?: boolean;
}) {
  const target = useRef(level);
  target.current = level;
  const [mouth, setMouth] = useState(0);
  useEffect(() => {
    let raf = 0;
    let v = 0;
    const tick = () => {
      const t = Math.min(1, Math.max(0, (target.current - 0.03) * 4));
      // fast attack, slower release, like a real jaw
      v += (t - v) * (t > v ? 0.6 : 0.25);
      setMouth((m) => (Math.abs(m - v) > 0.01 ? v : m));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const talking = mood === "talking";
  const base: ApolloMood = talking ? "nudge" : mood;
  const squash = 1 + mouth * 0.06;
  const transform = `scale(${2 - squash}, ${squash}) translateY(${-mouth * 6}px)`;
  return (
    <div className={`apollo-stage ${compact ? "apollo-clear" : ""} relative flex h-full w-full items-center justify-center overflow-hidden`}>
      {!compact && (
        <div
          aria-hidden="true"
          className="apollo-sunburst absolute size-[85%] rounded-full"
          style={{ opacity: 0.35 + level * 0.6, transform: `scale(${1 + level * 0.25})` }}
        />
      )}
      <div className={`${compact ? "" : "apollo-float"} relative h-[86%]`}>
        {(Object.keys(APOLLO_POSES) as ApolloMood[]).map((k) => {
          let opacity = k === base ? 1 : 0;
          if (talking && k === "talking") opacity = mouth;
          return (
            <img
              key={k}
              src={APOLLO_POSES[k]}
              alt={k === base ? "Apollo" : ""}
              className="absolute inset-0 h-full w-full object-contain drop-shadow-lg"
              style={{
                opacity,
                transition: talking ? "none" : "opacity 300ms",
                transform,
                transformOrigin: "50% 90%",
              }}
            />
          );
        })}
        <img src={APOLLO_POSES.talking} alt="" className="invisible h-full" />
      </div>
    </div>
  );
}
