"use client";

import AmbientBackground from "@/components/shared/ambient-background";
import BrandLogo from "@/components/shared/brand-logo";
import { ScaleIn } from "@/components/shared/motion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useAttendance } from "@/context/attendance-context";
import {
  AlertIcon,
  CalendarIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  LockIcon,
  OctagonAlertIcon,
} from "@/icons";
import { createClient } from "@/lib/supabase/client";
import type {
  AttendanceRecord,
  Department,
  FormFieldDefinition,
  PublicRegistrationState,
} from "@/types/attendance";
import {
  CENTRAL_CHURCH_DEPARTMENTS,
  formatDisplayDate,
  formatTime12h,
} from "@/utils";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

interface PublicRegistrationViewProps {
  token: string;
}

interface PublicSessionPayload {
  outcome: "open" | "not-open" | "closed" | "invalid-qr";
  accessType?: "general" | "protocol";
  churchName?: string;
  branchName?: string;
  session?: {
    id: string;
    title: string;
    sessionType: string;
    date: string;
    startTime: string;
    endTime: string;
    opensAt: string;
    closesAt: string;
    timezone: string;
    location: string;
    notes: string;
    allowOtherDepartment: boolean;
    registrationCount: number;
  };
  form?: {
    version: number;
    fields: FormFieldDefinition[];
  };
  departments?: {
    id: string;
    name: string;
    code: string;
  }[];
  gps?: {
    required: boolean;
    configured: boolean;
    radiusM: number;
    accuracyThresholdM: number;
  };
}

