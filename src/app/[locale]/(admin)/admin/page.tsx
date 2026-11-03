import DashboardOverview from "@/components/dashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Overview",
  description: "Light Nation Ibadan Church Attendance Management System.",
};

export default function AdminAliasPage() {
  return <DashboardOverview />;
}
