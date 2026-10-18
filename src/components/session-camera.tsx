import { DECISION_INTERVAL_MS } from "@/lib/decisions";
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Mic, MicOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import wasm from "@/assets/vision/vision_wasm_internal.wasm.asset.json";
import {
  classifyFrame,
  createCueTracker,
  createFocusTracker,
  focusScore,
  headAngles,
  type FaceCue,
  type FocusBand,
} from "@/lib/face-cues";

export function SessionCamera({
  ended,
  onCue,
  onFocus,
  onSnapshot,
  autoStart = false,
  compact = false,
  lite = false,
  muted = false,
  onMute,
}: {
  ended: boolean;
  onCue?: (cue: FaceCue) => void;
  onFocus?: (band: FocusBand, score: number) => void;
  /** Called every DECISION_INTERVAL_MS with a small JPEG of the current frame. */
  onSnapshot?: (jpeg: string) => void;
  autoStart?: boolean;
  compact?: boolean;
  /** Lighter face tracking while a film is playing, so video decoding stays smooth. */
  lite?: boolean;
  muted?: boolean;
  /** When set, a microphone mute toggle sits next to the camera toggle. */
  onMute?: (() => void) | undefined;
}) {
  const liteRef = useRef(lite);
  liteRef.current = lite;
  const onCueRef = useRef(onCue);
  onCueRef.current = onCue;
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;
  const onSnapshotRef = useRef(onSnapshot);
  onSnapshotRef.current = onSnapshot;
  const [focus, setFocus] = useState<number | null>(null);
  const [cue, setCue] = useState<FaceCue | null>(null);
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const requestVersion = useRef(0);
  const [on, setOn] = useState(false);
  const [blur, setBlur] = useState(false);
  const blurRef = useRef(blur);
  blurRef.current = blur;
  const [loading, setLoading] = useState(false);
  const [presence, setPresence] = useState<"loading" | "visible" | "absent" | "unavailable">(
    "loading",
  );
  const [blurReady, setBlurReady] = useState(false);

  function stop() {
    requestVersion.current++;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setOn(false);
  }
  useEffect(() => {
    if (ended) stop();
  }, [ended]);
  useEffect(() => {
    const exit = () => stop();
    window.addEventListener("pagehide", exit);
    return () => {
      requestVersion.current++;
      stream.current?.getTracks().forEach((track) => track.stop());
      window.removeEventListener("pagehide", exit);
    };
  }, []);

  useEffect(() => {
    if (autoStart && !ended) void toggle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  async function toggle() {
    if (on) {
      stop();
      return;
    }
    const version = ++requestVersion.current;
    setLoading(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      if (version !== requestVersion.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play();
      }
      setPresence("loading");
      setOn(true);
    } catch {
      toast.error(t.cameraDenied);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!on) return;
    const shot = document.createElement("canvas");
    const id = setInterval(() => {
      const v = video.current;
      if (!onSnapshotRef.current || !v || v.readyState < 2 || !v.videoWidth) return;
      shot.width = 320;
      shot.height = Math.round((320 * v.videoHeight) / v.videoWidth);
      shot.getContext("2d")?.drawImage(v, 0, 0, shot.width, shot.height);
      onSnapshotRef.current(shot.toDataURL("image/jpeg", 0.6));
    }, DECISION_INTERVAL_MS);
    return () => clearInterval(id);
  }, [on]);

  useEffect(() => {
    if (!on) return;
    let cancelled = false;
    let frame = 0;
    let last = 0;
    let detector: import("@mediapipe/tasks-vision").FaceLandmarker | undefined;
    const track = createCueTracker((c) => {
      setCue(c);
      onCueRef.current?.(c);
    });
    let smoothFocus = 100;
    let focusShown = 0;
    const trackFocus = createFocusTracker((band) =>
      onFocusRef.current?.(band, Math.round(smoothFocus)),
    );
    let segmenter: import("@mediapipe/tasks-vision").ImageSegmenter | undefined;
    const buffer = document.createElement("canvas");
    const background = document.createElement("canvas");
    async function setup() {
      try {
        const { FaceLandmarker, ImageSegmenter } = await import("@mediapipe/tasks-vision");
        const files = {
          wasmLoaderPath: "/vision/wasm/vision_wasm_internal.js",
          wasmBinaryPath: wasm.url,
        };
        detector = await FaceLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: "/vision/face_landmarker.task" },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        });
        if (cancelled) {
          detector.close();
          return;
        }
        segmenter = await ImageSegmenter.createFromOptions(files, {
          baseOptions: { modelAssetPath: "/vision/selfie.tflite" },
          runningMode: "VIDEO",
          outputCategoryMask: false,
          outputConfidenceMasks: true,
        });
        if (cancelled) {
          segmenter.close();
          return;
        }
        setBlurReady(true);
        function render(now: number) {
          if (cancelled) return;
          const v = video.current;
          const c = canvas.current;
          if (v && c && v.readyState >= 2 && now - last > (liteRef.current ? 2500 : 150)) {
            last = now;
            try {
              const result = detector?.detectForVideo(v, now);
              const cats = result?.faceBlendshapes?.[0]?.categories;
              setPresence(cats ? "visible" : "absent");
              const shapes = cats
                ? Object.fromEntries(cats.map((c) => [c.categoryName, c.score]))
                : null;
              const { yaw, pitch } = headAngles(result?.facialTransformationMatrixes?.[0]?.data);
              track(classifyFrame(shapes, yaw, pitch), now);
              smoothFocus = smoothFocus * 0.9 + focusScore(shapes, yaw, pitch) * 0.1;
              trackFocus(smoothFocus, now);
              if (now - focusShown > 500) {
                focusShown = now;
                setFocus(Math.round(smoothFocus));
              }
              const ctx = c.getContext("2d");
              const bctx = buffer.getContext("2d", { willReadFrequently: true });
              const bgctx = background.getContext("2d");
              // Background segmentation is heavy; only run it when blur is actually on.
              if (ctx && bctx && bgctx && segmenter && blurRef.current) {
                const width = 320,
                  height = 240;
                c.width = buffer.width = background.width = width;
                c.height = buffer.height = background.height = height;
                bctx.drawImage(v, 0, 0, width, height);
                segmenter.segmentForVideo(v, now, (maskResult) => {
                  const mask = maskResult.confidenceMasks?.[0];
                  if (!mask) return;
                  const pixels = bctx.getImageData(0, 0, width, height);
                  const confidence = mask.getAsFloat32Array();
                  for (let y = 0; y < height; y++)
                    for (let x = 0; x < width; x++) {
                      const source =
                        Math.floor((y * mask.height) / height) * mask.width +
                        Math.floor((x * mask.width) / width);
                      pixels.data[(y * width + x) * 4 + 3] = Math.round(
                        (confidence[source] ?? 0) * 255,
                      );
                    }
                  bctx.putImageData(pixels, 0, 0);
                  bgctx.filter = "blur(12px)";
                  bgctx.drawImage(v, -12, -12, width + 24, height + 24);
                  ctx.drawImage(background, 0, 0);
                  ctx.drawImage(buffer, 0, 0);
                });
              }
            } catch {
              setPresence("unavailable");
            }
          }
          frame = requestAnimationFrame(render);
        }
        frame = requestAnimationFrame(render);
      } catch {
        setPresence("unavailable");
        setBlurReady(false);
      }
    }
    void setup();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      detector?.close();
      segmenter?.close();
      setBlurReady(false);
    };
  }, [on]);

  return (
    <div className="flex flex-col">
      <div
        className={`relative ${compact ? "aspect-video" : "aspect-[4/3]"} overflow-hidden rounded-lg border border-border bg-muted/25`}
      >
        <video
          ref={video}
          muted
          playsInline
          className={`absolute inset-0 h-full w-full -scale-x-100 object-cover ${!on || (blur && blurReady) ? "invisible" : ""}`}
        />
        <canvas
          ref={canvas}
          className={`absolute inset-0 h-full w-full -scale-x-100 object-cover ${on && blur && blurReady ? "" : "invisible"}`}
        />
        {!on && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center ${compact ? "gap-1.5" : "gap-3"} text-muted-foreground`}>
            <CameraOff className={compact ? "size-5" : "size-10"} />
            <span className={compact ? "text-[10px]" : ""}>{t.cameraOff}</span>
            <Button variant="outline" size={compact ? "sm" : "default"} className={compact ? "h-6 px-2 text-[10px]" : ""} disabled={loading} onClick={toggle}>
              {t.cameraOn}
            </Button>
          </div>
        )}
        {!compact && (
          <span className="absolute bottom-3 left-3 rounded bg-background/80 px-2 py-1 text-xs">
            {t.you}
          </span>
        )}
      </div>
      <div className={`${compact ? "mt-1" : "mt-3"} flex items-center justify-between gap-2`}>
        {!compact && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ShieldCheck className="size-3 text-accent" />
            {t.cameraLocal}
          </span>
        )}
        <div className={`flex ${compact ? "ml-auto gap-1" : "gap-2"}`}>
          <Button
            size="icon"
            variant="outline"
            className={compact ? "size-6 [&_svg]:size-3" : ""}
            title={on ? t.cameraOff : t.cameraOn}
            aria-label={on ? t.cameraOff : t.cameraOn}
            disabled={loading}
            onClick={toggle}
          >
            {on ? <Camera /> : <CameraOff />}
          </Button>
          {onMute && (
            <Button
              size="icon"
              variant={muted ? "secondary" : "outline"}
              className={compact ? "size-6 [&_svg]:size-3" : ""}
              title={muted ? "Unmute microphone" : "Mute microphone"}
              aria-label={muted ? "Unmute microphone" : "Mute microphone"}
              aria-pressed={muted}
              onClick={onMute}
            >
              {muted ? <MicOff /> : <Mic />}
            </Button>
          )}
          <Button
            size="sm"
            variant={blur ? "secondary" : "outline"}
            className={compact ? "h-6 px-1.5 text-[9px]" : ""}
            aria-pressed={blur}
            disabled={!on || !blurReady}
            onClick={() => setBlur(!blur)}
          >
            {t.blurBackground}
          </Button>
        </div>
      </div>
      {on && focus !== null && (
        <div className={`${compact ? "mt-1 text-[9px]" : "mt-2 text-xs"}`}>
          <div className="mb-0.5 flex justify-between text-muted-foreground">
            <span>{t.focusLevel}</span>
            <span className="font-semibold text-foreground">{focus}%</span>
          </div>
          <div className={`${compact ? "h-1" : "h-1.5"} overflow-hidden rounded-full bg-muted`}>
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${focus >= 70 ? "bg-accent" : focus >= 40 ? "bg-secondary" : "bg-destructive"}`}
              style={{ width: `${focus}%` }}
            />
          </div>
        </div>
      )}
      {!compact && <p className="mt-2 text-xs text-muted-foreground">{t.presenceNotice}</p>}
    </div>
  );
}
