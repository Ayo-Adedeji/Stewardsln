import DepartmentsView from "@/components/attendance/departments-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Departments",
  description:
    "Manage Light Nation Ibadan church departments and workforce units for attendance check-in.",
};

export default function DepartmentsPage() {
  return <DepartmentsView />;
}
