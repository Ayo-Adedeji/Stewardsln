"use client";

import CreateSessionModal from "@/components/attendance/create-session-modal";
import QrCodeModal from "@/components/attendance/qr-code-modal";
import { FadeIn } from "@/components/shared/motion";
import PageHeader from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useAttendance } from "@/context/attendance-context";
import { Link } from "@/i18n/navigation";
import { PlusIcon, QrCodeIcon } from "@/icons";
import type { AttendanceSession } from "@/types/attendance";
import { useState } from "react";
import AttendanceTrendChart from "./attendance-trend-chart";
import RecentSessionsCard from "./recent-sessions-card";
import DashboardStatsCards from "./stats-cards";
import UpcomingSessionsCard from "./upcoming-sessions-card";

export default function DashboardOverview() {
  const { sessions, settings } = useAttendance();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedQrSessionId, setSelectedQrSessionId] = useState<string | null>(
    null,
  );

  const selectedQrSession =
    sessions.find((s) => s.id === selectedQrSessionId) ?? null;

  const openSession = sessions.find((s) => s.status === "open");

  const handleSessionCreated = (created: AttendanceSession) => {
    setSelectedQrSessionId(created.id);
  };

  return (
    <div className="space-y-8">
      <FadeIn>
        <PageHeader
          subtitle="Light Nation Ibadan · Administration"
          title={`Welcome back, ${settings.adminName.split(" ")[0] || "Admin"}`}
          description="Monitor live service turnout, activate QR check-in passes, and review departmental attendance."
          actions={
            <>
              {openSession && (
                <Button
                  variant="brand-outline"
                  onClick={() => setSelectedQrSessionId(openSession.id)}
                >
                  <QrCodeIcon className="size-4" />
                  Live Service QR
                </Button>
              )}
              <Button
                variant="outline"
                leadingArrow
                nativeButton={false}
                render={<Link href="/analytics" />}
              >
                Analytics &amp; Trends
              </Button>
              <Button
                variant="outline"
                leadingArrow
                nativeButton={false}
                render={<Link href="/records" />}
              >
                View Attendance Records
              </Button>
              <Button onClick={() => setIsCreateOpen(true)}>
                <PlusIcon className="size-4" />
                Create Session
              </Button>
            </>
          }
        />
      </FadeIn>

      <FadeIn delayMs={40}>
        <DashboardStatsCards
          onOpenLiveQr={(sessionId) => setSelectedQrSessionId(sessionId)}
        />
      </FadeIn>

      <div className="grid grid-cols-12 gap-6">
        <FadeIn delayMs={80} className="col-span-12 xl:col-span-8">
          <AttendanceTrendChart />
        </FadeIn>

        <FadeIn delayMs={120} className="col-span-12 xl:col-span-4">
          <UpcomingSessionsCard
            onSelectQr={(session) => setSelectedQrSessionId(session.id)}
            onCreateSession={() => setIsCreateOpen(true)}
          />
        </FadeIn>

        <FadeIn delayMs={160} className="col-span-12">
          <RecentSessionsCard
            onSelectQr={(session) => setSelectedQrSessionId(session.id)}
            onCreateSession={() => setIsCreateOpen(true)}
          />
        </FadeIn>
      </div>

      <CreateSessionModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={handleSessionCreated}
      />

      <QrCodeModal
        session={selectedQrSession}
        open={Boolean(selectedQrSession)}
        onOpenChange={(open) => {
          if (!open) setSelectedQrSessionId(null);
        }}
      />
    </div>
  );
}
