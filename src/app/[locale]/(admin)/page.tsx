import DashboardOverview from "@/components/dashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard Overview",
  description:
    "Light Nation Ibadan Church Attendance Management Dashboard — Service statistics, active QR sessions, and attendance trends.",
};

export default function AdminDashboardPage() {
  return <DashboardOverview />;
}
