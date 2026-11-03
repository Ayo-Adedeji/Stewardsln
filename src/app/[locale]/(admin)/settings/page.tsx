import SettingsView from "@/components/attendance/settings-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
  description:
    "Configure Light Nation Ibadan branding, theme modes, and attendance management settings.",
};

export default function SettingsPage() {
  return <SettingsView />;
}
