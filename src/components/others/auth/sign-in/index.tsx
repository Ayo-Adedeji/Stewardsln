"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAttendance } from "@/context/attendance-context";
import { Link, useRouter } from "@/i18n/navigation";
import {
  AlertIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  EyeCloseIcon,
  EyeIcon,
  LockIcon,
} from "@/icons";
import { createClient } from "@/lib/supabase/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid administrator email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  keepLoggedIn: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function SignIn() {
  const router = useRouter();
  const { refreshData } = useAttendance();
  const supabase = useMemo(() => createClient(), []);

  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState<boolean>(false);
  const [migrationPending, setMigrationPending] = useState<boolean>(false);
  const [checkingSetup, setCheckingSetup] = useState<boolean>(true);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      keepLoggedIn: true,
    },
  });

  useEffect(() => {
    let active = true;
    async function checkInitialSetup() {
      try {
        const { data, error } = await supabase.rpc("is_initial_setup_required");
        if (!active) return;
        if (!error && data === true) {
          setSetupRequired(true);
        } else if (error && error.code === "PGRST202") {
          setMigrationPending(true);
        }
      } catch {
        // Ignore background probe errors; surfaced on submit if needed
      } finally {
        if (active) setCheckingSetup(false);
      }
    }
    void checkInitialSetup();
    return () => {
      active = false;
    };
  }, [supabase]);

  const onSubmit = async (values: LoginFormValues) => {
    setAuthError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email.trim(),
      password: values.password,
    });

    if (error || !data.user) {
      setAuthError(
        error?.message ||
          "Invalid email or password. Please verify your credentials and try again.",
      );
      return;
    }

    const { data: profile, error: profileErr } = await supabase
      .from("admin_profiles")
      .select("id, is_active")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileErr) {
      setAuthError(
        `Unable to verify administrator profile: ${profileErr.message}`,
      );
      return;
    }

    if (!profile) {
      await supabase.auth.signOut();
      setAuthError(
        "This account does not have an active Light Nation administrator profile.",
      );
      return;
    }

    if (!profile.is_active) {
      await supabase.auth.signOut();
      setAuthError(
        "Your administrator account has been deactivated. Contact a Super Administrator.",
      );
      return;
    }

    await refreshData();
    router.push("/");
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-3xl border border-(--ln-border) bg-(--ln-surface)/95 p-7 shadow-theme-lg backdrop-blur-xl sm:p-9">
        <div className="mb-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/25 bg-(--ln-surface-warm) px-3 py-1 text-xs font-semibold text-brand-600 dark:text-brand-400">
            <LockIcon className="size-3.5" />
            Administrator Sign In
          </span>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-(--ln-fg-primary)">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-(--ln-fg-muted)">
            Sign in to manage Light Nation Ibadan attendance sessions, QR passes,
            and departmental records.
          </p>
        </div>

        {!checkingSetup && migrationPending && (
          <div className="mb-5 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 text-xs text-amber-800 dark:text-amber-300">
            <p className="font-semibold">
              Database Migration Required
            </p>
            <p className="mt-1 leading-relaxed">
              Run{" "}
              <code className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono">
                supabase/migrations/20261101000001_initial_schema.sql
              </code>{" "}
              in your Supabase SQL Editor, then open{" "}
              <Link href="/setup" className="font-semibold underline">
                /setup
              </Link>{" "}
              to register your initial Super Admin account.
            </p>
          </div>
        )}

        {!checkingSetup && setupRequired && (
          <div className="mb-5 rounded-2xl border border-brand-500/35 bg-(--ln-surface-warm) p-4">
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="mt-0.5 size-5 shrink-0 text-brand-600 dark:text-brand-400" />
              <div className="flex-1 text-xs">
                <p className="font-semibold text-(--ln-fg-primary)">
                  Initial Super Administrator Setup Available
                </p>
                <p className="mt-1 leading-relaxed text-(--ln-fg-muted)">
                  No administrator account has been configured yet for this
                  installation. Register your initial Super Admin account now.
                </p>
                <Link
                  href="/setup"
                  className="mt-2.5 inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
                >
                  <span>Complete First-Admin Setup</span>
                  <ArrowRightIcon className="size-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {authError && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-700 dark:text-red-300"
          >
            <AlertIcon className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
            <span className="leading-relaxed">{authError}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <Field invalid={Boolean(errors.email)}>
            <FieldLabel>
              Administrator Email <span className="text-brand-600">*</span>
            </FieldLabel>
            <Input
              type="email"
              autoComplete="email"
              placeholder="you@lightnation.org"
              {...register("email")}
            />
            {errors.email && <FieldError>{errors.email.message}</FieldError>}
          </Field>

          <Field invalid={Boolean(errors.password)}>
            <FieldLabel>
              Password <span className="text-brand-600">*</span>
            </FieldLabel>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                className="pe-10"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-e-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-(--ln-fg-muted) transition-colors hover:bg-(--ln-surface-warm) hover:text-(--ln-fg-primary) active:scale-95"
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

          <div className="flex items-center justify-between gap-2 pt-1">
            <Field orientation="horizontal" className="w-auto">
              <Controller
                control={control}
                name="keepLoggedIn"
                render={({ field }) => (
                  <Checkbox
                    id="keepLoggedIn"
                    checked={Boolean(field.value)}
                    onCheckedChange={(checked) =>
                      field.onChange(Boolean(checked))
                    }
                  />
                )}
              />
              <Label
                htmlFor="keepLoggedIn"
                className="mb-0 cursor-pointer text-xs font-normal text-(--ln-fg-muted)"
              >
                Keep me signed in
              </Label>
            </Field>

            {setupRequired && (
              <Link
                href="/setup"
                className="text-xs font-medium text-brand-600 transition-colors hover:text-brand-700 hover:underline dark:text-brand-400"
              >
                Initial Setup
              </Link>
            )}
          </div>

          <Button
            type="submit"
            size="lg"
            leadingArrow
            loading={isSubmitting}
            loadingText="Signing in..."
            className="mt-2 w-full"
          >
            Sign In to Dashboard
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-between border-t border-(--ln-border) pt-4 text-xs text-(--ln-fg-muted)">
          <span>Administrator access is invite-only after initial setup.</span>
        </div>
      </div>
    </div>
  );
}
