"use client";

import FormBuilder from "@/components/attendance/form-builder";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAttendance } from "@/context/attendance-context";
import { AlertIcon, CalendarIcon, MapPinIcon } from "@/icons";
import type { AttendanceSession, FormSchema, SessionStatus, SessionType } from "@/types/attendance";
import TimePicker12h from "@/components/ui/time-picker-12h";
import { formatCoordinateDms } from "@/utils/coordinates";
import { getFormTemplateForSessionType } from "@/utils/form-templates";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const createSessionSchema = z
  .object({
    eventName: z
      .string()
      .min(3, "Event name must be at least 3 characters.")
      .max(100, "Event name must be under 100 characters."),
    sessionType: z.enum([
      "sunday_service",
      "workers_meeting",
      "conference",
      "general_event",
      "custom",
    ]),
    eventDate: z.string().min(1, "Please select an event date."),
    openingTime: z.string().min(1, "Opening time is required."),
    closingTime: z.string().min(1, "Closing time is required."),
    status: z.enum(["open", "scheduled", "closed"]),
    description: z.string().max(300, "Description is too long.").optional(),
    expectedCapacity: z.number().min(1),
    geofenceRadiusM: z.number().min(20).max(5000),
    gpsAccuracyThresholdM: z.number().min(5).max(1000),
  })
  .refine((data) => data.closingTime > data.openingTime, {
    message: "Closing time must be after opening time.",
    path: ["closingTime"],
  });

type CreateSessionFormValues = z.infer<typeof createSessionSchema>;

interface CreateSessionFormProps {
  onSuccess?: (session: AttendanceSession) => void;
  onCancel?: () => void;
  showCancel?: boolean;
}

