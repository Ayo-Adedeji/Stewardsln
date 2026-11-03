"use client";

import { type ThemeMode, useTheme } from "@/context/theme-context";
import { ContrastIcon, MoonIcon, SunIcon } from "@/icons";
import { cn } from "@/utils";

interface ThemeSelectorProps {
  variant?: "segmented" | "compact";
  className?: string;
}

const THEME_OPTIONS: {
  id: ThemeMode;
  label: string;
  description: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}[] = [
  {
    id: "light",
    label: "Light",
    description: "Clean white surfaces & crisp contrast",
    Icon: SunIcon,
  },
  {
    id: "neutral",
    label: "Neutral",
    description: "Warm stone & restrained contrast",
    Icon: ContrastIcon,
  },
  {
    id: "dark",
    label: "Dark",
    description: "Deep charcoal & low-glare contrast",
    Icon: MoonIcon,
  },
];

export default function ThemeSelector({
  variant = "segmented",
  className,
}: ThemeSelectorProps) {
  const { themeMode, setThemeMode } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Appearance theme selector"
      className={cn("ln-segmented", className)}
    >
      {THEME_OPTIONS.map((option) => {
        const Icon = option.Icon;
        const isActive = themeMode === option.id;

        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={`${option.label} theme`}
            title={`${option.label}: ${option.description}`}
            onClick={() => setThemeMode(option.id)}
            className={cn(
              "group ln-segment-item",
              variant === "compact" && "px-2.5 py-1.25",
              isActive ? "ln-segment-item-active" : "ln-segment-item-inactive",
            )}
          >
            <Icon
              className={cn(
                "size-3.5 shrink-0 transition-transform duration-200 group-hover:scale-110",
                isActive && "text-brand-500 dark:text-brand-400",
              )}
            />
            <span
              className={cn(
                variant === "compact" ? "hidden sm:inline" : "inline",
              )}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
