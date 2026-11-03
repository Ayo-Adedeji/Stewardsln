"use client";

import { Link } from "@/i18n/navigation";
import { cn } from "@/utils";
import Image from "next/image";

interface BrandLogoProps {
  collapsed?: boolean;
  href?: string;
  size?: "sm" | "md" | "lg";
  badge?: string;
  className?: string;
}

export default function BrandLogo({
  collapsed = false,
  href = "/",
  size = "md",
  badge,
  className,
}: BrandLogoProps) {
  const iconDimensions = size === "sm" ? 30 : size === "lg" ? 40 : 34;

  const content = (
    <div
      className={cn(
        "inline-flex min-w-0 items-center gap-2.5 select-none",
        collapsed && "justify-center",
        className,
      )}
    >
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl",
          size === "sm" && "size-7.5",
          size === "md" && "size-8.5",
          size === "lg" && "size-10",
        )}
      >
        <Image
          src="/images/brand/light-nation-mark.png"
          alt="Light Nation Ibadan Logo"
          width={iconDimensions}
          height={iconDimensions}
          className="size-full object-contain"
          priority
        />
      </div>

      {!collapsed && (
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 flex-col justify-center leading-none">
            <span
              className={cn(
                "truncate font-extrabold tracking-[0.02em] text-(--ln-fg-primary) uppercase",
                size === "sm" && "text-[13px]",
                size === "md" && "text-sm",
                size === "lg" && "text-base",
              )}
            >
              LIGHT NATION
            </span>
            <span
              className={cn(
                "mt-0.5 truncate font-semibold tracking-[0.16em] text-(--ln-fg-muted) uppercase",
                size === "sm" && "text-[9px]",
                size === "md" && "text-[10px]",
                size === "lg" && "text-[11px]",
              )}
            >
              IBADAN
            </span>
          </div>

          {badge && (
            <span className="rounded-full border border-brand-500/30 bg-brand-500/12 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-brand-600 uppercase dark:text-brand-400">
              {badge}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link
      href={href}
      className="inline-flex max-w-full items-center rounded-lg focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-hidden"
    >
      {content}
    </Link>
  );
}
