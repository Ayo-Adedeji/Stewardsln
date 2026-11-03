import { Badge } from "@/components/ui/badge";
import type { SessionStatus } from "@/types/attendance";
import { cn } from "@/utils";

interface SessionStatusBadgeProps {
  status: SessionStatus;
  size?: "sm" | "default" | "lg";
  className?: string;
}

export function SessionStatusBadge({
  status,
  size = "default",
  className,
}: SessionStatusBadgeProps) {
  if (status === "open") {
    return (
      <Badge
        variant="light"
        color="success"
        size={size}
        className={cn("gap-1.5 font-medium", className)}
      >
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        Open
      </Badge>
    );
  }

  if (status === "scheduled") {
    return (
      <Badge
        variant="light"
        color="warning"
        size={size}
        className={cn("gap-1.5 font-medium", className)}
      >
        <span className="size-1.5 rounded-full bg-amber-500" />
        Scheduled
      </Badge>
    );
  }

  return (
    <Badge
      variant="light"
      color="gray"
      size={size}
      className={cn("gap-1.5 font-medium", className)}
    >
      <span className="size-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
      Closed
    </Badge>
  );
}

interface DepartmentStatusBadgeProps {
  isEnabled: boolean;
  size?: "sm" | "default";
}

export function DepartmentStatusBadge({
  isEnabled,
  size = "default",
}: DepartmentStatusBadgeProps) {
  return isEnabled ? (
    <Badge variant="light" color="success" size={size}>
      <span className="size-1.5 rounded-full bg-emerald-500" />
      Active
    </Badge>
  ) : (
    <Badge variant="light" color="gray" size={size}>
      <span className="size-1.5 rounded-full bg-gray-400" />
      Disabled
    </Badge>
  );
}
