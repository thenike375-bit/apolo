import { APOLLO_POSES } from "@/lib/avatars";
import { cn } from "@/lib/utils";

export function useTeacherImage() {
  return APOLLO_POSES.talking;
}

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
    <img
      src={APOLLO_POSES.talking}
      alt="Apollo, your AI teacher"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        ...(level > 0
          ? {
              transform: `scale(${1 + level * 0.08})`,
              transition: "transform 60ms linear",
            }
          : {}),
      }}
      className={cn(
        "shrink-0 rounded-full object-cover ring-2 ring-accent/40",
        speaking && level === 0 && "animate-speaking",
        className,
      )}
    />
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
