import { useEffect, useRef, useState } from "react";
import wasm from "@/assets/vision/vision_wasm_internal.wasm.asset.json";
import { cn } from "@/lib/utils";

type Pt = { x: number; y: number };

/**
 * Turns a still teacher photo into a live "video call" face: finds the face landmarks once
 * (on-device), then animates jaw/mouth from the live audio level, blinks, breathes and nods.
 */
export function TalkingPortrait({
  src,
  level,
  listening,
  className,
}: {
  src: string;
  level: number;
  listening: boolean;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const levelRef = useRef(level);
  levelRef.current = level;
  const listeningRef = useRef(listening);
  listeningRef.current = listening;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    let lm: Pt[] | null = null;
    let skin: string[] = [];

    async function findFace() {
      try {
        const { FaceLandmarker } = await import("@mediapipe/tasks-vision");
        const det = await FaceLandmarker.createFromOptions(
          { wasmLoaderPath: "/vision/wasm/vision_wasm_internal.js", wasmBinaryPath: wasm.url },
          {
            baseOptions: { modelAssetPath: "/vision/face_landmarker.task" },
            runningMode: "IMAGE",
            numFaces: 1,
          },
        );
        const res = det.detect(img);
        det.close();
        return res.faceLandmarks?.[0] ?? null;
      } catch {
        return null;
      }
    }

    img.onload = async () => {
      const c = canvas.current;
      if (!c || cancelled) return;
      const scale = Math.min(1, 720 / img.naturalWidth);
      const W = (c.width = Math.round(img.naturalWidth * scale));
      const H = (c.height = Math.round(img.naturalHeight * scale));
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, W, H);
      setReady(true);
      const found = await findFace();
      if (cancelled) return;
      if (found) {
        lm = found.map((p) => ({ x: p.x * W, y: p.y * H }));
        // sample eyelid skin tone just above each eye
        try {
          const base = document.createElement("canvas");
          base.width = W;
          base.height = H;
          const b = base.getContext("2d")!;
          b.drawImage(img, 0, 0, W, H);
          skin = [159, 386].map((i) => {
            const p = lm![i]!;
            const d = b.getImageData(
              Math.round(p.x) - 2,
              Math.round(p.y - H * 0.012) - 2,
              4,
              4,
            ).data;
            let r = 0,
              g = 0,
              bl = 0;
            for (let k = 0; k < d.length; k += 4) {
              r += d[k]!;
              g += d[k + 1]!;
              bl += d[k + 2]!;
            }
            const n = d.length / 4;
            return `rgb(${r / n},${g / n},${bl / n})`;
          });
        } catch {
          skin = [];
        }
      }
      let open = 0;
      let nextBlink = performance.now() + 2000;
      let blinkStart = -1;
      const P = (i: number) => lm![i]!;
      const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

      const draw = (t: number) => {
        if (cancelled) return;
        const lvl = levelRef.current;
        open += ((lvl > 0.03 ? lvl : 0) - open) * (lvl > open ? 0.55 : 0.25);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, W, H);
        const tilt =
          Math.sin(t / 1900) * 0.008 +
          (listeningRef.current ? 0.02 : 0) +
          open * Math.sin(t / 230) * 0.01;
        const bob = Math.sin(t / 1400) * H * 0.003 + open * Math.sin(t / 180) * H * 0.004;
        const breathe = 1.02 + Math.sin(t / 2100) * 0.004;
        ctx.translate(W / 2, H * 0.95);
        ctx.rotate(tilt);
        ctx.scale(breathe, breathe);
        ctx.translate(-W / 2, -H * 0.95 + bob);
        ctx.drawImage(img, 0, 0, W, H);

        if (lm) {
          const l = P(61),
            r = P(291),
            top = P(13),
            bot = P(14),
            chin = P(152);
          const mw = dist(l, r);
          const gap = open * mw * 0.32 * (0.8 + 0.2 * Math.sin(t / 60));
          if (gap > 0.6) {
            const cx = (l.x + r.x) / 2;
            const cy = (top.y + bot.y) / 2;
            ctx.save();
            ctx.fillStyle = "rgb(45,14,20)";
            ctx.beginPath();
            ctx.ellipse(cx, cy + gap / 2, mw * 0.4, gap / 2 + 1, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "rgba(240,235,225,0.85)";
            ctx.beginPath();
            ctx.ellipse(cx, cy + 1, mw * 0.3, Math.min(gap * 0.18, mw * 0.05), 0, 0, Math.PI);
            ctx.fill();
            ctx.restore();
            // shift the jaw down by `gap`
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(
              cx,
              (cy + chin.y) / 2 + mw * 0.05,
              mw * 1.1,
              (chin.y - cy) / 2 + mw * 0.3,
              0,
              0,
              Math.PI * 2,
            );
            ctx.clip();
            ctx.beginPath();
            ctx.rect(0, cy + gap, W, H);
            ctx.clip();
            ctx.drawImage(img, 0, gap, W, H);
            ctx.restore();
          }
          // blink
          if (blinkStart < 0 && t > nextBlink) blinkStart = t;
          if (blinkStart >= 0) {
            const p = (t - blinkStart) / 170;
            if (p >= 1) {
              blinkStart = -1;
              nextBlink = t + 2200 + Math.random() * 3500;
              if (Math.random() < 0.15) nextBlink = t + 250;
            } else {
              const k = Math.sin(Math.PI * p);
              [
                [159, 145, 33, 133],
                [386, 374, 362, 263],
              ].forEach(([u, d, a, b], i) => {
                const up = P(u!),
                  low = P(d!),
                  ea = P(a!),
                  eb = P(b!);
                const ew = dist(ea, eb);
                const eh = Math.max(dist(up, low), ew * 0.15);
                const cx = (ea.x + eb.x) / 2;
                const lidBottom = up.y - eh * 0.3 + eh * 1.5 * k;
                ctx.save();
                ctx.filter = "blur(1.5px)";
                ctx.fillStyle = skin[i] ?? "rgb(200,160,140)";
                ctx.beginPath();
                ctx.ellipse(
                  cx,
                  (up.y - eh * 0.5 + lidBottom) / 2,
                  ew * 0.62,
                  Math.max(1, (lidBottom - up.y + eh * 0.5) / 2),
                  0,
                  0,
                  Math.PI * 2,
                );
                ctx.fill();
                ctx.strokeStyle = "rgba(40,25,20,0.7)";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.ellipse(cx, lidBottom - eh * 0.2, ew * 0.5, eh * 0.2, 0, 0, Math.PI);
                ctx.stroke();
                ctx.restore();
              });
            }
          }
        }
        raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
    };
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [src]);

  return (
    <canvas
      ref={canvas}
      aria-label="AI teacher"
      role="img"
      className={cn(
        "h-full w-full object-cover transition-opacity",
        ready ? "opacity-100" : "opacity-0",
        className,
      )}
    />
  );
}
