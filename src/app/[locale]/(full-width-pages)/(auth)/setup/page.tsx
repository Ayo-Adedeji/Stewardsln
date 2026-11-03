import FirstAdminSetup from "@/components/others/auth/setup";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "First Administrator Setup",
  description:
    "Configure the initial Super Administrator account for Light Nation Attendance.",
};

export default function SetupPage() {
  return <FirstAdminSetup />;
}
