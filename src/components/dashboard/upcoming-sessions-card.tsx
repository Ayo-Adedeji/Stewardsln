"use client";

import EmptyState from "@/components/shared/empty-state";
import { SessionStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAttendance } from "@/context/attendance-context";
import { CalendarIcon, ClockIcon, PlusIcon, QrCodeIcon } from "@/icons";
import type { AttendanceSession } from "@/types/attendance";
import { formatDisplayDate, formatTime12h } from "@/utils";

interface UpcomingSessionsCardProps {
  onSelectQr: (session: AttendanceSession) => void;
  onCreateSession: () => void;
}

export default function UpcomingSessionsCard({
  onSelectQr,
  onCreateSession,
}: UpcomingSessionsCardProps) {
  const { sessions, updateSessionStatus } = useAttendance();

  const upcomingSessions = sessions.filter((s) => s.status === "scheduled");

  return (
    <Card className="flex h-full flex-col justify-between p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="section-heading">Upcoming Sessions</h2>
            <p className="supporting-text mt-0.5">
              Pre-scheduled services ready for check-in activation
            </p>
          </div>
          <span className="tabular flex size-7 items-center justify-center rounded-full border border-(--ln-border) bg-(--ln-surface-warm) text-xs font-semibold text-brand-600 dark:text-brand-400">
            {upcomingSessions.length}
          </span>
        </div>

        {upcomingSessions.length === 0 ? (
          <EmptyState
            icon={<ClockIcon className="size-6" />}
            title="No upcoming sessions scheduled"
            description="Pre-schedule Sunday or Midweek services in advance so QR passes are ready ahead of time."
            action={
              <Button size="xs" variant="outline" onClick={onCreateSession}>
                <PlusIcon className="size-3.5" />
                Schedule Service
              </Button>
            }
            className="py-8"
          />
        ) : (
          <div className="space-y-3">
            {upcomingSessions.map((session) => (
              <div
                key={session.id}
                className="rounded-xl border border-(--ln-border) bg-(--ln-surface-warm)/45 p-4 transition-colors hover:border-brand-300/80 dark:hover:border-brand-500/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-(--ln-fg-primary)">
                    {session.eventName}
                  </h3>
                  <SessionStatusBadge status={session.status} size="sm" />
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-(--ln-fg-muted)">
                  <span className="inline-flex items-center gap-1">
                    <CalendarIcon className="size-3.5 text-brand-600 dark:text-brand-400" />
                    {formatDisplayDate(session.eventDate)}
                  </span>
                  <span className="tabular inline-flex items-center gap-1">
                    <ClockIcon className="size-3.5 text-brand-600 dark:text-brand-400" />
                    {formatTime12h(session.openingTime)} –{" "}
                    {formatTime12h(session.closingTime)}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-end gap-2 border-t border-(--ln-border)/70 pt-2.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => onSelectQr(session)}
                  >
                    <QrCodeIcon className="size-3.5" />
                    Preview QR
                  </Button>
                  <Button
                    type="button"
                    variant="brand-outline"
                    size="xs"
                    leadingArrow
                    onClick={() => updateSessionStatus(session.id, "open")}
                  >
                    Open Session
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Create Callout */}
      <div className="mt-5 rounded-xl border border-brand-500/25 bg-(--ln-surface-warm) p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-semibold tracking-wider text-brand-600 uppercase dark:text-brand-400">
              Instant QR Pass
            </h4>
            <p className="mt-0.5 text-xs text-(--ln-fg-muted)">
              Need a check-in code for a special service or rehearsal?
            </p>
          </div>
          <Button size="sm" onClick={onCreateSession} className="shrink-0">
            <PlusIcon className="size-4" />
            New Session
          </Button>
        </div>
      </div>
    </Card>
  );
}
