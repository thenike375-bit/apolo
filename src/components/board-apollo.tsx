import { useEffect, useRef, useState } from "react";
import { type ApolloMood } from "@/lib/avatars";
import { ApolloPuppet } from "./apollo-puppet";

type Gesture = "talking" | "happy" | "thinking" | "cheer" | "reading";

/** Apollo (the real mascot artwork) as narrator: walks with a bouncing gait, leans, squashes with his voice. */
export function BoardApollo({
  mood,
  level,
  writing,
  cardIndex,
  speaking = false,
}: {
  mood: ApolloMood;
  level: number;
  writing: boolean;
  cardIndex: number;
  speaking?: boolean;
}) {
  const [x, setX] = useState(70);
  const [facing, setFacing] = useState<1 | -1>(-1);
  const [walking, setWalking] = useState(false);
  const [gesture, setGesture] = useState<Gesture>("happy");
  const xRef = useRef(x);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const walkTo = (nx: number) => {
    const target = Math.max(0, Math.min(78, nx));
    if (Math.abs(target - xRef.current) < 4) return;
    setFacing(target > xRef.current ? 1 : -1);
    xRef.current = target;
    setX(target);
    setWalking(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setWalking(false), 2200);
  };

  useEffect(() => {
    if (cardIndex < 0) return;
    walkTo(Math.random() * 78);
    setGesture(cardIndex === 0 ? "cheer" : "talking");
  }, [cardIndex]); // eslint-disable-line react-hooks/exhaustive-deps
  const talking = speaking || mood === "talking";
  useEffect(() => {
    const moves: Gesture[] = ["talking", "happy", "thinking", "cheer", "talking"];
    let n = 0;
    const id = setInterval(() => {
      n++;
      if (n % 2) walkTo(Math.random() * 78);
      else setGesture(moves[Math.floor(Math.random() * moves.length)] ?? "talking");
    }, talking ? 1800 : 3200);
    return () => clearInterval(id);
  }, [talking]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(timer.current), []);

  // smooth the voice level for the "speaking" squash
  const [v, setV] = useState(0);
  const target = useRef(0);
  target.current = talking ? Math.min(1, Math.max(0, (level - 0.03) * 3.5)) : 0;
  useEffect(() => {
    let raf = 0;
    let m = 0;
    const tick = () => {
      const t = target.current;
      m += (t - m) * (t > m ? 0.5 : 0.2);
      setV((p) => (Math.abs(p - m) > 0.01 ? m : p));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const pose: ApolloMood = walking ? "happy" : writing ? "reading" : talking ? gesture : mood;
  const anim = walking ? "apollo-gait" : talking ? "apollo-talk-sway" : "apollo-idle-hop";
  return (
    <div className="apollo-walker pointer-events-none absolute bottom-2 z-10 h-[38%] aspect-[200/230]" style={{ left: `${x}%` }}>
      <div className="apollo-turn h-full w-full" style={{ transform: `scaleX(${walking ? -facing : 1})` }}>
        <div className={`${anim} h-full w-full`}>
          <ApolloPuppet className="h-full w-full" mood={mood} level={level} action={walking ? "walk" : writing ? "write" : pose === "thinking" || pose === "caring" ? "think" : pose === "cheer" ? "wave" : talking || pose === "talking" ? "point" : "wave"} />
        </div>
      </div>
      <div className="mx-auto -mt-2 h-2 w-20 rounded-full bg-background/50 blur-sm" />
    </div>
  );
}
