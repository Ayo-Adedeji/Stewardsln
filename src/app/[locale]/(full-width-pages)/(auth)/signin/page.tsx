import SignIn from "@/components/others/auth/sign-in";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Administrator Sign In",
  description:
    "Sign in to the Light Nation Ibadan Church Attendance Management System.",
};

export default function SignInPage() {
  return <SignIn />;
}
