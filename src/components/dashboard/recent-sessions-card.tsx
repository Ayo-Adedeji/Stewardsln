"use client";

import EmptyState from "@/components/shared/empty-state";
import { SessionStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAttendance } from "@/context/attendance-context";
import { Link } from "@/i18n/navigation";
import { CalendarIcon, PlusIcon, QrCodeIcon } from "@/icons";
import type { AttendanceSession } from "@/types/attendance";
import { formatDisplayDate, formatTime12h } from "@/utils";

interface RecentSessionsCardProps {
  onSelectQr: (session: AttendanceSession) => void;
  onCreateSession: () => void;
}

export default function RecentSessionsCard({
  onSelectQr,
  onCreateSession,
}: RecentSessionsCardProps) {
  const { sessions } = useAttendance();

  const recentSessions = sessions
    .filter((s) => s.status === "open" || s.status === "closed")
    .slice(0, 5);

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-heading">Recent & Active Sessions</h2>
          <p className="supporting-text mt-0.5">
            Live and recently completed services with verified check-in counts
          </p>
        </div>

        <Button
          variant="outline"
          size="xs"
          leadingArrow
          nativeButton={false}
          render={<Link href="/attendance" />}
        >
          View All Sessions
        </Button>
      </div>

      {recentSessions.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon className="size-6" />}
          title="No recent attendance sessions"
          description="Create your first service session to generate a QR code and begin recording attendance."
          action={
            <Button size="sm" onClick={onCreateSession}>
              <PlusIcon className="size-4" />
              Create Session
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-(--ln-border)">
                <TableCell isHeader className="table-header-cell ps-0">
                  Service / Event
                </TableCell>
                <TableCell isHeader className="table-header-cell">
                  Date & Window
                </TableCell>
                <TableCell isHeader className="table-header-cell">
                  Registrations
                </TableCell>
                <TableCell isHeader className="table-header-cell">
                  Status
                </TableCell>
                <TableCell
                  isHeader
                  className="table-header-cell pe-0 text-end"
                >
                  QR Pass
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-(--ln-border)/70">
              {recentSessions.map((session) => (
                <TableRow
                  key={session.id}
                  className="transition-colors hover:bg-(--ln-surface-warm)/40"
                >
                  <TableCell className="table-body-cell ps-0">
                    <span className="block font-semibold text-(--ln-fg-primary)">
                      {session.eventName}
                    </span>
                    <span className="mt-0.5 block text-xs text-(--ln-fg-muted)">
                      Token: <code className="font-mono">{session.token}</code>
                    </span>
                  </TableCell>

                  <TableCell className="table-body-cell whitespace-nowrap">
                    <span className="block font-medium text-(--ln-fg-primary)">
                      {formatDisplayDate(session.eventDate)}
                    </span>
                    <span className="tabular text-xs text-(--ln-fg-muted)">
                      {formatTime12h(session.openingTime)} –{" "}
                      {formatTime12h(session.closingTime)}
                    </span>
                  </TableCell>

                  <TableCell className="table-body-cell">
                    <span className="tabular inline-flex items-center gap-1.5 font-semibold text-(--ln-fg-primary)">
                      {session.registrationCount.toLocaleString()}
                    </span>
                    <span className="ms-1 text-xs text-(--ln-fg-muted)">
                      checked in
                    </span>
                  </TableCell>

                  <TableCell className="table-body-cell">
                    <SessionStatusBadge status={session.status} size="sm" />
                  </TableCell>

                  <TableCell className="table-body-cell pe-0 text-end">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => onSelectQr(session)}
                    >
                      <QrCodeIcon className="size-3.5 text-brand-600 dark:text-brand-400" />
                      QR Code
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
