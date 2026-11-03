import AnalyticsView from "@/components/attendance/analytics-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Attendance Analytics",
  description:
    "Comprehensive attendance analytics and turnout trends for Light Nation Church.",
};

export default function AnalyticsPage() {
  return <AnalyticsView />;
}
