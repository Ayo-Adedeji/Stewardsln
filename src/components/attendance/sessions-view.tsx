"use client";

import CreateSessionModal from "@/components/attendance/create-session-modal";
import QrCodeModal from "@/components/attendance/qr-code-modal";
import CreateSessionForm from "@/components/forms/create-session-form";
import EmptyState from "@/components/shared/empty-state";
import { FadeIn } from "@/components/shared/motion";
import PageHeader from "@/components/shared/page-header";
import QrCodeDisplay from "@/components/shared/qr-code-display";
import { SessionStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAttendance } from "@/context/attendance-context";
import { Link } from "@/i18n/navigation";
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  LinkIcon,
  PlusIcon,
  QrCodeIcon,
  SearchIcon,
  TrashBinIcon,
  UsersIcon,
  VerticalDotsIcon,
} from "@/icons";
import type { AttendanceSession, SessionStatus } from "@/types/attendance";
import {
  downloadQrCodeSvg,
  exportToCsv,
  formatDisplayDate,
  formatTime12h,
  getPublicRegistrationUrl,
} from "@/utils";
import { useMemo, useState } from "react";

type StatusFilter = "all" | SessionStatus;

export default function AttendanceSessionsView() {
  const { sessions, settings, updateSessionStatus, deleteSession } =
    useAttendance();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showInlineCreate, setShowInlineCreate] = useState(false);
  const [modalQrSessionId, setModalQrSessionId] = useState<string | null>(null);
  const [activePassSessionId, setActivePassSessionId] = useState<string | null>(
    null,
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] =
    useState<AttendanceSession | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const matchesStatus =
        statusFilter === "all" || session.status === statusFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        session.eventName.toLowerCase().includes(q) ||
        session.token.toLowerCase().includes(q) ||
        session.eventDate.includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [sessions, statusFilter, searchQuery]);

  const highlightedSession = useMemo(() => {
    if (activePassSessionId) {
      const found = sessions.find((s) => s.id === activePassSessionId);
      if (found) return found;
    }
    return sessions.find((s) => s.status === "open") ?? sessions[0] ?? null;
  }, [sessions, activePassSessionId]);

  const modalQrSession =
    sessions.find((s) => s.id === modalQrSessionId) ?? null;

  const handleCopyLink = async (session: AttendanceSession) => {
    const url = getPublicRegistrationUrl(
      session.token,
      settings.publicBaseUrl,
    );
    try {
      await navigator.clipboard.writeText(url);
    } catch {}
    setCopiedId(session.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportSessions = () => {
    exportToCsv(
      "light-nation-attendance-sessions.csv",
      [
        "Event Name",
        "Event Date",
        "Opening Time",
        "Closing Time",
        "Registration Count",
        "Status",
        "Token",
      ],
      filteredSessions.map((s) => [
        s.eventName,
        s.eventDate,
        formatTime12h(s.openingTime),
        formatTime12h(s.closingTime),
        s.registrationCount,
        s.status.toUpperCase(),
        s.token,
      ]),
    );
  };

  const counts = useMemo(
    () => ({
      all: sessions.length,
      open: sessions.filter((s) => s.status === "open").length,
      scheduled: sessions.filter((s) => s.status === "scheduled").length,
      closed: sessions.filter((s) => s.status === "closed").length,
    }),
    [sessions],
  );

  return (
    <div className="space-y-8">
      <FadeIn>
        <PageHeader
          subtitle="Service Management"
          title="Attendance Sessions"
          description="Create service attendance sessions, manage opening/closing windows, and display or download official QR check-in passes."
          actions={
            <>
              <Button
                variant="outline"
                onClick={handleExportSessions}
                disabled={filteredSessions.length === 0}
              >
                <DownloadIcon className="size-4" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowInlineCreate((prev) => !prev)}
              >
                {showInlineCreate ? "Hide Inline Form" : "Inline Creator"}
              </Button>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <PlusIcon className="size-4" />
                New Session
              </Button>
            </>
          }
        />
      </FadeIn>

      {/* Collapsible Inline Create Attendance Card */}
      {showInlineCreate && (
        <FadeIn>
          <Card className="border-brand-500/30 p-6">
            <div className="mb-4 flex items-center justify-between border-b border-(--ln-border) pb-4">
              <div>
                <h2 className="section-heading">
                  Create New Attendance Session
                </h2>
                <p className="supporting-text">
                  Configure service name, date, and check-in window to generate
                  a live QR code.
                </p>
              </div>
            </div>
            <CreateSessionForm
              onCancel={() => setShowInlineCreate(false)}
              onSuccess={(created) => {
                setShowInlineCreate(false);
                setActivePassSessionId(created.id);
                setModalQrSessionId(created.id);
              }}
            />
          </Card>
        </FadeIn>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Left / Main Column: Session Listing Table */}
        <FadeIn delayMs={60} className="col-span-12 xl:col-span-8">
          <Card className="p-6">
            {/* Filters & Search Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="ln-segmented">
                {(
                  [
                    { id: "all", label: "All", count: counts.all },
                    { id: "open", label: "Open", count: counts.open },
                    {
                      id: "scheduled",
                      label: "Scheduled",
                      count: counts.scheduled,
                    },
                    { id: "closed", label: "Closed", count: counts.closed },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`ln-segment-item px-2.5 py-1.25 ${
                      statusFilter === tab.id
                        ? "ln-segment-item-active"
                        : "ln-segment-item-inactive"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="tabular rounded-full border border-(--ln-border) bg-(--ln-bg-canvas) px-1.5 py-0.25 text-[10px] font-semibold text-(--ln-fg-secondary)">
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <SearchIcon className="pointer-events-none absolute inset-s-3.5 top-1/2 size-4 -translate-y-1/2 text-(--ln-fg-muted)" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search session or date..."
                  className="h-9.5 ps-9.5 text-xs"
                />
              </div>
            </div>

            {/* Table */}
            {filteredSessions.length === 0 ? (
              <EmptyState
                icon={<CalendarIcon className="size-6" />}
                title="No matching attendance sessions"
                description={
                  searchQuery || statusFilter !== "all"
                    ? "Try clearing your search or switching the session status filter."
                    : "Create your first attendance session to generate a QR code and registration link."
                }
                action={
                  <Button
                    size="sm"
                    onClick={() => {
                      if (searchQuery || statusFilter !== "all") {
                        setSearchQuery("");
                        setStatusFilter("all");
                      } else {
                        setIsCreateModalOpen(true);
                      }
                    }}
                  >
                    {searchQuery || statusFilter !== "all"
                      ? "Reset Filters"
                      : "Create Session"}
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-(--ln-border)">
                      <TableCell isHeader className="table-header-cell ps-0">
                        Event Name
                      </TableCell>
                      <TableCell isHeader className="table-header-cell">
                        Event Date
                      </TableCell>
                      <TableCell isHeader className="table-header-cell">
                        Window
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
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-(--ln-border)/70">
                    {filteredSessions.map((session) => {
                      const isSelected =
                        highlightedSession?.id === session.id;
                      return (
                        <TableRow
                          key={session.id}
                          className={`transition-colors ${
                            isSelected
                              ? "bg-(--ln-surface-warm)/75"
                              : "hover:bg-(--ln-surface-warm)/40"
                          }`}
                        >
                          <TableCell className="table-body-cell ps-0">
                            <button
                              type="button"
                              onClick={() => setActivePassSessionId(session.id)}
                              className="text-start font-semibold text-(--ln-fg-primary) hover:text-brand-600 dark:hover:text-brand-400"
                            >
                              {session.eventName}
                            </button>
                            {session.description && (
                              <p className="mt-0.5 line-clamp-1 max-w-xs text-xs text-(--ln-fg-muted)">
                                {session.description}
                              </p>
                            )}
                          </TableCell>

                          <TableCell className="table-body-cell whitespace-nowrap">
                            {formatDisplayDate(session.eventDate)}
                          </TableCell>

                          <TableCell className="tabular table-body-cell whitespace-nowrap text-xs text-(--ln-fg-muted)">
                            {formatTime12h(session.openingTime)} –{" "}
                            {formatTime12h(session.closingTime)}
                          </TableCell>

                          <TableCell className="table-body-cell">
                            <span className="tabular font-semibold text-(--ln-fg-primary)">
                              {session.registrationCount.toLocaleString()}
                            </span>
                          </TableCell>

                          <TableCell className="table-body-cell">
                            <SessionStatusBadge
                              status={session.status}
                              size="sm"
                            />
                          </TableCell>

                          <TableCell className="table-body-cell pe-0 text-end">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="xs"
                                render={
                                  <Link
                                    href={`/records?session=${session.id}`}
                                  />
                                }
                                title="View records from this session"
                              >
                                <UsersIcon className="size-3.5 text-brand-600 dark:text-brand-400" />
                                View Records
                              </Button>

                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => {
                                  setActivePassSessionId(session.id);
                                  setModalQrSessionId(session.id);
                                }}
                              >
                                <QrCodeIcon className="size-3.5 text-brand-600 dark:text-brand-400" />
                                QR
                              </Button>

                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      aria-label="Session actions"
                                    >
                                      <VerticalDotsIcon className="size-4" />
                                    </Button>
                                  }
                                />
                                <DropdownMenuContent
                                  align="end"
                                  className="w-56 p-1.5"
                                >
                                  <DropdownMenuItem
                                    render={
                                      <Link
                                        href={`/records?session=${session.id}`}
                                      />
                                    }
                                  >
                                    <UsersIcon className="size-4" />
                                    <span>
                                      View Records (
                                      {session.registrationCount.toLocaleString()}
                                      )
                                    </span>
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    onClick={() => {
                                      setActivePassSessionId(session.id);
                                      setModalQrSessionId(session.id);
                                    }}
                                  >
                                    <QrCodeIcon className="size-4" />
                                    <span>Open QR Code Modal</span>
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    onClick={() => handleCopyLink(session)}
                                  >
                                    <CopyIcon className="size-4" />
                                    <span>
                                      {copiedId === session.id
                                        ? "Link Copied!"
                                        : "Copy Registration Link"}
                                    </span>
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    render={
                                      <Link
                                        href={`/attend/${session.token}`}
                                        target="_blank"
                                      />
                                    }
                                  >
                                    <EyeIcon className="size-4" />
                                    <span>Open Public Form (GPS)</span>
                                  </DropdownMenuItem>

                                  {session.protocolToken && (
                                    <DropdownMenuItem
                                      render={
                                        <Link
                                          href={`/attend/${session.protocolToken}`}
                                          target="_blank"
                                        />
                                      }
                                    >
                                      <EyeIcon className="size-4" />
                                      <span>Open Protocol Desk (Entrance)</span>
                                    </DropdownMenuItem>
                                  )}

                                  <DropdownMenuSeparator />

                                  {session.status !== "open" && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        updateSessionStatus(session.id, "open")
                                      }
                                    >
                                      <CheckIcon className="size-4 text-emerald-600" />
                                      <span>Mark Session Open</span>
                                    </DropdownMenuItem>
                                  )}

                                  {session.status !== "scheduled" && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        updateSessionStatus(
                                          session.id,
                                          "scheduled",
                                        )
                                      }
                                    >
                                      <ClockIcon className="size-4 text-amber-600" />
                                      <span>Mark as Scheduled</span>
                                    </DropdownMenuItem>
                                  )}

                                  {session.status !== "closed" && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        updateSessionStatus(
                                          session.id,
                                          "closed",
                                        )
                                      }
                                    >
                                      <ClockIcon className="size-4 text-(--ln-fg-muted)" />
                                      <span>Close Registration</span>
                                    </DropdownMenuItem>
                                  )}

                                  <DropdownMenuSeparator />

                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => setSessionToDelete(session)}
                                  >
                                    <TrashBinIcon className="size-4" />
                                    <span>Delete Session</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </FadeIn>

        {/* Right Column: Live QR Code View Panel */}
        <FadeIn delayMs={100} className="col-span-12 xl:col-span-4">
          {highlightedSession ? (
            <Card className="sticky top-6 p-6">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-semibold tracking-wider text-brand-600 uppercase dark:text-brand-400">
                    QR Code View
                  </span>
                  <h3 className="text-base font-semibold text-(--ln-fg-primary)">
                    Session Check-In Pass
                  </h3>
                </div>
                <SessionStatusBadge status={highlightedSession.status} />
              </div>

              <div className="flex flex-col items-center rounded-2xl border border-(--ln-border) bg-(--ln-surface-warm)/55 p-5 text-center">
                <QrCodeDisplay
                  value={getPublicRegistrationUrl(
                    highlightedSession.token,
                    settings.publicBaseUrl,
                  )}
                  size={196}
                />

                <h4 className="mt-4 text-base font-bold text-(--ln-fg-primary)">
                  {highlightedSession.eventName}
                </h4>

                <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-(--ln-fg-muted)">
                  <span className="inline-flex items-center gap-1">
                    <CalendarIcon className="size-3.5 text-brand-600 dark:text-brand-400" />
                    {formatDisplayDate(highlightedSession.eventDate)}
                  </span>
                  <span className="tabular inline-flex items-center gap-1">
                    <ClockIcon className="size-3.5 text-brand-600 dark:text-brand-400" />
                    {formatTime12h(highlightedSession.openingTime)} –{" "}
                    {formatTime12h(highlightedSession.closingTime)}
                  </span>
                </div>

                <div className="tabular mt-3 inline-flex items-center gap-1.5 rounded-full border border-(--ln-border) bg-(--ln-surface) px-3 py-1 text-xs font-semibold text-(--ln-fg-primary) shadow-theme-xs">
                  <UsersIcon className="size-3.5 text-brand-600 dark:text-brand-400" />
                  {highlightedSession.registrationCount.toLocaleString()}{" "}
                  Attendees Registered
                </div>
              </div>

              {/* Registration Link */}
              <div className="space-y-1.5">
                <span className="block text-xs font-medium text-(--ln-fg-muted)">
                  Registration Link
                </span>
                <div className="flex min-w-0 items-center gap-2 rounded-xl border border-(--ln-border) bg-(--ln-surface-warm)/40 px-3 py-2">
                  <LinkIcon className="size-3.5 shrink-0 text-(--ln-fg-muted)" />
                  <code className="min-w-0 flex-1 truncate text-xs text-(--ln-fg-secondary)">
                    {getPublicRegistrationUrl(
                      highlightedSession.token,
                      settings.publicBaseUrl,
                    )}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => handleCopyLink(highlightedSession)}
                  >
                    {copiedId === highlightedSession.id ? (
                      <>
                        <CheckIcon className="size-3.5 text-emerald-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <CopyIcon className="size-3.5" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    downloadQrCodeSvg(
                      getPublicRegistrationUrl(
                        highlightedSession.token,
                        settings.publicBaseUrl,
                      ),
                      highlightedSession.eventName,
                      `${formatDisplayDate(highlightedSession.eventDate)} (${formatTime12h(highlightedSession.openingTime)} - ${formatTime12h(highlightedSession.closingTime)})`,
                      `light-nation-qr-${highlightedSession.token}`,
                    )
                  }
                >
                  <DownloadIcon className="size-4" />
                  Download QR
                </Button>

                <Button
                  type="button"
                  leadingArrow
                  nativeButton={false}
                  render={
                    <Link href={`/attend/${highlightedSession.token}`} />
                  }
                >
                  Open Session
                </Button>
              </div>
            </Card>
          ) : null}
        </FadeIn>
      </div>

      <CreateSessionModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onCreated={(created) => {
          setActivePassSessionId(created.id);
          setModalQrSessionId(created.id);
        }}
      />

      <QrCodeModal
        session={modalQrSession}
        open={Boolean(modalQrSession)}
        onOpenChange={(open) => {
          if (!open) setModalQrSessionId(null);
        }}
      />

      {/* Delete Session Confirmation Dialog */}
      <Dialog
        open={Boolean(sessionToDelete)}
        onOpenChange={(open) => {
          if (!open) setSessionToDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Attendance Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{" "}
              <strong className="text-(--ln-fg-primary)">
                {sessionToDelete?.eventName}
              </strong>
              {sessionToDelete?.eventDate
                ? ` (${sessionToDelete.eventDate})`
                : ""}?
              {" "}This will permanently delete this session and all check-in records logged under it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              disabled={isDeletingSession}
              onClick={() => setSessionToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={isDeletingSession}
              onClick={async () => {
                if (!sessionToDelete) return;
                try {
                  setIsDeletingSession(true);
                  await deleteSession(sessionToDelete.id);
                  setSessionToDelete(null);
                } finally {
                  setIsDeletingSession(false);
                }
              }}
            >
              Delete Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