const TEMPLATE_PRESETS = [
  {
    type: "sunday_service" as SessionType,
    label: "Sunday Service (06:00 AM – 07:10 AM)",
    defaultName: "Sunday Celebration Service",
    openingTime: "06:00",
    closingTime: "07:10",
  },
  {
    type: "workers_meeting" as SessionType,
    label: "Workers' Meeting (08:00 AM – 10:30 AM)",
    defaultName: "Workers & Ministers Alignment Charge",
    openingTime: "08:00",
    closingTime: "10:30",
  },
  {
    type: "conference" as SessionType,
    label: "Conference (09:00 AM – 02:00 PM)",
    defaultName: "Light Nation Annual Believers Conference",
    openingTime: "09:00",
    closingTime: "14:00",
  },
  {
    type: "general_event" as SessionType,
    label: "General Event (05:00 PM – 08:00 PM)",
    defaultName: "Church Special Seminar & Impartation",
    openingTime: "17:00",
    closingTime: "20:00",
  },
  {
    type: "custom" as SessionType,
    label: "Custom Form (10:00 AM – 12:30 PM)",
    defaultName: "Special Fellowship Session",
    openingTime: "10:00",
    closingTime: "12:30",
  },
];

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function CreateSessionForm({
  onSuccess,
  onCancel,
  showCancel = true,
}: CreateSessionFormProps) {
  const { createSession, settings } = useAttendance();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [formSchema, setFormSchema] = useState<FormSchema>(
    getFormTemplateForSessionType("sunday_service"),
  );
  const [activeTab, setActiveTab] = useState<"details" | "form" | "gps">("details");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateSessionFormValues>({
    resolver: zodResolver(createSessionSchema),
    defaultValues: {
      eventName: "Sunday Celebration Service",
      sessionType: "sunday_service",
      eventDate: getTodayDateString(),
      openingTime: "06:00",
      closingTime: "07:10",
      status: "open",
      description: "",
      expectedCapacity: 250,
      geofenceRadiusM: settings.geofenceRadiusM || 100,
      gpsAccuracyThresholdM: settings.gpsAccuracyThresholdM || 250,
    },
  });

  const selectedType = watch("sessionType");

  const applyTemplatePreset = (preset: (typeof TEMPLATE_PRESETS)[number]) => {
    setValue("sessionType", preset.type, { shouldValidate: true });
    setValue("eventName", preset.defaultName, { shouldValidate: true });
    setValue("openingTime", preset.openingTime, { shouldValidate: true });
    setValue("closingTime", preset.closingTime, { shouldValidate: true });
    setFormSchema(getFormTemplateForSessionType(preset.type));
  };

  const onSubmit = async (values: CreateSessionFormValues) => {
    setSubmitError(null);
    try {
      const created = await createSession({
        eventName: values.eventName,
        sessionType: values.sessionType,
        eventDate: values.eventDate,
        openingTime: values.openingTime,
        closingTime: values.closingTime,
        description: values.description,
        status: values.status as SessionStatus,
        expectedCapacity: values.expectedCapacity,
        formSchema,
        geofenceRadiusM: values.geofenceRadiusM,
        gpsAccuracyThresholdM: values.gpsAccuracyThresholdM,
      });

      reset({
        eventName: "Sunday Celebration Service",
        sessionType: "sunday_service",
        eventDate: getTodayDateString(),
        openingTime: "06:00",
        closingTime: "07:10",
        status: "open",
        description: "",
        expectedCapacity: 250,
        geofenceRadiusM: settings.geofenceRadiusM || 100,
        gpsAccuracyThresholdM: settings.gpsAccuracyThresholdM || 250,
      });
      setFormSchema(getFormTemplateForSessionType("sunday_service"));
      onSuccess?.(created);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Failed to create attendance session.",
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {submitError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300"
        >
          <AlertIcon className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Starting Template Selection */}
      <div>
        <span className="mb-2 block text-xs font-semibold text-(--ln-fg-muted) uppercase">
          Select Starting Form Template
        </span>
        <div className="flex flex-wrap gap-2">
          {TEMPLATE_PRESETS.map((preset) => {
            const isSelected = selectedType === preset.type;
            return (
              <button
                key={preset.type}
                type="button"
                onClick={() => applyTemplatePreset(preset)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
                  isSelected
                    ? "border-brand-500 bg-brand-500/10 font-semibold text-brand-600 dark:text-brand-400"
                    : "border-(--ln-border) bg-(--ln-surface-warm)/60 text-(--ln-fg-secondary) hover:border-(--ln-border-strong)"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Tabs */}
      <div className="ln-segmented">
        <button
          type="button"
          onClick={() => setActiveTab("details")}
          className={`ln-segment-item ${
            activeTab === "details"
              ? "ln-segment-item-active"
              : "ln-segment-item-inactive"
          }`}
        >
          1. Service &amp; Schedule
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("form")}
          className={`ln-segment-item ${
            activeTab === "form"
              ? "ln-segment-item-active"
              : "ln-segment-item-inactive"
          }`}
        >
          2. Form Questions ({formSchema.fields.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("gps")}
          className={`ln-segment-item ${
            activeTab === "gps"
              ? "ln-segment-item-active"
              : "ln-segment-item-inactive"
          }`}
        >
          3. GPS Geofence
        </button>
      </div>

      {/* TAB 1: DETAILS & SCHEDULE */}
      {activeTab === "details" && (
        <div className="space-y-4">
          <Field invalid={Boolean(errors.eventName)}>
            <FieldLabel>
              Event / Service Name <span className="text-brand-600">*</span>
            </FieldLabel>
            <Input
              placeholder="e.g. Sunday Celebration Service"
              {...register("eventName")}
            />
            {errors.eventName && (
              <FieldError>{errors.eventName.message}</FieldError>
            )}
          </Field>

          {/* Date & Status */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field invalid={Boolean(errors.eventDate)}>
              <FieldLabel>
                Event Date <span className="text-brand-600">*</span>
              </FieldLabel>
              <div className="relative">
                <Input
                  type="date"
                  className="pe-10"
                  {...register("eventDate")}
                />
                <CalendarIcon className="pointer-events-none absolute inset-e-3.5 top-1/2 size-4.5 -translate-y-1/2 text-gray-400" />
              </div>
              {errors.eventDate && (
                <FieldError>{errors.eventDate.message}</FieldError>
              )}
            </Field>

            <Field invalid={Boolean(errors.status)}>
              <FieldLabel>Initial Session Status</FieldLabel>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val) => field.onChange(val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">
                        Open Immediately (Live Window)
                      </SelectItem>
                      <SelectItem value="scheduled">
                        Scheduled (Not Yet Open)
                      </SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          {/* Opening & Closing Times */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field invalid={Boolean(errors.openingTime)}>
                <FieldLabel>
                  Opening Time <span className="text-brand-600">*</span>
                </FieldLabel>
                <Controller
                  control={control}
                  name="openingTime"
                  render={({ field }) => (
                    <TimePicker12h
                      id="openingTime"
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                {errors.openingTime && (
                  <FieldError>{errors.openingTime.message}</FieldError>
                )}
              </Field>

              <Field invalid={Boolean(errors.closingTime)}>
                <FieldLabel>
                  Closing Time <span className="text-brand-600">*</span>
                </FieldLabel>
                <Controller
                  control={control}
                  name="closingTime"
                  render={({ field }) => (
                    <TimePicker12h
                      id="closingTime"
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                {errors.closingTime && (
                  <FieldError>{errors.closingTime.message}</FieldError>
                )}
              </Field>
            </div>
            <p className="text-[11px] text-(--ln-fg-muted)">
              Both General QR (GPS) and Protocol QR strictly open and close at these exact times.
            </p>
          </div>

          {/* Description */}
          <Field invalid={Boolean(errors.description)}>
            <FieldLabel>
              Description / Notes{" "}
              <span className="font-normal text-(--ln-fg-muted)">
                (Optional)
              </span>
            </FieldLabel>
            <Textarea
              rows={2}
              placeholder="Notes for ushers, protocol team, or attendees..."
              {...register("description")}
            />
          </Field>
        </div>
      )}

      {/* TAB 2: DYNAMIC FORM BUILDER */}
      {activeTab === "form" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-(--ln-fg-muted)">
              Configure session-specific questions. Attendees will see this form
              on both General QR and Protocol devices.
            </span>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setIsPreviewOpen(true)}
            >
              Preview Form
            </Button>
          </div>

          <FormBuilder
            value={formSchema}
            onChange={(newSchema) => setFormSchema(newSchema)}
          />
        </div>
      )}

      {/* TAB 3: GPS GEOFENCE CONFIGURATION */}
      {activeTab === "gps" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-(--ln-border) bg-(--ln-surface-warm)/40 p-4">
            <h3 className="text-sm font-semibold text-(--ln-fg-primary)">
              Session GPS Geofence
            </h3>
            <p className="mt-1 text-xs text-(--ln-fg-muted)">
              The General Attendance QR verifies attendee location server-side.
              Attendees outside this radius are blocked and directed to a
              protocol member at the entrance.
            </p>

            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-(--ln-border) bg-(--ln-surface) p-3">
              <MapPinIcon className="size-4 shrink-0 text-brand-500 mt-0.5" />
              <div className="text-xs">
                <span className="font-semibold text-(--ln-fg-primary)">
                  Church Auditorium Geofence Target:
                </span>
                <p className="mt-0.5 font-mono text-[11px] text-(--ln-fg-secondary)">
                  {formatCoordinateDms(settings.geofenceLatitude ?? 7.3775, true)},{" "}
                  {formatCoordinateDms(settings.geofenceLongitude ?? 3.947, false)}{" "}
                  <span className="text-(--ln-fg-muted)">
                    ({settings.geofenceLatitude ?? 7.3775}, {settings.geofenceLongitude ?? 3.947})
                  </span>
                </p>
                <p className="mt-1 text-[10px] text-(--ln-fg-muted)">
                  Attendees scanning the General QR must be within the permitted radius of these coordinates. (Configured in Church Settings).
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field invalid={Boolean(errors.geofenceRadiusM)}>
                <FieldLabel>Permitted Radius (Metres)</FieldLabel>
                <Input
                  type="number"
                  min={20}
                  max={5000}
                  {...register("geofenceRadiusM")}
                />
                <span className="text-[11px] text-(--ln-fg-muted)">
                  Default: 100 metres around church auditorium.
                </span>
              </Field>

              <Field invalid={Boolean(errors.gpsAccuracyThresholdM)}>
                <FieldLabel>GPS Accuracy Threshold (Metres)</FieldLabel>
                <Input
                  type="number"
                  min={5}
                  max={1000}
                  {...register("gpsAccuracyThresholdM")}
                />
                <span className="text-[11px] text-(--ln-fg-muted)">
                  Maximum acceptable GPS error (Default: 250 metres for indoor church auditoriums).
                </span>
              </Field>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col-reverse items-center justify-between gap-3 border-t border-(--ln-border) pt-4 sm:flex-row">
        <div className="text-xs text-(--ln-fg-muted)">
          Generates both <strong>General Attendance QR (GPS)</strong> and{" "}
          <strong>Protocol QR</strong>.
        </div>

        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
          {showCancel && onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            loading={isSubmitting}
            loadingText="Generating Dual QR Session..."
            className="flex-1 sm:flex-none"
          >
            Create Session
          </Button>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-md max-h-[85dvh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle>Registration Form Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-(--ln-fg-muted)">
              This is how your configured form will appear to attendees:
            </p>
            <div className="space-y-3 rounded-2xl border border-(--ln-border) bg-(--ln-surface-warm)/30 p-4">
              {formSchema.fields.map((f) => (
                <div key={f.id} className="space-y-1">
                  <label className="text-xs font-semibold text-(--ln-fg-primary)">
                    {f.label} {f.required && <span className="text-brand-500">*</span>}
                  </label>
                  {f.type === "select" || f.type === "department" ? (
                    <div className="rounded-lg border border-(--ln-border) bg-(--ln-surface) p-2 text-xs text-(--ln-fg-muted)">
                      Dropdown select...
                    </div>
                  ) : f.type === "radio" || f.type === "checkbox" ? (
                    <div className="space-y-1 text-xs text-(--ln-fg-secondary)">
                      {(f.options || []).map((o, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="size-3 rounded border border-(--ln-border)" />
                          <span>{o}</span>
                        </div>
                      ))}
                    </div>
                  ) : f.type === "yes_no" ? (
                    <div className="flex gap-4 text-xs text-(--ln-fg-secondary)">
                      <span className="flex items-center gap-1.5">
                        <span className="size-3 rounded-full border border-(--ln-border)" />
                        Yes
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="size-3 rounded-full border border-(--ln-border)" />
                        No
                      </span>
                    </div>
                  ) : (
                    <Input
                      disabled
                      placeholder={f.helpText || `Enter ${f.label.toLowerCase()}...`}
                      className="h-8.5 text-xs"
                    />
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPreviewOpen(false)}
              className="w-full"
            >
              Close Preview
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}
