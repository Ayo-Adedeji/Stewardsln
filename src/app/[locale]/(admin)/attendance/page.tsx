import AttendanceSessionsView from "@/components/attendance/sessions-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Attendance Sessions",
  description:
    "Manage Light Nation Ibadan service attendance sessions, opening/closing times, and QR check-in passes.",
};

export default function AttendanceSessionsPage() {
  return <AttendanceSessionsView />;
}
