import { cn } from "@/utils";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1.5 font-medium whitespace-nowrap transition-colors select-none [&>svg]:pointer-events-none [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        light: "",
        solid: "",
        ghost: "bg-transparent",
      },
      color: {
        primary: "",
        success: "",
        error: "",
        warning: "",
        info: "",
        gray: "",
        light: "",
        dark: "",
      },
      size: {
        sm: "h-5.5 rounded-md px-2 py-0.5 text-xs [&:has(>svg:first-child)]:ps-1.5 [&:has(>svg:last-child)]:pe-1.5 [&>svg]:size-3",
        default:
          "h-6 rounded-md px-2.5 py-0.5 text-xs [&:has(>svg:first-child)]:ps-2 [&:has(>svg:last-child)]:pe-2 [&>svg]:size-3.5",
        lg: "h-7 rounded-lg px-3 py-1 text-sm [&:has(>svg:first-child)]:ps-2.5 [&:has(>svg:last-child)]:pe-2.5 [&>svg]:size-3.5",
      },
    },
    compoundVariants: [
      {
        variant: "ghost",
        className:
          "px-0 py-0 [&:has(>svg:first-child)]:ps-0 [&:has(>svg:last-child)]:pe-0",
      },
      // Primary (Deep Church Red)
      {
        variant: "light",
        color: "primary",
        className:
          "border border-brand-200/70 bg-brand-50 text-brand-700 neutral:border-brand-300/60 neutral:bg-brand-500/12 neutral:text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300",
      },
      {
        variant: "solid",
        color: "primary",
        className: "bg-brand-600 text-white dark:bg-brand-500",
      },
      {
        variant: "ghost",
        color: "primary",
        className: "text-brand-600 dark:text-brand-400",
      },
      // Success
      {
        variant: "light",
        color: "success",
        className:
          "border border-emerald-200/80 bg-emerald-50 text-emerald-700 neutral:border-emerald-600/25 neutral:bg-emerald-500/12 neutral:text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400",
      },
      {
        variant: "solid",
        color: "success",
        className: "bg-emerald-600 text-white",
      },
      {
        variant: "ghost",
        color: "success",
        className: "text-emerald-600 dark:text-emerald-400",
      },
      // Error
      {
        variant: "light",
        color: "error",
        className:
          "border border-red-200/80 bg-red-50 text-red-700 neutral:border-red-600/25 neutral:bg-red-500/12 neutral:text-red-800 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-400",
      },
      {
        variant: "solid",
        color: "error",
        className: "bg-red-600 text-white",
      },
      {
        variant: "ghost",
        color: "error",
        className: "text-red-600 dark:text-red-400",
      },
      // Warning (Restrained Gold / Amber)
      {
        variant: "light",
        color: "warning",
        className:
          "border border-amber-200/90 bg-amber-50 text-amber-800 neutral:border-amber-600/25 neutral:bg-amber-500/15 neutral:text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
      },
      {
        variant: "solid",
        color: "warning",
        className: "bg-amber-600 text-white",
      },
      {
        variant: "ghost",
        color: "warning",
        className: "text-amber-700 dark:text-amber-400",
      },
      // Info
      {
        variant: "light",
        color: "info",
        className:
          "border border-sky-200/80 bg-sky-50 text-sky-700 neutral:border-sky-600/25 neutral:bg-sky-500/12 neutral:text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-300",
      },
      {
        variant: "solid",
        color: "info",
        className: "bg-sky-600 text-white",
      },
      {
        variant: "ghost",
        color: "info",
        className: "text-sky-600 dark:text-sky-400",
      },
      // Gray
      {
        variant: "light",
        color: "gray",
        className:
          "border border-gray-200 bg-gray-100 text-gray-700 neutral:border-[#c8c2b6] neutral:bg-[#e2ded6] neutral:text-[#3d3a35] dark:border-gray-700 dark:bg-white/8 dark:text-gray-300",
      },
      {
        variant: "solid",
        color: "gray",
        className: "bg-gray-700 text-white dark:bg-gray-700 dark:text-white",
      },
      {
        variant: "ghost",
        color: "gray",
        className: "text-gray-700 dark:text-gray-300",
      },
      // Light
      {
        variant: "light",
        color: "light",
        className:
          "bg-gray-100 text-gray-700 dark:bg-white/8 dark:text-white/80",
      },
      {
        variant: "solid",
        color: "light",
        className: "bg-gray-400 text-white dark:bg-white/8 dark:text-white/80",
      },
      {
        variant: "ghost",
        color: "light",
        className: "text-gray-700 dark:text-gray-300",
      },
      // Dark
      {
        variant: "light",
        color: "dark",
        className:
          "bg-gray-500/15 text-gray-800 dark:bg-white/10 dark:text-white",
      },
      {
        variant: "solid",
        color: "dark",
        className: "bg-gray-800 text-white dark:bg-gray-700 dark:text-white",
      },
      {
        variant: "ghost",
        color: "dark",
        className: "text-gray-800 dark:text-white",
      },
    ],
    defaultVariants: {
      variant: "light",
      color: "primary",
      size: "default",
    },
  },
);

export interface BadgeProps
  extends
    Omit<useRender.ComponentProps<"span">, "color">,
    VariantProps<typeof badgeVariants> {}

function Badge({
  className,
  variant = "light",
  color = "primary",
  size = "default",
  render,
  ...props
}: BadgeProps) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps(
      {
        className: cn(badgeVariants({ variant, color, size }), className),
      },
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
      color,
      size,
    },
  });
}

export { Badge, badgeVariants };
