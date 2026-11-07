import AttendanceRecordsView from "@/components/attendance/records-view";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Attendance Records",
  description:
    "Search, filter, and export verified church attendance records for Light Nation Ibadan.",
};

export default function AttendanceRecordsPage() {
  return (
    <Suspense fallback={null}>
      <AttendanceRecordsView />
    </Suspense>
  );
}
