import { Spinner } from "@/components/ui/spinner";
import { ArrowLeftIcon, ArrowRightIcon } from "@/icons";
import { cn } from "@/utils";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const buttonVariants = cva(
  "group/button relative isolate inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap select-none outline-none focus-visible:ring-3 focus-visible:ring-brand-500/30 focus-visible:outline-hidden active:not-aria-[haspopup]:scale-[0.985] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-invalid:border-red-500 aria-invalid:ring-3 aria-invalid:ring-red-500/20 dark:aria-invalid:border-red-500/50 dark:aria-invalid:ring-red-500/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-300 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-brand-500 text-white shadow-theme-xs hover:border-transparent hover:text-white hover:shadow-theme-sm dark:bg-brand-500 dark:text-white",
        "brand-outline":
          "border-brand-500/45 bg-(--ln-surface-warm) text-brand-800 shadow-theme-xs hover:border-brand-500/80 hover:text-brand-950 hover:shadow-theme-sm dark:border-brand-400/50 dark:text-brand-200 dark:hover:border-brand-400 dark:hover:text-white",
        outline:
          "border-(--ln-border) bg-(--ln-surface) font-medium text-(--ln-fg-primary) shadow-theme-xs hover:border-(--ln-border-strong) hover:text-(--ln-fg-primary) hover:shadow-theme-sm",
        secondary:
          "border-(--ln-border) bg-(--ln-surface-warm) font-medium text-(--ln-fg-primary) hover:border-(--ln-border-strong) hover:text-(--ln-fg-primary)",
        ghost:
          "border-transparent bg-transparent font-medium text-(--ln-fg-secondary) hover:text-(--ln-fg-primary)",
        destructive:
          "bg-red-600 text-white shadow-theme-xs hover:text-white hover:shadow-theme-sm focus-visible:ring-red-500/30 dark:bg-red-600",
        link: "h-auto! rounded-none border-none bg-transparent! p-0! font-semibold text-brand-600 underline-offset-4 hover:text-brand-700 hover:underline dark:text-brand-400 dark:hover:text-brand-300",
      },
      size: {
        default: "h-10 gap-2 rounded-xl px-4 py-2.5",
        xs: "h-8 gap-1.5 rounded-lg px-3 py-1.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-9 gap-1.5 rounded-xl px-3.5 py-2 text-xs [&_svg:not([class*='size-'])]:size-4",
        lg: "h-11 gap-2.5 rounded-xl px-5 py-3 text-sm sm:text-base",
        icon: "size-10 rounded-xl",
        "icon-xs": "size-8 rounded-lg [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-9 rounded-xl [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-11 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends ButtonPrimitive.Props,
    VariantProps<typeof buttonVariants> {
  /** Place a directional forward arrow (→) immediately before the button label */
  leadingArrow?: boolean;
  /** Place a directional forward arrow (→) immediately after the button label */
  trailingArrow?: boolean;
  /** Place a directional back arrow (←) immediately before the button label */
  backArrow?: boolean;
  /** Show a loading spinner and prevent duplicate clicks */
  loading?: boolean;
  /** Optional text to display while loading */
  loadingText?: string;
}

function Button({
  className,
  variant = "default",
  size = "default",
  leadingArrow = false,
  trailingArrow = false,
  backArrow = false,
  loading = false,
  loadingText,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const isIconOnly =
    size === "icon" ||
    size === "icon-xs" ||
    size === "icon-sm" ||
    size === "icon-lg";

  const showSweepFill = variant !== "link";

  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant ?? "default"}
      data-size={size ?? "default"}
      data-icon-only={isIconOnly ? "true" : undefined}
      data-loading={loading ? "true" : undefined}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {/* Background Layer: Left-to-right animated fill strictly behind content */}
      {showSweepFill && (
        <span
          data-slot="button-fill"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit]"
        />
      )}

      {/* Foreground Layer: Button label and icons always above the animated fill */}
      <span
        data-slot="button-content"
        className="relative z-10 inline-flex items-center justify-center gap-[inherit] text-current"
      >
        {loading ? (
          <>
            <Spinner className="size-4 shrink-0" />
            {loadingText ? <span>{loadingText}</span> : children}
          </>
        ) : (
          <>
            {backArrow && (
              <ArrowLeftIcon
                data-slot="button-arrow-back"
                className="size-4 shrink-0 rtl:rotate-180"
              />
            )}
            {leadingArrow && (
              <ArrowRightIcon
                data-slot="button-arrow"
                className="size-4 shrink-0 rtl:rotate-180"
              />
            )}
            {children}
            {trailingArrow && (
              <ArrowRightIcon
                data-slot="button-arrow"
                className="size-4 shrink-0 rtl:rotate-180"
              />
            )}
          </>
        )}
      </span>
    </ButtonPrimitive>
  );
}

export { Button, buttonVariants };
