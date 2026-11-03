import PublicRegistrationView from "@/components/attendance/public-registration-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Service Check-In",
  description:
    "Fast mobile attendance registration for Light Nation Ibadan services.",
};

export default function AttendDefaultPage() {
  return <PublicRegistrationView token="" />;
}
