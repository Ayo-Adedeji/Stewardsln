"use client";

import EmptyState from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { useAttendance } from "@/context/attendance-context";
import { BuildingIcon, CalendarIcon } from "@/icons";
import { cn, formatDisplayDate } from "@/utils";
import { useMemo, useState } from "react";

type SeriesFilter = "all" | "sunday" | "midweek";

function isMidweekSession(eventName: string, eventDate: string): boolean {
  const lower = eventName.toLowerCase();
  if (
    lower.includes("midweek") ||
    lower.includes("wednesday") ||
    lower.includes("thursday") ||
    lower.includes("teaching")
  ) {
    return true;
  }
  const parsed = new Date(`${eventDate}T12:00:00`);
  if (!Number.isNaN(parsed.getTime())) {
    const day = parsed.getDay();
    return day !== 0; // Non-Sunday
  }
  return false;
}

export default function AttendanceTrendChart() {
  const { sessions, departments, records } = useAttendance();
  const [filter, setFilter] = useState<SeriesFilter>("all");

  const points = useMemo(() => {
    const chronological = [...sessions]
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
      .slice(-8);

    return chronological.map((s) => {
      const midweek = isMidweekSession(s.eventName, s.eventDate);
      const shortDate = formatDisplayDate(s.eventDate).replace(/,\s*\d{4}$/, "");
      return {
        id: s.id,
        label: shortDate,
        title: s.eventName,
        sunday: midweek ? 0 : s.registrationCount,
        midweek: midweek ? s.registrationCount : 0,
      };
    });
  }, [sessions]);

  const maxValue = useMemo(() => {
    if (points.length === 0) return 1;
    return Math.max(
      ...points.map((p) =>
        filter === "midweek" ? p.midweek : Math.max(p.sunday, p.midweek),
      ),
      1,
    );
  }, [points, filter]);

  const topDepartments = useMemo(() => {
    const countsByDept = new Map<string, number>();
    for (const r of records) {
      countsByDept.set(
        r.departmentId,
        (countsByDept.get(r.departmentId) ?? 0) + 1,
      );
    }

    const active = departments
      .filter((d) => d.isEnabled)
      .map((d) => ({
        ...d,
        loggedCount: countsByDept.get(d.id) ?? 0,
        effectiveCount: (countsByDept.get(d.id) ?? 0) || d.memberCount,
      }))
      .sort((a, b) => b.effectiveCount - a.effectiveCount)
      .slice(0, 4);

    const total =
      active.reduce((s, d) => s + d.effectiveCount, 0) || 1;

    return active.map((d) => ({
      ...d,
      sharePct:
        d.effectiveCount > 0
          ? Math.round((d.effectiveCount / total) * 100)
          : 0,
    }));
  }, [departments, records]);

  return (
    <Card className="justify-between gap-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-heading">
            Service Turnout &amp; Weekly Activity
          </h2>
          <p className="supporting-text mt-0.5">
            Comparative headcount across Sunday Celebration and Midweek Teaching
            services
          </p>
        </div>

        <div className="ln-segmented self-start sm:self-auto">
          {(
            [
              { id: "all", label: "All Services" },
              { id: "sunday", label: "Sundays" },
              { id: "midweek", label: "Midweek" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={cn(
                "ln-segment-item",
                filter === tab.id
                  ? "ln-segment-item-active"
                  : "ln-segment-item-inactive",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-5 text-xs font-medium text-(--ln-fg-muted)">
        {filter !== "midweek" && (
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-brand-500" />
            Sunday Celebration Services
          </span>
        )}
        {filter !== "sunday" && (
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-gold-500" />
            Midweek / Other Services
          </span>
        )}
      </div>

      {/* Daily Tracker-Style Interactive Bar Columns or Genuine Empty State */}
      {points.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon className="size-6" />}
          title="No attendance activity recorded yet"
          description="Once you create service sessions and attendees check in via QR code, live turnout bars will appear here."
          className="py-8"
        />
      ) : (
        <div
          className="grid h-52 items-end gap-2 pt-2 sm:gap-3"
          style={{
            gridTemplateColumns: `repeat(${Math.max(points.length, 4)}, minmax(0, 1fr))`,
          }}
        >
          {points.map((pt, idx) => {
            const isLatest = idx === points.length - 1;
            const sundayHeightPct =
              pt.sunday > 0
                ? Math.max(12, Math.round((pt.sunday / maxValue) * 100))
                : 4;
            const midweekHeightPct =
              pt.midweek > 0
                ? Math.max(10, Math.round((pt.midweek / maxValue) * 100))
                : 4;
            const primaryNumber =
              filter === "midweek"
                ? pt.midweek
                : filter === "sunday"
                  ? pt.sunday
                  : Math.max(pt.sunday, pt.midweek);

            return (
              <div
                key={pt.id}
                className="group flex h-full flex-col items-center justify-end gap-2"
              >
                <span
                  className={cn(
                    "tabular text-[11px] font-semibold transition-colors",
                    isLatest
                      ? "text-brand-600 dark:text-brand-400"
                      : "text-(--ln-fg-muted) group-hover:text-(--ln-fg-primary)",
                  )}
                >
                  {primaryNumber}
                </span>

                <div
                  title={`${pt.title} (${pt.label}) — Headcount: ${primaryNumber}`}
                  className={cn(
                    "relative flex h-full w-full items-end justify-center gap-1 overflow-hidden rounded-xl border p-1.5 transition-colors",
                    isLatest
                      ? "border-brand-500/35 bg-(--ln-surface-warm)"
                      : "border-transparent bg-(--ln-surface-warm)/60 group-hover:border-(--ln-border)",
                  )}
                >
                  {filter !== "midweek" && pt.sunday > 0 && (
                    <div
                      className="w-full rounded-md bg-brand-500 transition-all duration-500 group-hover:bg-brand-600"
                      style={{ height: `${sundayHeightPct}%` }}
                    />
                  )}
                  {filter !== "sunday" && pt.midweek > 0 && (
                    <div
                      className="w-full rounded-md bg-gold-500/90 transition-all duration-500 group-hover:bg-gold-600"
                      style={{ height: `${midweekHeightPct}%` }}
                    />
                  )}
                  {pt.sunday === 0 && pt.midweek === 0 && (
                    <div
                      className="w-full rounded-md bg-(--ln-border)"
                      style={{ height: "6%" }}
                    />
                  )}
                </div>

                <span
                  className={cn(
                    "max-w-full truncate text-[11px] font-medium",
                    isLatest
                      ? "font-semibold text-(--ln-fg-primary)"
                      : "text-(--ln-fg-muted)",
                  )}
                >
                  {pt.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Departmental Workforce Distribution (Daily Tracker Horizontal Progress Bars) */}
      <div className="border-t border-(--ln-border) pt-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold tracking-wider text-(--ln-fg-muted) uppercase">
            Top Departmental Participation
          </h3>
          <span className="text-xs text-(--ln-fg-muted)">
            Share of active workforce
          </span>
        </div>

        {topDepartments.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-(--ln-border) bg-(--ln-surface-warm)/30 p-4 text-xs text-(--ln-fg-muted)">
            <BuildingIcon className="size-4 shrink-0 text-brand-500" />
            <span>
              No church departments configured yet. Add departments in the{" "}
              <strong className="text-(--ln-fg-primary)">Departments</strong>{" "}
              tab to track workforce participation.
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {topDepartments.map((dept) => (
              <div
                key={dept.id}
                className="rounded-xl border border-(--ln-border) bg-(--ln-surface-warm)/40 p-3"
              >
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="truncate font-semibold text-(--ln-fg-primary)">
                    {dept.name}
                  </span>
                  <span className="tabular font-medium text-(--ln-fg-muted)">
                    {dept.loggedCount > 0
                      ? `${dept.loggedCount} check-ins`
                      : `${dept.memberCount} members`}{" "}
                    ({dept.sharePct}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-(--ln-border)/70">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all duration-500"
                    style={{ width: `${dept.sharePct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
