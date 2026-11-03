import AcceptInvitationView from "@/components/others/auth/invite";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accept Administrator Invitation",
  description:
    "Accept your invitation to join Light Nation Attendance administration.",
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <AcceptInvitationView token={decodeURIComponent(token)} />;
}
