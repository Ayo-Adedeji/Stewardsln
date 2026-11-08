"use client";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAttendance } from "@/context/attendance-context";
import { Link, useRouter } from "@/i18n/navigation";
import {
  AlertIcon,
  CheckCircleIcon,
  EyeCloseIcon,
  EyeIcon,
  LockIcon,
} from "@/icons";
import { createClient } from "@/lib/supabase/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const inviteSchema = z
  .object({
    fullName: z.string().min(2, "Please enter your full name.").max(80),
    phone: z.string().max(40).optional(),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(8, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type InviteFormValues = z.infer<typeof inviteSchema>;

interface InvitationInfo {
  valid: boolean;
  reason?: string;
  email?: string;
  role?: string;
  churchName?: string;
  branchName?: string;
}

export default function AcceptInvitationView({ token }: { token: string }) {
  const router = useRouter();
  const { refreshData } = useAttendance();
  const supabase = useMemo(() => createClient(), []);

  const [loadingInvite, setLoadingInvite] = useState(true);
  const [inviteInfo, setInviteInfo] = useState<InvitationInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [completed, setCompleted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    let active = true;
    async function loadInvitation() {
      setLoadingInvite(true);
      try {
        const { data, error } = await supabase.rpc("get_invitation_by_token", {
          p_token: token,
        });
        if (!active) return;
        if (error) {
          setErrorMessage(error.message);
          setInviteInfo({ valid: false });
        } else {
          setInviteInfo(data as InvitationInfo);
        }
      } catch (err) {
        if (!active) return;
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to load invitation.",
        );
      } finally {
        if (active) setLoadingInvite(false);
      }
    }
    void loadInvitation();
    return () => {
      active = false;
    };
  }, [supabase, token]);

  const onSubmit = async (values: InviteFormValues) => {
    if (!inviteInfo?.valid || !inviteInfo.email) return;
    setErrorMessage(null);

    const { data, error } = await supabase.auth.signUp({
      email: inviteInfo.email,
      password: values.password,
      options: {
        data: {
          invite_token: token,
          full_name: values.fullName.trim(),
          phone: values.phone?.trim() || "",
        },
      },
    });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (data.session) {
      window.location.href = "/";
      return;
    }

    setCompleted(true);
  };

  if (loadingInvite) {
    return (
      <div className="mx-auto w-full max-w-md">
        <div className="flex flex-col items-center justify-center rounded-3xl border border-(--ln-border) bg-(--ln-surface)/95 p-10 text-center shadow-theme-lg backdrop-blur-xl">
          <Spinner className="size-7 text-brand-500" />
          <p className="mt-3 text-sm font-medium text-(--ln-fg-primary)">
            Verifying administrator invitation...
          </p>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-3xl border border-(--ln-border) bg-(--ln-surface)/95 p-7 text-center shadow-theme-lg backdrop-blur-xl sm:p-9">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
            <CheckCircleIcon className="size-8" />
          </div>
          <h1 className="text-xl font-bold text-(--ln-fg-primary)">
            Administrator Invitation Accepted
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-(--ln-fg-muted)">
            Your administrator account has been created. Please confirm your
            email address if prompted by Supabase, then sign in to the
            dashboard.
          </p>
          <Button
            size="lg"
            leadingArrow
            className="mt-6 w-full"
            nativeButton={false}
            render={<Link href="/login" />}
          >
            Proceed to Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (!inviteInfo?.valid) {
    return (
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-3xl border border-(--ln-border) bg-(--ln-surface)/95 p-7 shadow-theme-lg backdrop-blur-xl sm:p-9">
          <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-red-500/12 text-red-600 dark:text-red-400">
            <AlertIcon className="size-6" />
          </div>
          <h1 className="text-xl font-semibold text-(--ln-fg-primary)">
            Invitation Invalid or Expired
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-(--ln-fg-muted)">
            {errorMessage ||
              "This administrator invitation link is invalid, has expired, or has already been accepted. Please request a new invitation from a Super Administrator."}
          </p>
          <Button
            size="lg"
            leadingArrow
            className="mt-6 w-full"
            nativeButton={false}
            render={<Link href="/login" />}
          >
            Back to Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-3xl border border-(--ln-border) bg-(--ln-surface)/95 p-7 shadow-theme-lg backdrop-blur-xl sm:p-9">
        <div className="mb-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/25 bg-(--ln-surface-warm) px-3 py-1 text-xs font-semibold text-brand-600 dark:text-brand-400">
            <LockIcon className="size-3.5" />
            Administrator Invitation
          </span>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-(--ln-fg-primary)">
            Join {inviteInfo.churchName} {inviteInfo.branchName}
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-(--ln-fg-muted)">
            Complete your administrator profile for{" "}
            <strong className="text-(--ln-fg-primary)">
              {inviteInfo.email}
            </strong>
            .
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-700 dark:text-red-300"
          >
            <AlertIcon className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <Field>
            <FieldLabel>Invited Email</FieldLabel>
            <Input value={inviteInfo.email} disabled />
          </Field>

          <Field invalid={Boolean(errors.fullName)}>
            <FieldLabel>
              Full Name <span className="text-brand-600">*</span>
            </FieldLabel>
            <Input
              autoComplete="name"
              placeholder="Enter your full name"
              {...register("fullName")}
            />
            {errors.fullName && (
              <FieldError>{errors.fullName.message}</FieldError>
            )}
          </Field>

          <Field invalid={Boolean(errors.phone)}>
            <FieldLabel>Phone Number</FieldLabel>
            <Input
              type="tel"
              autoComplete="tel"
              placeholder="+234 800 000 0000"
              {...register("phone")}
            />
          </Field>

          <Field invalid={Boolean(errors.password)}>
            <FieldLabel>
              Password <span className="text-brand-600">*</span>
            </FieldLabel>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                className="pe-10"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-e-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-(--ln-fg-muted) hover:text-(--ln-fg-primary)"
              >
                {showPassword ? (
                  <EyeIcon className="size-4.5" />
                ) : (
                  <EyeCloseIcon className="size-4.5" />
                )}
              </button>
            </div>
            {errors.password && (
              <FieldError>{errors.password.message}</FieldError>
            )}
          </Field>

          <Field invalid={Boolean(errors.confirmPassword)}>
            <FieldLabel>
              Confirm Password <span className="text-brand-600">*</span>
            </FieldLabel>
            <Input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <FieldError>{errors.confirmPassword.message}</FieldError>
            )}
          </Field>

          <Button
            type="submit"
            size="lg"
            leadingArrow
            loading={isSubmitting}
            loadingText="Activating Account..."
            className="mt-2 w-full"
          >
            Accept Invitation &amp; Sign In
          </Button>
        </form>
      </div>
    </div>
  );
}
