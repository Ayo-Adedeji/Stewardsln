import PublicRegistrationView from "@/components/attendance/public-registration-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Service Check-In",
  description:
    "Fast mobile attendance registration for Light Nation Ibadan services.",
};

export default async function AttendTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicRegistrationView token={token} />;
}
