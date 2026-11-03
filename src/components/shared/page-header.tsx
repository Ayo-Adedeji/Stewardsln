import { cn } from "@/utils";
import type React from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export default function PageHeader({
  title,
  subtitle,
  description,
  badge,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {subtitle && (
          <p className="text-xs font-medium tracking-wider text-(--ln-fg-muted) uppercase">
            {subtitle}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="page-heading truncate">{title}</h1>
          {badge}
        </div>
        {description && (
          <p className="supporting-text max-w-2xl">{description}</p>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          {actions}
        </div>
      )}
    </div>
  );
}
