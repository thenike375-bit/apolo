import { ApolloPuppet } from "@/components/apollo-puppet";
import { cn } from "@/lib/utils";

export function TeacherAvatar({
  size = 40,
  speaking = false,
  level = 0,
  className,
}: {
  size?: number;
  speaking?: boolean;
  level?: number;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label="Apollo, your AI teacher"
      style={{ width: size, height: size }}
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
    >
      <ApolloPuppet
        action={speaking ? "point" : "idle"}
        level={level}
        mood={speaking ? "talking" : "happy"}
        className={`size-full ${speaking && level === 0 ? "animate-speaking" : ""}`}
      />
    </span>
  );
}

export function SunMark({ size = 32 }: { size?: number }) {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      {rays.map((r) => (
        <path key={r} d="M50 4 L55 20 L45 20 Z" transform={`rotate(${r} 50 50)`} style={{ fill: "var(--apollo-ray)" }} />
      ))}
      <circle cx="50" cy="50" r="27" style={{ fill: "var(--apollo-sun)" }} />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center", className)} aria-label="PostFactum">
      <SunMark size={36} />
    </span>
  );
}
