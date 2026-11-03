"use client";

import { cn } from "@/utils";
import type React from "react";

interface MotionContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  delayMs?: number;
  children: React.ReactNode;
}

export function FadeIn({
  delayMs = 0,
  className,
  style,
  children,
  ...props
}: MotionContainerProps) {
  return (
    <div
      style={{
        animationDelay: delayMs ? `${delayMs}ms` : undefined,
        animationFillMode: "both",
        ...style,
      }}
      className={cn(
        "animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out motion-reduce:animate-none",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function ScaleIn({
  delayMs = 0,
  className,
  style,
  children,
  ...props
}: MotionContainerProps) {
  return (
    <div
      style={{
        animationDelay: delayMs ? `${delayMs}ms` : undefined,
        animationFillMode: "both",
        ...style,
      }}
      className={cn(
        "animate-in fade-in zoom-in-95 duration-250 ease-out motion-reduce:animate-none",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
