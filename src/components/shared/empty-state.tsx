import { cn } from "@/utils";
import type React from "react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-12 text-center neutral:border-[#c8c2b6] neutral:bg-[#ece9e2]/50 dark:border-gray-800 dark:bg-white/2",
        className,
      )}
    >
      {icon && (
        <div className="mb-3.5 flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 neutral:bg-brand-500/12 dark:bg-brand-500/15 dark:text-brand-400">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