export default function PublicRegistrationView({
  token,
}: PublicRegistrationViewProps) {
  const supabase = useMemo(() => createClient(), []);
  const { submitGpsAttendance, submitProtocolAttendance } = useAttendance();

  const [viewState, setViewState] =
    useState<PublicRegistrationState>("loading");
  const [sessionData, setSessionData] = useState<PublicSessionPayload | null>(
    null,
  );
  const [formFields, setFormFields] = useState<FormFieldDefinition[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Form input state
  const [fullName, setFullName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [customResponses, setCustomResponses] = useState<Record<string, unknown>>({});
  const [customDepartment, setCustomDepartment] = useState("");
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  // GPS state
  const [isLocating, setIsLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);

  const [submittedRecord, setSubmittedRecord] =
    useState<AttendanceRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load session from server
  useEffect(() => {
    let active = true;

    async function loadSession() {
      setViewState("loading");
      setFormError(null);

      try {
        const { data, error } = await supabase.rpc(
          "get_public_session_by_token",
          {
            p_token: token.trim(),
          },
        );

        if (!active) return;

        if (error || !data) {
          setFormError(
            error?.message || "Unable to verify attendance session link.",
          );
          setViewState("invalid-qr");
          return;
        }

        const payload = data as PublicSessionPayload;
        setSessionData(payload);

        if (payload.form?.fields) {
          setFormFields(payload.form.fields);
        }

        if (payload.departments && payload.departments.length > 0) {
          setDepartments(
            payload.departments.map((d) => ({
              id: d.id,
              name: d.name,
              code: d.code,
              description: "",
              leaderName: "",
              isEnabled: true,
              memberCount: 0,
              createdAt: "",
            })),
          );
        } else {
          // Central church department fallback
          setDepartments(
            CENTRAL_CHURCH_DEPARTMENTS.map((d) => ({
              id: d.code,
              name: d.name,
              code: d.code,
              description: d.description,
              leaderName: d.leadName || "",
              isEnabled: true,
              memberCount: 0,
              createdAt: "",
            })),
          );
        }

        if (payload.outcome === "open") {
          setViewState("form");
        } else if (payload.outcome === "not-open") {
          setViewState("not-open");
        } else if (payload.outcome === "closed") {
          setViewState("closed");
        } else {
          setViewState("invalid-qr");
        }
      } catch (err) {
        if (!active) return;
        setFormError(
          err instanceof Error
            ? err.message
            : "Unable to connect to attendance server.",
        );
        setViewState("invalid-qr");
      }
    }

    void loadSession();
    return () => {
      active = false;
    };
  }, [supabase, token]);

  // Request browser GPS position
  const requestLocation = (): Promise<{
    latitude: number;
    longitude: number;
    accuracy: number;
  }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(
          new Error("Geolocation is not supported by your mobile browser."),
        );
        return;
      }

      setIsLocating(true);
      setGpsError(null);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setIsLocating(false);
          const coords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          setUserLocation(coords);
          resolve(coords);
        },
        (err) => {
          setIsLocating(false);
          let message =
            "Location access denied or unavailable. Please enable GPS permissions.";
          if (err.code === 1) {
            message =
              "Location permission denied. Please allow location access in your browser settings.";
          } else if (err.code === 2) {
            message =
              "GPS position unavailable. Please check that location is enabled on your phone.";
          } else if (err.code === 3) {
            message = "Location request timed out. Please retry.";
          }
          setGpsError(message);
          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 10000,
        },
      );
    });
  };

  const handleCustomResponseChange = (fieldId: string, value: unknown) => {
    setCustomResponses((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!fullName.trim() || fullName.trim().length < 3) {
      errors.fullName = "Please enter your full name (at least 3 characters).";
    }

    const hasDeptField = formFields.some((f) => f.type === "department");
    if (hasDeptField && !departmentId) {
      errors.departmentId = "Please select your department from the dropdown.";
    }
    // If "Other" selected, require custom department
    if (departmentId === "other" && (!customDepartment || !customDepartment.trim())) {
      errors.customDepartment = "Please specify your department name.";
    }

    for (const f of formFields) {
      if (f.type === "full_name" || f.type === "department") continue;
      const val = customResponses[f.id];

      if (f.required) {
        if (
          val === undefined ||
          val === null ||
          val === "" ||
          (Array.isArray(val) && val.length === 0)
        ) {
          errors[f.id] = `"${f.label}" is required.`;
        }
      }

      if (val !== undefined && val !== null && val !== "") {
        if (f.type === "email" && typeof val === "string") {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
            errors[f.id] = "Please enter a valid email address.";
          }
        } else if (f.type === "phone" && typeof val === "string") {
          const digits = val.replace(/\D/g, "");
          if (digits.length < 7 || digits.length > 15) {
            errors[f.id] = "Please enter a valid phone number.";
          }
        }
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      let result;

      // Check whether this session link requires GPS (General QR) or is exempted (Protocol QR)
      const isGpsExempted = sessionData?.gps?.required === false;

      if (isGpsExempted) {
        // Protocol QR check-in: no GPS requested or needed
        result = await submitProtocolAttendance({
          token,
          fullName: fullName.trim(),
          departmentId: departmentId || "congregation",
          customDepartment: departmentId === "other" ? customDepartment : undefined,
          responses: customResponses,
        });
      } else {
        // General QR check-in: request browser GPS position
        let coords = userLocation;
        if (!coords) {
          try {
            coords = await requestLocation();
          } catch {
            setIsSubmitting(false);
            setViewState("location-required");
            return;
          }
        }

        result = await submitGpsAttendance({
          token,
          fullName: fullName.trim(),
          departmentId: departmentId || "congregation",
          responses: customResponses,
          customDepartment: departmentId === "other" ? customDepartment : undefined,
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        });
      }

      if (result.outcome === "outside-geofence") {
        setViewState("outside-geofence");
      } else if (result.outcome === "poor-accuracy") {
        setViewState("poor-accuracy");
      } else if (result.outcome === "location-required") {
        setViewState("location-required");
      } else if (result.outcome === "success") {
        if (result.record) setSubmittedRecord(result.record);
        setViewState("success");
      } else if (result.outcome === "duplicate") {
        if (result.record) setSubmittedRecord(result.record);
        setViewState("duplicate");
      } else if (result.outcome === "not-open") {
        setViewState("not-open");
      } else if (result.outcome === "closed") {
        setViewState("closed");
      } else {
        setFormError(result.errorMessage || "Submission was not accepted.");
        setViewState("form");
      }
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Attendance submission failed. Please try again.",
      );
      setViewState("form");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFullName("");
    setDepartmentId("");
    setCustomDepartment("");
    setCustomResponses({});
    setValidationErrors({});
    setUserLocation(null);
    setSubmittedRecord(null);
    setFormError(null);
    setIsSubmitting(false);
    setViewState("form");
  };

  return (
    <div className="relative flex min-h-dvh flex-col justify-between overflow-x-hidden overflow-y-auto bg-(--ln-bg-canvas) px-4 py-4 text-(--ln-fg-primary) transition-colors duration-200 sm:px-6 sm:py-6">
      <AmbientBackground intensity="soft" />

      {/* Brand Header */}
      <header className="relative z-10 mx-auto flex w-full max-w-md items-center justify-between py-1">
        <BrandLogo size="sm" href={undefined} />
        {viewState === "form" && (
          sessionData?.gps?.required === false ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/25 bg-brand-500/10 px-2.5 py-1 text-[11px] font-semibold text-brand-700 dark:text-brand-300">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-brand-500" />
              </span>
              Protocol Desk Check-In
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
              </span>
              General Check-In Open
            </span>
          )
        )}
      </header>

      {/* Main Single-Column Mobile-First Container */}
      <main className="relative z-10 mx-auto my-auto flex w-full max-w-md flex-col justify-center py-3">
        <div className="overflow-hidden rounded-3xl border border-(--ln-border) bg-(--ln-surface)/95 shadow-theme-lg backdrop-blur-xl">
          {/* Welcome Banner */}
          {sessionData?.session && viewState !== "invalid-qr" && (
            <div className="relative overflow-hidden border-b border-(--ln-border) bg-(--ln-surface-warm) px-5 py-4 sm:px-6">
              <div className="pointer-events-none absolute -top-10 -end-10 size-28 rounded-full bg-brand-500/12 blur-2xl" />

              <div className="relative z-10">
                <h1 className="text-lg font-bold tracking-tight text-(--ln-fg-primary) sm:text-xl">
                  Welcome to church.
                </h1>
                <p className="mt-0.5 text-xs text-(--ln-fg-muted) sm:text-sm">
                  We&apos;re glad you&apos;re worshipping with us today.
                </p>

                {/* Dynamic Service Pill */}
                <div className="mt-3 rounded-xl border border-(--ln-border) bg-(--ln-surface) px-3.5 py-2.5 shadow-theme-xs">
                  <p className="text-xs font-semibold text-(--ln-fg-primary) sm:text-sm">
                    {sessionData.session.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-(--ln-fg-muted)">
                    <span className="inline-flex items-center gap-1">
                      <CalendarIcon className="size-3.5 text-brand-500 dark:text-brand-400" />
                      {formatDisplayDate(sessionData.session.date)}
                    </span>
                    <span className="tabular inline-flex items-center gap-1">
                      <ClockIcon className="size-3.5 text-brand-500 dark:text-brand-400" />
                      {formatTime12h(sessionData.session.startTime)} –{" "}
                      {formatTime12h(sessionData.session.endTime)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Card Body */}
          <div className="p-5 sm:p-6">
            {formError && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300"
              >
                <AlertIcon className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
                <span>{formError}</span>
              </div>
            )}

            {/* STATE 1: ACTIVE DYNAMIC REGISTRATION FORM */}
            {viewState === "form" && (
              <ScaleIn>
                <div className="mb-4">
                  <h2 className="text-base font-bold tracking-tight text-(--ln-fg-primary)">
                    Register your attendance.
                  </h2>
                  <p className="mt-0.5 text-xs text-(--ln-fg-muted)">
                    {sessionData?.gps?.required === false
                      ? "Entrance Desk Check-In • Location verification exempted."
                      : "Physical presence verified via device GPS."}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  {/* Full Name */}
                  <Field invalid={Boolean(validationErrors.fullName)}>
                    <FieldLabel>
                      Full Name <span className="text-brand-500">*</span>
                    </FieldLabel>
                    <Input
                      type="text"
                      autoComplete="name"
                      autoFocus
                      disabled={isSubmitting}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                      className="h-11 text-base sm:text-sm"
                    />
                    {validationErrors.fullName && (
                      <FieldError>{validationErrors.fullName}</FieldError>
                    )}
                  </Field>

                  {/* Department (if included in form) */}
                  {formFields.some((f) => f.type === "department") && (
                    <Field invalid={Boolean(validationErrors.departmentId)}>
                      <FieldLabel>
                        Department <span className="text-brand-500">*</span>
                      </FieldLabel>
                      <Select
                        value={departmentId}
                        disabled={isSubmitting}
                        onValueChange={(val) => setDepartmentId(val ?? "")}
                      >
                        <SelectTrigger className="h-11 text-base sm:text-sm">
                          <SelectValue placeholder="Select your department">
                            {(val) => {
                              if (!val) return "Select your department";
                              if (val === "congregation")
                                return "General Congregation / Member";
                              if (val === "other")
                                return "Other (Specify Department)";
                              const found = departments.find(
                                (d) => d.id === val || d.code === val,
                              );
                              return found ? found.name : val;
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                                                    {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="congregation">
                            General Congregation / Member
                          </SelectItem>
                          <SelectItem value="other">
                            Other (Specify Department)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {validationErrors.departmentId && (
                        <FieldError>{validationErrors.departmentId}</FieldError>
                      )}
                      {/* Show custom department input when "Other" selected */}
                      {departmentId === "other" && (
                        <Field invalid={Boolean(validationErrors.customDepartment)} className="mt-2">
                          <FieldLabel>
                            Specify Department <span className="text-brand-500">*</span>
                          </FieldLabel>
                          <Input
                            type="text"
                            placeholder="Enter your department"
                            disabled={isSubmitting}
                            value={customDepartment}
                            onChange={(e) => setCustomDepartment(e.target.value)}
                            className="h-11 text-base sm:text-sm"
                          />
                          {validationErrors.customDepartment && (
                            <FieldError>{validationErrors.customDepartment}</FieldError>
                          )}
                        </Field>
                      )}

                    </Field>
                  )}

                  {/* DYNAMIC QUESTIONS RENDERED BASED ON SESSION FORM SCHEMA */}
                  {formFields.map((field) => {
                    if (field.type === "full_name" || field.type === "department") {
                      return null; // Rendered above
                    }

                    const val = customResponses[field.id];
                    const err = validationErrors[field.id];

                    return (
                      <Field key={field.id} invalid={Boolean(err)}>
                        <FieldLabel>
                          {field.label}{" "}
                          {field.required && (
                            <span className="text-brand-500">*</span>
                          )}
                        </FieldLabel>

                        {/* SELECT DROPDOWN */}
                        {field.type === "select" ? (
                          <Select
                            value={String(val || "")}
                            disabled={isSubmitting}
                            onValueChange={(v) =>
                              handleCustomResponseChange(field.id, v ?? "")
                            }
                          >
                            <SelectTrigger className="h-11 text-base sm:text-sm">
                              <SelectValue
                                placeholder={
                                  field.helpText || "Select an option..."
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {(field.options || []).map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : field.type === "radio" ? (
                          /* RADIO BUTTONS */
                          <div className="space-y-2 pt-1">
                            {(field.options || []).map((opt) => (
                              <label
                                key={opt}
                                className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-(--ln-border) bg-(--ln-surface-warm)/30 p-2.5 text-xs font-medium text-(--ln-fg-primary) hover:bg-(--ln-surface-warm)"
                              >
                                <input
                                  type="radio"
                                  name={field.id}
                                  value={opt}
                                  checked={val === opt}
                                  onChange={() =>
                                    handleCustomResponseChange(field.id, opt)
                                  }
                                  className="text-brand-600 focus:ring-brand-500"
                                />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        ) : field.type === "checkbox" ? (
                          /* CHECKBOXES */
                          <div className="space-y-2 pt-1">
                            {(field.options || []).map((opt) => {
                              const arr = Array.isArray(val) ? val : [];
                              const isChecked = arr.includes(opt);
                              return (
                                <label
                                  key={opt}
                                  className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-(--ln-border) bg-(--ln-surface-warm)/30 p-2.5 text-xs font-medium text-(--ln-fg-primary) hover:bg-(--ln-surface-warm)"
                                >
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={(c) => {
                                      const next = c
                                        ? [...arr, opt]
                                        : arr.filter((x: string) => x !== opt);
                                      handleCustomResponseChange(field.id, next);
                                    }}
                                  />
                                  <span>{opt}</span>
                                </label>
                              );
                            })}
                          </div>
                        ) : field.type === "yes_no" ? (
                          /* YES / NO BUTTONS */
                          <div className="grid grid-cols-2 gap-2.5 pt-1">
                            <button
                              type="button"
                              onClick={() =>
                                handleCustomResponseChange(field.id, "yes")
                              }
                              className={`rounded-xl border p-2.5 text-xs font-semibold transition-all ${
                                val === "yes"
                                  ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400"
                                  : "border-(--ln-border) bg-(--ln-surface-warm)/40 text-(--ln-fg-secondary)"
                              }`}
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleCustomResponseChange(field.id, "no")
                              }
                              className={`rounded-xl border p-2.5 text-xs font-semibold transition-all ${
                                val === "no"
                                  ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400"
                                  : "border-(--ln-border) bg-(--ln-surface-warm)/40 text-(--ln-fg-secondary)"
                              }`}
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          /* TEXT / EMAIL / PHONE / NUMBER */
                          <Input
                            type={
                              field.type === "email"
                                ? "email"
                                : field.type === "phone"
                                  ? "tel"
                                  : field.type === "number"
                                    ? "number"
                                    : "text"
                            }
                            disabled={isSubmitting}
                            value={String(val || "")}
                            onChange={(e) =>
                              handleCustomResponseChange(
                                field.id,
                                e.target.value,
                              )
                            }
                            placeholder={field.helpText || `Enter ${field.label.toLowerCase()}`}
                            className="h-11 text-base sm:text-sm"
                          />
                        )}

                        {err && <FieldError>{err}</FieldError>}
                      </Field>
                    );
                  })}

                  <div className="pt-2">
                    <Button
                      type="submit"
                      size="lg"
                      loading={isSubmitting || isLocating}
                      loadingText={
                        isLocating
                          ? "Checking church location..."
                          : "Submitting attendance..."
                      }
                      className="h-12 w-full text-base font-semibold"
                    >
                      {sessionData?.gps?.required === false
                        ? "Submit Attendance"
                        : "Verify GPS & Submit Attendance"}
                    </Button>
                    <p className="mt-2 text-center text-[11px] text-(--ln-fg-muted)">
                      {sessionData?.gps?.required === false
                        ? "Assisted protocol check-in at Light Nation church entrance."
                        : "Your location is only checked at submission to confirm you are at church. Coordinates are not permanently stored."}
                    </p>
                  </div>
                </form>
              </ScaleIn>
            )}

            {/* STATE: LOCATION REQUIRED / ACCESS DENIED */}
            {viewState === "location-required" && (
              <ScaleIn className="flex flex-col items-center py-4 text-center">
                <div className="mb-3.5 flex size-14 items-center justify-center rounded-full bg-amber-500/12 text-amber-600 dark:text-amber-400">
                  <AlertIcon className="size-7" />
                </div>
                <span className="rounded-full bg-amber-500/12 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 uppercase dark:text-amber-300">
                  Location Permission Required
                </span>
                <h2 className="mt-2 text-lg font-bold text-(--ln-fg-primary)">
                  Please Enable Location Access
                </h2>
                <p className="mt-1.5 text-xs text-(--ln-fg-muted)">
                  {gpsError ||
                    "To register through the General Attendance QR, your phone must allow browser location access to confirm physical presence at church."}
                </p>

                <div className="mt-4 w-full rounded-2xl border border-(--ln-border) bg-(--ln-surface-warm)/60 p-4 text-start text-xs space-y-2">
                  <p className="font-semibold text-(--ln-fg-primary)">
                    If GPS continues to fail:
                  </p>
                  <p className="text-(--ln-fg-muted)">
                    Please approach any <strong>Protocol member</strong> at
                    either auditorium entrance. They will check you in
                    immediately using the Protocol desk method.
                  </p>
                </div>

                <div className="mt-5 flex w-full flex-col gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      setViewState("form");
                      void requestLocation();
                    }}
                  >
                    Retry Location Permission
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setViewState("form")}
                  >
                    Back to Form
                  </Button>
                </div>
              </ScaleIn>
            )}

            {/* STATE: OUTSIDE GEOFENCE */}
            {viewState === "outside-geofence" && (
              <ScaleIn className="flex flex-col items-center py-4 text-center">
                <div className="mb-3.5 flex size-14 items-center justify-center rounded-full bg-red-500/12 text-red-600 dark:text-red-400">
                  <OctagonAlertIcon className="size-7" />
                </div>
                <span className="rounded-full bg-red-500/12 px-2.5 py-0.5 text-[11px] font-semibold text-red-700 uppercase dark:text-red-300">
                  Location Verification Failed
                </span>
                <h2 className="mt-2 text-lg font-bold text-(--ln-fg-primary)">
                  You Appear Outside the Church Geofence
                </h2>
                <p className="mt-1.5 text-xs text-(--ln-fg-muted)">
                  The General Attendance QR is only for worshippers physically
                  present inside the church auditorium.
                </p>

                <div className="mt-4 w-full rounded-2xl border border-brand-500/25 bg-brand-500/10 p-4 text-start text-xs">
                  <p className="font-semibold text-(--ln-fg-primary)">
                    Are you physically present at church?
                  </p>
                  <p className="mt-1 text-(--ln-fg-muted)">
                    If your GPS is inaccurate or you are inside the building,
                    please approach any <strong>Protocol member</strong> at
                    either entrance. They are equipped to register you
                    immediately without GPS.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  className="mt-5 w-full"
                >
                  Retry Verification
                </Button>
              </ScaleIn>
            )}

            {/* STATE: POOR ACCURACY */}
            {viewState === "poor-accuracy" && (
              <ScaleIn className="flex flex-col items-center py-4 text-center">
                <div className="mb-3.5 flex size-14 items-center justify-center rounded-full bg-amber-500/12 text-amber-600 dark:text-amber-400">
                  <AlertIcon className="size-7" />
                </div>
                <span className="rounded-full bg-amber-500/12 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 uppercase dark:text-amber-300">
                  Weak GPS Signal
                </span>
                <h2 className="mt-2 text-lg font-bold text-(--ln-fg-primary)">
                  GPS Accuracy Is Poor
                </h2>
                <p className="mt-1.5 text-xs text-(--ln-fg-muted)">
                  Your device reported weak GPS accuracy. Please step closer to
                  a window or entrance and tap retry.
                </p>

                <div className="mt-4 w-full rounded-xl border border-(--ln-border) bg-(--ln-surface-warm)/50 p-3 text-start text-xs">
                  <p className="text-(--ln-fg-muted)">
                    Alternatively, please approach a{" "}
                    <strong className="text-(--ln-fg-primary)">
                      Protocol member
                    </strong>{" "}
                    at the entrance to be checked in without GPS.
                  </p>
                </div>

                <div className="mt-5 flex w-full flex-col gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      setUserLocation(null);
                      setViewState("form");
                    }}
                  >
                    Retry GPS Location
                  </Button>
                </div>
              </ScaleIn>
            )}

            {/* STATE: LOADING */}
            {viewState === "loading" && (
              <ScaleIn className="flex flex-col items-center py-9 text-center">
                <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-(--ln-surface-warm) text-brand-500 dark:text-brand-400">
                  <Spinner className="size-7" />
                </div>
                <h2 className="text-base font-bold text-(--ln-fg-primary)">
                  Verifying attendance pass...
                </h2>
                <p className="mt-1 max-w-xs text-xs text-(--ln-fg-muted)">
                  Connecting to Light Nation Ibadan attendance services.
                </p>
              </ScaleIn>
            )}

            {/* STATE: SUCCESSFUL SUBMISSION */}
            {viewState === "success" && (
              <ScaleIn className="flex flex-col items-center py-3 text-center">
                <div className="relative mb-3.5 flex size-14 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 ring-8 ring-emerald-500/8 dark:text-emerald-400">
                  <CheckCircleIcon className="size-8" />
                </div>

                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${
                    submittedRecord?.verificationMethod === "protocol_verified" ||
                    sessionData?.gps?.required === false
                      ? "border border-brand-500/25 bg-brand-500/10 text-brand-700 dark:text-brand-300"
                      : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {submittedRecord?.verificationMethod === "protocol_verified" ||
                  sessionData?.gps?.required === false
                    ? "Protocol Verified"
                    : "GPS Verified"}
                </span>

                <h2 className="mt-2 text-lg font-bold text-(--ln-fg-primary) sm:text-xl">
                  Attendance recorded successfully
                </h2>
                <p className="mt-1 text-xs text-(--ln-fg-muted)">
                  Thank you for checking in. Enjoy the service!
                </p>

                <div className="mt-4 w-full space-y-2 rounded-xl border border-(--ln-border) bg-(--ln-surface-warm)/50 p-3.5 text-start text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-(--ln-fg-muted)">Full Name</span>
                    <span className="font-semibold text-(--ln-fg-primary)">
                      {submittedRecord?.fullName || fullName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-(--ln-fg-muted)">Department</span>
                    <span className="font-medium text-brand-600 dark:text-brand-400">
                      {submittedRecord?.departmentName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-(--ln-fg-muted)">Service</span>
                    <span className="truncate font-medium text-(--ln-fg-primary)">
                      {sessionData?.session?.title}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-(--ln-border) pt-2">
                    <span className="text-(--ln-fg-muted)">Method</span>
                    <span
                      className={`tabular font-semibold ${
                        submittedRecord?.verificationMethod === "protocol_verified" ||
                        sessionData?.gps?.required === false
                          ? "text-brand-700 dark:text-brand-400"
                          : "text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      {submittedRecord?.verificationMethod === "protocol_verified" ||
                      sessionData?.gps?.required === false
                        ? "Protocol Verified (Entrance Desk)"
                        : "GPS Verified"}
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-(--ln-fg-muted)">
                  <CheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Check-in complete. You may safely close this window.</span>
                </div>
              </ScaleIn>
            )}

            {/* STATE: DUPLICATE REGISTRATION */}
            {viewState === "duplicate" && (
              <ScaleIn className="flex flex-col items-center py-4 text-center">
                <div className="mb-3.5 flex size-14 items-center justify-center rounded-full bg-amber-500/12 text-amber-600 ring-8 ring-amber-500/8 dark:text-amber-400">
                  <AlertIcon className="size-7" />
                </div>

                <span className="rounded-full bg-amber-500/12 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-300">
                  Already Registered
                </span>

                <h2 className="mt-2 text-lg font-bold text-(--ln-fg-primary) sm:text-xl">
                  Attendance Already Recorded
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-(--ln-fg-muted)">
                  An attendance record for{" "}
                  <strong className="text-(--ln-fg-primary)">
                    {submittedRecord?.fullName ?? fullName}
                  </strong>{" "}
                  already exists for{" "}
                  <span className="font-medium text-(--ln-fg-primary)">
                    {sessionData?.session?.title ?? "this session"}
                  </span>
                  . You do not need to register again.
                </p>

                <div className="mt-4 text-center text-xs text-(--ln-fg-muted)">
                  <span>Your check-in has already been recorded. You may close this window.</span>
                </div>
              </ScaleIn>
            )}

            {/* STATE: REGISTRATION NOT YET OPEN */}
            {viewState === "not-open" && (
              <ScaleIn className="flex flex-col items-center py-4 text-center">
                <div className="mb-3.5 flex size-14 items-center justify-center rounded-full bg-amber-500/12 text-amber-600 dark:text-amber-300">
                  <ClockIcon className="size-7" />
                </div>

                <span className="rounded-full bg-amber-500/12 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-300">
                  Upcoming Service
                </span>

                <h2 className="mt-2 text-lg font-bold text-(--ln-fg-primary) sm:text-xl">
                  Registration Is Not Yet Open
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-(--ln-fg-muted)">
                  Attendance registration opens at{" "}
                  <strong className="tabular text-brand-600 dark:text-brand-400">
                    {formatTime12h(sessionData?.session?.startTime ?? "06:00")}
                  </strong>{" "}
                  on{" "}
                  {formatDisplayDate(
                    sessionData?.session?.date ??
                      new Date().toISOString().slice(0, 10),
                  )}
                  . Both General Attendance and Protocol registration open at
                  this time.
                </p>
              </ScaleIn>
            )}

            {/* STATE: REGISTRATION CLOSED */}
            {viewState === "closed" && (
              <ScaleIn className="flex flex-col items-center py-4 text-center">
                <div className="mb-3.5 flex size-14 items-center justify-center rounded-full bg-(--ln-surface-warm) text-(--ln-fg-muted)">
                  <LockIcon className="size-7" />
                </div>

                <span className="rounded-full bg-(--ln-surface-warm) px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-(--ln-fg-secondary) uppercase">
                  Registration Ended
                </span>

                <h2 className="mt-2 text-lg font-bold text-(--ln-fg-primary) sm:text-xl">
                  Registration Has Closed
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-(--ln-fg-muted)">
                  Attendance registration for{" "}
                  <strong className="text-(--ln-fg-primary)">
                    {sessionData?.session?.title ?? "this service"}
                  </strong>{" "}
                  closed at{" "}
                  <strong className="tabular text-(--ln-fg-primary)">
                    {formatTime12h(sessionData?.session?.endTime ?? "07:10")}
                  </strong>
                  . Neither General QR nor Protocol registration can accept
                  entries after closing time.
                </p>
              </ScaleIn>
            )}

            {/* STATE: INVALID QR CODE */}
            {viewState === "invalid-qr" && (
              <ScaleIn className="flex flex-col items-center py-5 text-center">
                <div className="mb-3.5 flex size-14 items-center justify-center rounded-full bg-red-500/12 text-red-600 dark:text-red-400">
                  <OctagonAlertIcon className="size-7" />
                </div>

                <span className="rounded-full bg-red-500/12 px-2.5 py-0.5 text-[11px] font-semibold text-red-700 uppercase dark:text-red-300">
                  Link Expired or Revoked
                </span>

                <h2 className="mt-2 text-lg font-bold text-(--ln-fg-primary) sm:text-xl">
                  Attendance Link No Longer Valid
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-(--ln-fg-muted)">
                  This QR code or link is no longer valid, has been revoked, or
                  does not match an active service. Please scan the current QR
                  code displayed on the church screen or speak with a protocol
                  member.
                </p>
              </ScaleIn>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center gap-1 pt-2 pb-1 text-center">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-(--ln-fg-muted) uppercase">
          <Image
            src="/images/brand/light-nation-mark.png"
            alt=""
            width={14}
            height={14}
            className="size-3.5 object-contain"
          />
          <span>Light Nation Ibadan</span>
        </div>
        <p className="text-[11px] italic text-(--ln-fg-muted)">
          &ldquo;The shout of a king is among us.&rdquo;
        </p>
      </footer>
    </div>
  );
}
