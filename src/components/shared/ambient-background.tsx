"use client";

import { cn } from "@/utils";

interface AmbientBackgroundProps {
  intensity?: "soft" | "vivid";
  className?: string;
}

export default function AmbientBackground({
  intensity = "soft",
  className,
}: AmbientBackgroundProps) {
  const glowOpacity =
    intensity === "vivid"
      ? "opacity-65 dark:opacity-35"
      : "opacity-45 dark:opacity-25";

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden",
        className,
      )}
    >
      {/* Top-start warm orange-red radial aura */}
      <div
        className={cn(
          "absolute -top-36 -inset-s-36 size-[480px] rounded-full blur-3xl transition-opacity duration-500",
          glowOpacity,
        )}
        style={{
          background:
            "radial-gradient(circle, rgba(255, 69, 0, 0.28) 0%, rgba(255, 112, 67, 0.1) 45%, transparent 72%)",
        }}
      />

      {/* Bottom-end restrained gold radial aura */}
      <div
        className={cn(
          "absolute -bottom-44 -inset-e-36 size-[520px] rounded-full blur-3xl transition-opacity duration-500",
          glowOpacity,
        )}
        style={{
          background:
            "radial-gradient(circle, rgba(198, 146, 20, 0.2) 0%, rgba(255, 69, 0, 0.08) 50%, transparent 72%)",
        }}
      />

      {/* Subtle architectural dot grid */}
      <div
        className="absolute inset-0 opacity-[0.22] dark:opacity-[0.1]"
        style={{
          backgroundImage:
            "radial-gradient(var(--ln-border-strong) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage:
            "radial-gradient(ellipse at center, black 35%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 35%, transparent 80%)",
        }}
      />
    </div>
  );
}
