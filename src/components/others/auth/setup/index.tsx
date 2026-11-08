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

const setupSchema = z
  .object({
    churchName: z
      .string()
      .min(2, "Church name must be at least 2 characters.")
      .max(80, "Church name is too long."),
    branchName: z
      .string()
      .min(2, "Branch/campus name must be at least 2 characters.")
      .max(80, "Branch name is too long."),
    fullName: z
      .string()
      .min(2, "Please enter your full name.")
      .max(80, "Name is too long."),
    email: z.string().email("Please enter a valid email address."),
    phone: z.string().max(40, "Phone number is too long.").optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters for Super Admin security."),
    confirmPassword: z.string().min(8, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type SetupFormValues = z.infer<typeof setupSchema>;

export default function FirstAdminSetup() {
  const router = useRouter();
  const { refreshData } = useAttendance();
  const supabase = useMemo(() => createClient(), []);

  const [checkingStatus, setCheckingStatus] = useState(true);
  const [setupAllowed, setSetupAllowed] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [awaitingEmailConfirm, setAwaitingEmailConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetupFormValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      churchName: "Light Nation",
      branchName: "Ibadan",
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    let active = true;

    async function verifyInitialSetupState() {
      setCheckingStatus(true);
      setSetupError(null);
      try {
        const { data, error } = await supabase.rpc("is_initial_setup_required");
        if (!active) return;

        if (error) {
          setSetupError(
            `Database check failed (${error.message}). Please ensure the SQL migration in supabase/migrations/20261101000001_initial_schema.sql has been applied to your Supabase project.`,
          );
          setSetupAllowed(false);
        } else {
          setSetupAllowed(Boolean(data));
        }
      } catch (err) {
        if (!active) return;
        setSetupError(
          err instanceof Error
            ? err.message
            : "Unable to verify initial setup state.",
        );
      } finally {
        if (active) setCheckingStatus(false);
      }
    }

    void verifyInitialSetupState();
    return () => {
      active = false;
    };
  }, [supabase]);

  const onSubmit = async (values: SetupFormValues) => {
    setSetupError(null);

    // Re-verify right before submitting that no admin exists yet
    const { data: stillRequired, error: checkErr } = await supabase.rpc(
      "is_initial_setup_required",
    );

    if (checkErr) {
      setSetupError(`Setup check failed: ${checkErr.message}`);
      return;
    }

    if (!stillRequired) {
      setSetupAllowed(false);
      setSetupError(
        "Initial setup has already been completed. Public administrator registration is now disabled.",
      );
      return;
    }

    const publicBaseUrl =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const { data: signUpData, error: signUpError } =
      await supabase.auth.signUp({
        email: values.email.trim(),
        password: values.password,
        options: {
          data: {
            setup_first_admin: true,
            church_name: values.churchName.trim(),
            branch_name: values.branchName.trim(),
            full_name: values.fullName.trim(),
            phone: values.phone?.trim() || "",
            public_base_url: publicBaseUrl,
          },
        },
      });

    if (signUpError) {
      setSetupError(signUpError.message);
      return;
    }

    if (!signUpData.user) {
      setSetupError("Registration could not be completed. Please try again.");
      return;
    }

    // If Supabase returned an active session right away (email confirmation disabled),
    // ensure bootstrap_first_admin is called and navigate straight to the dashboard.
    if (signUpData.session) {
      const { error: bootstrapErr } = await supabase.rpc(
        "bootstrap_first_admin",
        {
          p_church_name: values.churchName.trim(),
          p_branch_name: values.branchName.trim(),
          p_full_name: values.fullName.trim(),
          p_email: values.email.trim(),
          p_phone: values.phone?.trim() || "",
          p_public_base_url: publicBaseUrl,
        },
      );

      if (bootstrapErr) {
        setSetupError(bootstrapErr.message);
        return;
      }

      window.location.href = "/";
      return;
    }

    // If email confirmation is enabled on the Supabase project, the database trigger
    // has already created the organization and Super Admin profile and locked /setup.
    setAwaitingEmailConfirm(true);
  };

  if (checkingStatus) {
    return (
      <div className="mx-auto w-full max-w-md">
        <div className="flex flex-col items-center justify-center rounded-3xl border border-(--ln-border) bg-(--ln-surface)/95 p-10 text-center shadow-theme-lg backdrop-blur-xl">
          <Spinner className="size-7 text-brand-500" />
          <p className="mt-3 text-sm font-medium text-(--ln-fg-primary)">
            Verifying installation status...
          </p>
        </div>
      </div>
    );
  }

  if (awaitingEmailConfirm) {
    return (
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-3xl border border-(--ln-border) bg-(--ln-surface)/95 p-7 text-center shadow-theme-lg backdrop-blur-xl sm:p-9">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
            <CheckCircleIcon className="size-8" />
          </div>
          <h1 className="text-xl font-bold text-(--ln-fg-primary)">
            Super Administrator Account Created
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-(--ln-fg-muted)">
            Your initial Super Administrator account and church organization
            have been provisioned, and public administrator sign-up is now
            permanently locked. Please check your email inbox for a confirmation
            link (if email confirmation is enabled in Supabase), then sign in.
          </p>
          <Button
            size="lg"
            leadingArrow
            className="mt-6 w-full"
            nativeButton={false}
            render={<Link href="/login" />}
          >
            Proceed to Administrator Login
          </Button>
        </div>
      </div>
    );
  }

  if (!setupAllowed) {
    return (
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-3xl border border-(--ln-border) bg-(--ln-surface)/95 p-7 shadow-theme-lg backdrop-blur-xl sm:p-9">
          <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-(--ln-surface-warm) text-brand-600 dark:text-brand-400">
            <LockIcon className="size-6" />
          </div>

          <h1 className="text-xl font-semibold text-(--ln-fg-primary)">
            Initial Setup Locked
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-(--ln-fg-muted)">
            {setupError ||
              "An initial Super Administrator has already been registered for this installation. Public administrator registration is disabled — additional administrators must be invited from System Settings."}
          </p>

          <Button
            size="lg"
            leadingArrow
            className="mt-6 w-full"
            nativeButton={false}
            render={<Link href="/login" />}
          >
            Go to Administrator Sign In
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
            One-Time Bootstrap
          </span>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-(--ln-fg-primary)">
            First Administrator Setup
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-(--ln-fg-muted)">
            Create your initial Super Administrator account. Once completed,
            public registration will automatically lock and future admins will
            require an invitation.
          </p>
        </div>

        {setupError && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-700 dark:text-red-300"
          >
            <AlertIcon className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
            <span className="leading-relaxed">{setupError}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field invalid={Boolean(errors.churchName)}>
              <FieldLabel>
                Church Name <span className="text-brand-600">*</span>
              </FieldLabel>
              <Input placeholder="Light Nation" {...register("churchName")} />
              {errors.churchName && (
                <FieldError>{errors.churchName.message}</FieldError>
              )}
            </Field>

            <Field invalid={Boolean(errors.branchName)}>
              <FieldLabel>
                Branch / Campus <span className="text-brand-600">*</span>
              </FieldLabel>
              <Input placeholder="Ibadan" {...register("branchName")} />
              {errors.branchName && (
                <FieldError>{errors.branchName.message}</FieldError>
              )}
            </Field>
          </div>

          <Field invalid={Boolean(errors.fullName)}>
            <FieldLabel>
              Your Full Name <span className="text-brand-600">*</span>
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field invalid={Boolean(errors.email)}>
              <FieldLabel>
                Email Address <span className="text-brand-600">*</span>
              </FieldLabel>
              <Input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...register("email")}
              />
              {errors.email && (
                <FieldError>{errors.email.message}</FieldError>
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
              {errors.phone && (
                <FieldError>{errors.phone.message}</FieldError>
              )}
            </Field>
          </div>

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
                aria-label={showPassword ? "Hide password" : "Show password"}
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
            loadingText="Provisioning Super Admin..."
            className="mt-2 w-full"
          >
            Create Super Administrator Account
          </Button>
        </form>

        <div className="mt-5 flex items-center justify-between border-t border-(--ln-border) pt-4 text-xs text-(--ln-fg-muted)">
          <span>Already configured your account?</span>
          <Link
            href="/login"
            className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
