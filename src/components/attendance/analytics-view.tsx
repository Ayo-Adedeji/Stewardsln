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
import { useAttendance } from "@/context/attendance-context";
import {
  BuildingIcon,
  CalendarIcon,
  DownloadIcon,
  FilterIcon,
  XIcon,
} from "@/icons";
import type { SessionType } from "@/types/attendance";
import { exportToCsv, formatDisplayDate } from "@/utils";
import { formatSessionTypeLabel } from "@/utils/form-templates";
import { useMemo, useState } from "react";

export default function AnalyticsView() {
  const { analytics, fetchAnalytics } = useAttendance();

  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [isFiltering, setIsFiltering] = useState(false);

  const handleApplyFilter = async () => {
    setIsFiltering(true);
    await fetchAnalytics({
      from: dateFrom || undefined,
      to: dateTo || undefined,
      sessionType:
        selectedType === "all" ? undefined : (selectedType as SessionType),
    });
    setIsFiltering(false);
  };

  const handleResetFilter = async () => {
    setDateFrom("");
    setDateTo("");
    setSelectedType("all");
    setIsFiltering(true);
    await fetchAnalytics({});
    setIsFiltering(false);
  };

  const hasActiveFilters = Boolean(dateFrom || dateTo || selectedType !== "all");

  const overview = analytics?.overview;
  const sundayWeekly = useMemo(
    () => analytics?.sundayWeekly || [],
    [analytics?.sundayWeekly],
  );
  const monthly = analytics?.monthly || [];
  const byDept = analytics?.byDepartment || [];
  const byType = analytics?.bySessionType || [];
  const byMethod = analytics?.byVerificationMethod || [];

  // Sunday weekly max calculation
  const sundayMax = useMemo(() => {
    if (sundayWeekly.length === 0) return 1;
    return Math.max(...sundayWeekly.map((s) => s.registrations), 1);
  }, [sundayWeekly]);

  // Export analytics summary
  const handleExportSummary = () => {
    if (!analytics) return;
    exportToCsv(
      `light-nation-attendance-analytics-${analytics.today}.csv`,
      ["Metric / Dimension", "Value", "Unique People", "Notes"],
      [
        ["Total Registrations", overview?.totalRegistrations ?? 0, overview?.uniquePeople ?? 0, "All filtered events"],
        ["Sunday Service Registrations", overview?.sundayRegistrations ?? 0, overview?.sundayUniquePeople ?? 0, "Sunday Services Only"],
        ["Other Events Registrations", overview?.otherRegistrations ?? 0, overview?.otherUniquePeople ?? 0, "Midweek/Conferences/Workers"],
        ["Sunday Services Count", overview?.sundayCount ?? 0, "", "Sundays held"],
        ["Average Sunday Attendance", overview?.averageSunday ?? 0, "", "Per Sunday service"],
        ["Latest Sunday Attendance", overview?.latestSunday?.registrations ?? 0, "", overview?.latestSunday?.date ?? "N/A"],
        ["Previous Sunday Attendance", overview?.previousSunday?.registrations ?? 0, "", overview?.previousSunday?.date ?? "N/A"],
        ["Sunday-over-Sunday Change %", `${overview?.changePct ?? 0}%`, "", "Latest vs Previous"],
        ...sundayWeekly.map((s) => [`Sunday (${s.date})`, s.registrations, s.uniquePeople, `${s.services} services`]),
        ...byDept.map((d) => [`Department: ${d.department}`, d.registrations, d.uniquePeople, "Workforce"]),
        ...byType.map((t) => [`Session Type: ${formatSessionTypeLabel(t.sessionType)}`, t.registrations, t.uniquePeople, `${t.sessions} sessions`]),
        ...byMethod.map((m) => [`Method: ${m.method}`, m.registrations, "", "Verification"]),
      ],
    );
  };

  return (
    <div className="space-y-8">
      <FadeIn>
        <PageHeader
          subtitle="Attendance Insights"
          title="Attendance Analytics"
          description="Analyze church attendance trends, Sunday service turnouts, departmental workforce participation, and verification methods across church events."
          actions={
            <Button
              variant="outline"
              onClick={handleExportSummary}
              disabled={!analytics || overview?.totalRegistrations === 0}
            >
              <DownloadIcon className="size-4" />
              Export Analytics CSV
            </Button>
          }
        />
      </FadeIn>

      {/* FILTER BAR: Date Range & Session Type Filters */}
      <FadeIn delayMs={40}>
        <Card className="p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 items-end">
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-medium text-(--ln-fg-muted)">
                From Date
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9.5 text-xs"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-medium text-(--ln-fg-muted)">
                To Date
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9.5 text-xs"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-medium text-(--ln-fg-muted)">
                Event / Session Type
              </label>
              <Select
                value={selectedType}
                onValueChange={(val) => setSelectedType(val ?? "all")}
              >
                <SelectTrigger className="h-9.5 text-xs">
                  <SelectValue placeholder="All Event Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events &amp; Services</SelectItem>
                  <SelectItem value="sunday_service">Sunday Service</SelectItem>
                  <SelectItem value="workers_meeting">Workers&apos; Meeting</SelectItem>
                  <SelectItem value="conference">Conference / Summit</SelectItem>
                  <SelectItem value="general_event">General Event</SelectItem>
                  <SelectItem value="custom">Custom Event</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-3 flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleApplyFilter}
                loading={isFiltering}
                className="flex-1"
              >
                Apply Filters
              </Button>
              {hasActiveFilters && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResetFilter}
                  title="Clear filters"
                >
                  <XIcon className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </Card>
      </FadeIn>

      {/* OVERVIEW STATS CARDS */}
      <FadeIn delayMs={60}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Total Registrations & Unique People */}
          <Card className="p-5">
            <div className="flex items-center justify-between text-xs font-medium text-(--ln-fg-muted)">
              <span>Total Registrations</span>
              <Badge variant="light" color="primary" size="sm">
                All Events
              </Badge>
            </div>
            <p className="tabular mt-2 text-3xl font-bold text-(--ln-fg-primary)">
              {overview?.totalRegistrations.toLocaleString() ?? 0}
            </p>
            <p className="mt-1 text-xs text-(--ln-fg-muted)">
              <strong>{overview?.uniquePeople.toLocaleString() ?? 0}</strong>{" "}
              distinct unique attendees
            </p>
          </Card>

          {/* Card 2: Sunday Service Total vs Other */}
          <Card className="p-5">
            <div className="flex items-center justify-between text-xs font-medium text-(--ln-fg-muted)">
              <span>Sunday vs Other</span>
              <Badge variant="light" color="success" size="sm">
                Separated
              </Badge>
            </div>
            <p className="tabular mt-2 text-3xl font-bold text-(--ln-fg-primary)">
              {overview?.sundayRegistrations.toLocaleString() ?? 0}
            </p>
            <p className="mt-1 text-xs text-(--ln-fg-muted)">
              Sunday Services ·{" "}
              <strong>{overview?.otherRegistrations.toLocaleString() ?? 0}</strong>{" "}
              other events
            </p>
          </Card>

          {/* Card 3: Average Sunday Attendance */}
          <Card className="p-5">
            <div className="flex items-center justify-between text-xs font-medium text-(--ln-fg-muted)">
              <span>Average Sunday Turnout</span>
              <Badge variant="light" color="warning" size="sm">
                Benchmark
              </Badge>
            </div>
            <p className="tabular mt-2 text-3xl font-bold text-(--ln-fg-primary)">
              {overview?.averageSunday ?? 0}
            </p>
            <p className="mt-1 text-xs text-(--ln-fg-muted)">
              Across {overview?.sundayCount ?? 0} Sunday services recorded
            </p>
          </Card>

          {/* Card 4: Most Recent Sunday & % Change */}
          <Card className="p-5">
            <div className="flex items-center justify-between text-xs font-medium text-(--ln-fg-muted)">
              <span>Most Recent Sunday</span>
              {overview?.changePct !== undefined && overview?.changePct !== null ? (
                <Badge
                  variant="light"
                  color={overview.changePct >= 0 ? "success" : "error"}
                  size="sm"
                >
                  {overview.changePct >= 0 ? "+" : ""}
                  {overview.changePct}%
                </Badge>
              ) : null}
            </div>
            <p className="tabular mt-2 text-3xl font-bold text-(--ln-fg-primary)">
              {overview?.latestSunday?.registrations.toLocaleString() ?? 0}
            </p>
            <p className="mt-1 text-xs text-(--ln-fg-muted)">
              {overview?.latestSunday?.date
                ? formatDisplayDate(overview.latestSunday.date)
                : "No Sunday records yet"}{" "}
              {overview?.previousSunday ? (
                <>
                  (vs {overview.previousSunday.registrations} on{" "}
                  {formatDisplayDate(overview.previousSunday.date)})
                </>
              ) : null}
            </p>
          </Card>
        </div>
      </FadeIn>

      {/* WEEKLY SUNDAY ATTENDANCE CHART */}
      <FadeIn delayMs={80}>
        <Card className="p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="section-heading">Weekly Sunday Attendance Chart</h2>
              <p className="supporting-text">
                Actual verified registrations for Sunday Celebration services
                over time. (Conferences and other events are cleanly separated).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-(--ln-fg-muted)">
                <span className="size-2.5 rounded-full bg-brand-500" />
                Sunday Turnout
              </span>
            </div>
          </div>

          {sundayWeekly.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={<CalendarIcon className="size-8" />}
                title="No Sunday attendance records"
                description="Sunday service registrations will appear in this weekly chart once check-in passes are scanned."
              />
            </div>
          ) : (
            <div className="mt-6">
              <div
                className="grid h-56 items-end gap-3 pt-3"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(
                    sundayWeekly.length,
                    4,
                  )}, minmax(0, 1fr))`,
                }}
              >
                {sundayWeekly.map((s, idx) => {
                  const isLatest = idx === sundayWeekly.length - 1;
                  const heightPct = Math.max(
                    8,
                    Math.round((s.registrations / sundayMax) * 100),
                  );

                  return (
                    <div
                      key={s.date}
                      className="group flex h-full flex-col items-center justify-end gap-2"
                    >
                      <span
                        className={`tabular text-[11px] font-semibold transition-colors ${
                          isLatest
                            ? "text-brand-600 dark:text-brand-400"
                            : "text-(--ln-fg-muted) group-hover:text-(--ln-fg-primary)"
                        }`}
                      >
                        {s.registrations}
                      </span>

                      <div
                        title={`${formatDisplayDate(s.date)} — ${s.registrations} attendees (${s.uniquePeople} unique)`}
                        className={`relative flex h-full w-full items-end justify-center rounded-xl border p-1.5 transition-all ${
                          isLatest
                            ? "border-brand-500/35 bg-(--ln-surface-warm)"
                            : "border-transparent bg-(--ln-surface-warm)/60 group-hover:border-(--ln-border)"
                        }`}
                      >
                        <div
                          className="w-full rounded-md bg-brand-500 transition-all duration-500 group-hover:bg-brand-600"
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>

                      <span
                        className={`max-w-full truncate text-[11px] ${
                          isLatest
                            ? "font-semibold text-(--ln-fg-primary)"
                            : "text-(--ln-fg-muted)"
                        }`}
                      >
                        {formatDisplayDate(s.date).replace(/,\s*\d{4}$/, "")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </FadeIn>

      {/* TWO-COLUMN BREAKDOWN: Department Participation & Event Types */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Attendance by Department */}
        <FadeIn delayMs={100}>
          <Card className="h-full p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="section-heading">Attendance by Department</h3>
                <p className="supporting-text">
                  Workforce &amp; congregation participation breakdown
                </p>
              </div>
              <BuildingIcon className="size-5 text-brand-500" />
            </div>

            {byDept.length === 0 ? (
              <p className="py-6 text-center text-xs text-(--ln-fg-muted)">
                No departmental attendance records in selected period.
              </p>
            ) : (
              <div className="space-y-3">
                {byDept.map((dept) => {
                  const total = overview?.totalRegistrations || 1;
                  const pct = Math.round((dept.registrations / total) * 100);

                  return (
                    <div
                      key={dept.department}
                      className="rounded-xl border border-(--ln-border) bg-(--ln-surface-warm)/30 p-3"
                    >
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-semibold text-(--ln-fg-primary)">
                          {dept.department}
                        </span>
                        <span className="tabular text-(--ln-fg-muted)">
                          <strong>{dept.registrations}</strong> ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-(--ln-border)/60">
                        <div
                          className="h-full rounded-full bg-brand-500 transition-all duration-500"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </FadeIn>

        {/* Breakdown by Session Type & Verification Method */}
        <FadeIn delayMs={120}>
          <Card className="h-full p-6 space-y-6">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="section-heading">Attendance by Event Type</h3>
                  <p className="supporting-text">
                    Sunday vs Conference vs Workers Meetings
                  </p>
                </div>
                <FilterIcon className="size-5 text-amber-500" />
              </div>

              {byType.length === 0 ? (
                <p className="py-4 text-center text-xs text-(--ln-fg-muted)">
                  No event records found.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {byType.map((t) => (
                    <div
                      key={t.sessionType}
                      className="flex items-center justify-between rounded-xl border border-(--ln-border) p-3 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-(--ln-fg-primary)">
                          {formatSessionTypeLabel(t.sessionType)}
                        </p>
                        <p className="text-[11px] text-(--ln-fg-muted)">
                          {t.sessions} {t.sessions === 1 ? "session" : "sessions"} ·{" "}
                          {t.uniquePeople} unique people
                        </p>
                      </div>
                      <span className="tabular text-sm font-bold text-brand-600 dark:text-brand-400">
                        {t.registrations.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Verification Method Breakdown */}
            <div className="border-t border-(--ln-border) pt-4">
              <h4 className="mb-2 text-xs font-semibold uppercase text-(--ln-fg-muted)">
                Verification Channel Breakdown
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {byMethod.map((m) => (
                  <div
                    key={m.method}
                    className="rounded-xl border border-(--ln-border) bg-(--ln-surface-warm)/40 p-3"
                  >
                    <p className="text-[11px] text-(--ln-fg-muted)">
                      {m.method === "gps_verified"
                        ? "GPS Verified (General QR)"
                        : m.method === "protocol_verified"
                          ? "Protocol Verified (Entrance Desk)"
                          : m.method === "admin_manual"
                            ? "Admin Manual Entry"
                            : "Legacy / Unverified"}
                    </p>
                    <p className="tabular mt-1 text-lg font-bold text-(--ln-fg-primary)">
                      {m.registrations}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </FadeIn>
      </div>

      {/* MONTHLY SUMMARY TABLE */}
      <FadeIn delayMs={140}>
        <Card className="p-6">
          <h3 className="section-heading mb-1">Monthly Attendance Totals</h3>
          <p className="supporting-text mb-4">
            Aggregated headcount across calendar months
          </p>

          {monthly.length === 0 ? (
            <p className="py-6 text-center text-xs text-(--ln-fg-muted)">
              No monthly activity logged yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-(--ln-border) text-start text-(--ln-fg-muted)">
                    <th className="py-2.5 font-semibold text-start">Month</th>
                    <th className="py-2.5 font-semibold text-start">
                      Sunday Services
                    </th>
                    <th className="py-2.5 font-semibold text-start">
                      Other Church Events
                    </th>
                    <th className="py-2.5 font-semibold text-start">
                      Unique People
                    </th>
                    <th className="py-2.5 font-semibold text-end">
                      Total Month Headcount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--ln-border)/60">
                  {monthly.map((m) => (
                    <tr key={m.month} className="hover:bg-(--ln-surface-warm)/40">
                      <td className="py-3 font-semibold text-(--ln-fg-primary)">
                        {m.month}
                      </td>
                      <td className="py-3 text-(--ln-fg-secondary)">
                        {m.sunday.toLocaleString()}
                      </td>
                      <td className="py-3 text-(--ln-fg-secondary)">
                        {m.other.toLocaleString()}
                      </td>
                      <td className="py-3 text-(--ln-fg-secondary)">
                        {m.uniquePeople.toLocaleString()}
                      </td>
                      <td className="tabular py-3 text-end font-bold text-brand-600 dark:text-brand-400">
                        {m.total.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </FadeIn>
    </div>
  );
}
