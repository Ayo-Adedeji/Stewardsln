"use client";

import EmptyState from "@/components/shared/empty-state";
import { FadeIn } from "@/components/shared/motion";
import PageHeader from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAttendance } from "@/context/attendance-context";
import {
  CalendarIcon,
  ClockIcon,
  DownloadIcon,
  FilterIcon,
  PrinterIcon,
  SearchIcon,
  UsersIcon,
  XIcon,
} from "@/icons";
import {
  exportToCsv,
  formatDisplayDate,
  getInitials,
} from "@/utils";
import { useMemo, useState } from "react";

export default function AttendanceRecordsView() {
  const { records, sessions, departments } = useAttendance();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedSession, setSelectedSession] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>("");

  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        rec.fullName.toLowerCase().includes(q) ||
        rec.departmentName.toLowerCase().includes(q) ||
        rec.sessionName.toLowerCase().includes(q);

      const matchesDepartment =
        selectedDepartment === "all" ||
        (selectedDepartment === "other"
          ? Boolean(rec.isCustomDepartment || rec.departmentId === "other")
          : rec.departmentId === selectedDepartment);

      const matchesSession =
        selectedSession === "all" || rec.sessionId === selectedSession;

      const matchesDate = !selectedDate || rec.sessionDate === selectedDate;

      return (
        matchesSearch && matchesDepartment && matchesSession && matchesDate
      );
    });
  }, [
    records,
    searchQuery,
    selectedDepartment,
    selectedSession,
    selectedDate,
  ]);

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    selectedDepartment !== "all" ||
    selectedSession !== "all" ||
    Boolean(selectedDate);

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedDepartment("all");
    setSelectedSession("all");
    setSelectedDate("");
  };

  const handleExportCsv = () => {
    exportToCsv(
      `light-nation-attendance-records-${selectedDate || "all"}.csv`,
      [
        "Registration Time",
        "Full Name",
        "Department",
        "Verification Method",
        "Logged By",
        "Session / Service",
        "Service Date",
        "Type",
      ],
      filteredRecords.map((r) => [
        r.registrationTime,
        r.fullName,
        r.departmentName,
        r.verificationMethod === "gps_verified"
          ? "GPS Verified"
          : r.verificationMethod === "protocol_verified"
            ? "Protocol Desk Verified"
            : r.verificationMethod,
        r.registeredByName || "Self (Attendee Device)",
        r.sessionName,
        r.sessionDate,
        r.isCustomDepartment ? "Other / Custom" : "Church Department",
      ]),
    );
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const uniqueDepartmentsInView = useMemo(() => {
    return new Set(filteredRecords.map((r) => r.departmentName)).size;
  }, [filteredRecords]);

  return (
    <div className="space-y-8">
      <FadeIn>
        <PageHeader
          subtitle="Verified Logs & Exports"
          title="Attendance Records"
          description="Search, filter, and export verified attendee check-in logs across all Light Nation Ibadan services and departments."
          actions={
            <>
              <Button
                variant="outline"
                onClick={handlePrint}
                disabled={filteredRecords.length === 0}
              >
                <PrinterIcon className="size-4" />
                Print Log
              </Button>
              <Button
                onClick={handleExportCsv}
                disabled={filteredRecords.length === 0}
              >
                <DownloadIcon className="size-4" />
                Export CSV ({filteredRecords.length})
              </Button>
            </>
          }
        />
      </FadeIn>

      {/* Summary Strip */}
      <FadeIn delayMs={40}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="flex flex-row items-center justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-medium text-(--ln-fg-muted)">
                Filtered Check-In Records
              </p>
              <p className="tabular mt-1 text-2xl font-bold text-(--ln-fg-primary)">
                {filteredRecords.length.toLocaleString()}
              </p>
            </div>
            <span className="flex size-10 items-center justify-center rounded-xl bg-(--ln-surface-warm) text-brand-600 dark:text-brand-400">
              <UsersIcon className="size-5" />
            </span>
          </Card>

          <Card className="flex flex-row items-center justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-medium text-(--ln-fg-muted)">
                Departments Represented
              </p>
              <p className="tabular mt-1 text-2xl font-bold text-(--ln-fg-primary)">
                {uniqueDepartmentsInView}
              </p>
            </div>
            <span className="flex size-10 items-center justify-center rounded-xl bg-(--ln-surface-warm) text-amber-600 dark:text-amber-400">
              <FilterIcon className="size-5" />
            </span>
          </Card>

          <Card className="flex flex-row items-center justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-medium text-(--ln-fg-muted)">
                Latest Check-In Time
              </p>
              <p className="tabular mt-1 text-2xl font-bold text-(--ln-fg-primary)">
                {filteredRecords[0]?.registrationTime ?? "—"}
              </p>
            </div>
            <span className="flex size-10 items-center justify-center rounded-xl bg-(--ln-surface-warm) text-emerald-600 dark:text-emerald-400">
              <ClockIcon className="size-5" />
            </span>
          </Card>
        </div>
      </FadeIn>

      {/* Filters & Records Table Card */}
      <FadeIn delayMs={80}>
        <Card className="p-6">
          {/* 4-Control Filter Bar: Search, Department Filter, Session Filter, Date Filter */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
            {/* Search */}
            <div className="relative xl:col-span-4">
              <SearchIcon className="pointer-events-none absolute inset-s-3.5 top-1/2 size-4 -translate-y-1/2 text-(--ln-fg-muted)" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by full name or department..."
                className="ps-10"
              />
            </div>

            {/* Department Filter */}
            <div className="xl:col-span-3">
              <Select
                value={selectedDepartment}
                onValueChange={(val) => setSelectedDepartment(val ?? "all")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="other">
                    Other / Custom Department
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Session Filter */}
            <div className="xl:col-span-3">
              <Select
                value={selectedSession}
                onValueChange={(val) => setSelectedSession(val ?? "all")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Sessions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Attendance Sessions</SelectItem>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.eventName} ({s.eventDate})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Filter */}
            <div className="relative xl:col-span-2">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                aria-label="Filter by date"
                className="pe-9"
              />
              {selectedDate ? (
                <button
                  type="button"
                  onClick={() => setSelectedDate("")}
                  aria-label="Clear date filter"
                  className="absolute inset-e-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-(--ln-fg-muted) hover:text-(--ln-fg-primary)"
                >
                  <XIcon className="size-3.5" />
                </button>
              ) : (
                <CalendarIcon className="pointer-events-none absolute inset-e-3 top-1/2 size-4 -translate-y-1/2 text-(--ln-fg-muted)" />
              )}
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-(--ln-border) bg-(--ln-surface-warm)/55 px-3.5 py-2 text-xs">
              <span className="text-(--ln-fg-secondary)">
                Showing{" "}
                <strong className="tabular font-semibold text-(--ln-fg-primary)">
                  {filteredRecords.length}
                </strong>{" "}
                of {records.length} attendance records
              </span>
              <button
                type="button"
                onClick={resetFilters}
                className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
              >
                Clear all filters
              </button>
            </div>
          )}

          {/* Table */}
          {filteredRecords.length === 0 ? (
            <EmptyState
              icon={<UsersIcon className="size-6" />}
              title="No attendance records match your filters"
              description="Adjust your search query, department, session, or date filter to view matching attendee check-ins."
              action={
                hasActiveFilters ? (
                  <Button size="sm" variant="outline" onClick={resetFilters}>
                    Reset All Filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-(--ln-border)">
                    <TableCell isHeader className="table-header-cell ps-0">
                      Registration Time
                    </TableCell>
                    <TableCell isHeader className="table-header-cell">
                      Full Name
                    </TableCell>
                    <TableCell isHeader className="table-header-cell">
                      Department
                    </TableCell>
                    <TableCell isHeader className="table-header-cell">
                      Verification
                    </TableCell>
                    <TableCell isHeader className="table-header-cell">
                      Service Session
                    </TableCell>
                    <TableCell
                      isHeader
                      className="table-header-cell pe-0 text-end"
                    >
                      Date
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-(--ln-border)/70">
                  {filteredRecords.map((record) => (
                    <TableRow
                      key={record.id}
                      className="transition-colors hover:bg-(--ln-surface-warm)/40"
                    >
                      <TableCell className="table-body-cell ps-0 whitespace-nowrap">
                        <span className="tabular inline-flex items-center gap-1.5 rounded-lg border border-(--ln-border) bg-(--ln-surface-warm)/60 px-2.5 py-1 font-mono text-xs font-medium text-(--ln-fg-primary)">
                          <ClockIcon className="size-3.5 text-brand-600 dark:text-brand-400" />
                          {record.registrationTime}
                        </span>
                      </TableCell>

                      <TableCell className="table-body-cell">
                        <div className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-(--ln-surface-warm) text-xs font-bold text-brand-600 dark:text-brand-400">
                            {getInitials(record.fullName)}
                          </span>
                          <span className="font-semibold text-(--ln-fg-primary)">
                            {record.fullName}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="table-body-cell">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant="light"
                            color={
                              record.isCustomDepartment ? "warning" : "primary"
                            }
                            size="sm"
                          >
                            {record.departmentName}
                          </Badge>
                          {record.isCustomDepartment && (
                            <span className="text-[11px] text-(--ln-fg-muted)">
                              (Other)
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="table-body-cell whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <Badge
                            variant="light"
                            color={
                              record.verificationMethod === "gps_verified"
                                ? "success"
                                : record.verificationMethod === "protocol_verified"
                                  ? "warning"
                                  : "gray"
                            }
                            size="sm"
                          >
                            {record.verificationMethod === "gps_verified"
                              ? "GPS Verified"
                              : record.verificationMethod === "protocol_verified"
                                ? "Protocol Verified"
                                : "Admin Entry"}
                          </Badge>
                          {record.registeredByName && (
                            <span className="text-[10px] text-(--ln-fg-muted)">
                              by {record.registeredByName}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="table-body-cell">
                        <span className="text-(--ln-fg-primary)">
                          {record.sessionName}
                        </span>
                      </TableCell>

                      <TableCell className="table-body-cell pe-0 text-end whitespace-nowrap text-(--ln-fg-muted)">
                        {formatDisplayDate(record.sessionDate)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </FadeIn>
    </div>
  );
}
