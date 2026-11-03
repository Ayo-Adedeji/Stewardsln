"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAttendance } from "@/context/attendance-context";
import {
  BuildingIcon,
  CalendarIcon,
  CheckCircleIcon,
  QrCodeIcon,
  UsersIcon,
} from "@/icons";

const SEGMENT_COUNT = 24;
const DEFAULT_SERVICE_CAPACITY = 250;

interface DashboardStatsCardsProps {
  onOpenLiveQr?: (sessionId: string) => void;
}

export default function DashboardStatsCards({
  onOpenLiveQr,
}: DashboardStatsCardsProps) {
  const { sessions, departments, records } = useAttendance();

  const totalRegistrations = records.length;
  const openSession = sessions.find((s) => s.status === "open");
  const openSessionsCount = sessions.filter((s) => s.status === "open").length;
  const scheduledSessionsCount = sessions.filter(
    (s) => s.status === "scheduled",
  ).length;

  const completedOrOpen = sessions.filter((s) => s.registrationCount > 0);
  const avgAttendance =
    completedOrOpen.length > 0
      ? Math.round(
          completedOrOpen.reduce((sum, s) => sum + s.registrationCount, 0) /
            completedOrOpen.length,
        )
      : 0;

  const activeDeptsCount = departments.filter((d) => d.isEnabled).length;

  // Calculate radial turnout progress for the active or most recent service
  const benchmarkSession = openSession ?? sessions[0];
  const targetCapacity =
    benchmarkSession?.expectedCapacity || DEFAULT_SERVICE_CAPACITY;
  const currentTurnout = benchmarkSession?.registrationCount ?? 0;
  const turnoutPct =
    benchmarkSession && targetCapacity > 0
      ? Math.min(100, Math.round((currentTurnout / targetCapacity) * 100))
      : 0;
  const activeSegments = Math.round((turnoutPct / 100) * SEGMENT_COUNT);

  // 24-segment radial dial geometry (matching Daily Tracker's DailyProgressCard)
  const size = 168;
  const center = size / 2;
  const innerR = 54;
  const outerR = 74;

  const metrics = [
    {
      label: "Total Logged",
      value: totalRegistrations.toLocaleString(),
      subtext:
        totalRegistrations === 1
          ? "1 verified check-in"
          : `${totalRegistrations.toLocaleString()} verified check-ins`,
      badgeText: totalRegistrations > 0 ? "Verified" : "New",
      badgeColor:
        totalRegistrations > 0 ? ("success" as const) : ("gray" as const),
      icon: <UsersIcon className="size-4" />,
    },
    {
      label: "Active & Upcoming",
      value: String(openSessionsCount + scheduledSessionsCount),
      subtext: `${openSessionsCount} open · ${scheduledSessionsCount} scheduled`,
      badgeText: openSessionsCount > 0 ? "Live" : "Ready",
      badgeColor:
        openSessionsCount > 0 ? ("primary" as const) : ("gray" as const),
      icon: <CalendarIcon className="size-4" />,
    },
    {
      label: "Average Turnout",
      value: avgAttendance.toLocaleString(),
      subtext:
        completedOrOpen.length === 0
          ? "No attended services yet"
          : `Across ${completedOrOpen.length} ${completedOrOpen.length === 1 ? "service" : "services"}`,
      badgeText: "Benchmark",
      badgeColor: "warning" as const,
      icon: <CheckCircleIcon className="size-4" />,
    },
    {
      label: "Active Departments",
      value: `${activeDeptsCount}/${departments.length}`,
      subtext:
        departments.length === 0
          ? "No departments added yet"
          : "Workforce units enabled",
      badgeText: "Workforce",
      badgeColor: "gray" as const,
      icon: <BuildingIcon className="size-4" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Daily Tracker-Style 24-Segment Radial Turnout Card */}
      <Card className="justify-between gap-5 p-6 lg:col-span-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="section-heading">Service Turnout Progress</h2>
            <p className="supporting-text mt-0.5">
              {benchmarkSession
                ? benchmarkSession.eventName
                : "Create your first attendance session to track live turnout"}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/25 bg-(--ln-surface-warm) px-2.5 py-1 text-xs font-semibold text-brand-600 dark:text-brand-400">
            <span className="size-1.5 rounded-full bg-brand-500" />
            {openSession
              ? "Live Session"
              : benchmarkSession
                ? "Recent Service"
                : "Standby"}
          </span>
        </div>

        {/* 24-Segment Radial Dial */}
        <div className="flex flex-col items-center justify-center gap-6 py-1 sm:flex-row">
          <div
            className="relative flex shrink-0 items-center justify-center"
            style={{ width: size, height: size }}
          >
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              aria-label={`Service turnout ${turnoutPct}% of capacity`}
            >
              {Array.from({ length: SEGMENT_COUNT }).map((_, i) => {
                const angleDeg = (i / SEGMENT_COUNT) * 360 - 90;
                const angleRad = (angleDeg * Math.PI) / 180;
                const x1 = Number((center + innerR * Math.cos(angleRad)).toFixed(3));
                const y1 = Number((center + innerR * Math.sin(angleRad)).toFixed(3));
                const x2 = Number((center + outerR * Math.cos(angleRad)).toFixed(3));
                const y2 = Number((center + outerR * Math.sin(angleRad)).toFixed(3));
                const isActive = i < activeSegments;

                return (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isActive ? "var(--ln-primary)" : "var(--ln-border)"}
                    strokeWidth={5.5}
                    strokeLinecap="round"
                    style={{
                      transition: "stroke 300ms ease",
                    }}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="tabular text-3xl font-bold tracking-tight text-(--ln-fg-primary)">
                {turnoutPct}%
              </span>
              <span className="mt-0.5 text-[11px] font-medium text-(--ln-fg-muted)">
                of {targetCapacity} target
              </span>
            </div>
          </div>

          <div className="w-full flex-1 space-y-2.5">
            <div className="rounded-xl border border-(--ln-border) bg-(--ln-surface-warm)/60 p-3.5">
              <p className="text-xs font-medium text-(--ln-fg-muted)">
                Checked-In Headcount
              </p>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <p className="tabular text-2xl font-bold text-(--ln-fg-primary)">
                  {currentTurnout.toLocaleString()}
                </p>
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Verified QR
                </span>
              </div>
            </div>

            {openSession && onOpenLiveQr && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                trailingArrow
                onClick={() => onOpenLiveQr(openSession.id)}
                className="w-full justify-between"
              >
                <span className="inline-flex items-center gap-2">
                  <QrCodeIcon className="size-4 text-brand-600 dark:text-brand-400" />
                  Display Live Service QR
                </span>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* 4-Metric Summary Grid (Daily Tracker Sub-Card Proportions) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-7">
        {metrics.map((metric) => (
          <Card
            key={metric.label}
            className="justify-between gap-4 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300/80 hover:shadow-theme-md dark:hover:border-brand-500/40"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-medium text-(--ln-fg-muted)">
                <span className="flex size-8 items-center justify-center rounded-lg bg-(--ln-surface-warm) text-brand-600 dark:text-brand-400">
                  {metric.icon}
                </span>
                <span>{metric.label}</span>
              </div>
              <Badge variant="light" color={metric.badgeColor} size="sm">
                {metric.badgeText}
              </Badge>
            </div>

            <div>
              <p className="tabular text-2xl font-bold tracking-tight text-(--ln-fg-primary) sm:text-3xl">
                {metric.value}
              </p>
              <p className="mt-1 text-xs text-(--ln-fg-muted)">
                {metric.subtext}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
