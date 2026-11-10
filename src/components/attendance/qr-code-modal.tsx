"use client";

import QrCodeDisplay from "@/components/shared/qr-code-display";
import { SessionStatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAttendance } from "@/context/attendance-context";
import { Link } from "@/i18n/navigation";
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  DownloadIcon,
  LinkIcon,
  LockIcon,
  RegenerateIcon,
  UsersIcon,
} from "@/icons";
import type { AttendanceSession } from "@/types/attendance";
import {
  downloadBothQrCodes,
  downloadQrCodePng,
  downloadQrCodeSvg,
  formatDisplayDate,
  formatTime12h,
  getProtocolRegistrationUrl,
  getPublicRegistrationUrl,
} from "@/utils";
import { useState } from "react";

interface QrCodeModalProps {
  session: AttendanceSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function QrCodeModal({
  session,
  open,
  onOpenChange,
}: QrCodeModalProps) {
  const { settings, rotateToken, refreshData } = useAttendance();

  const [activeTab, setActiveTab] = useState<"general" | "protocol">("general");
  const [copiedLink, setCopiedLink] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [rotationNotice, setRotationNotice] = useState<string | null>(null);

    if (!session) return null;

  const closeTime = activeTab === "protocol" ? (session.protocolClosingTime ?? session.closingTime) : session.closingTime;





  const generalUrl = getPublicRegistrationUrl(
    session.token,
    settings.publicBaseUrl,
  );
  const protocolUrl = session.protocolToken
    ? getProtocolRegistrationUrl(session.protocolToken, settings.publicBaseUrl)
    : "";

  const activeUrl = activeTab === "general" ? generalUrl : protocolUrl;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(activeUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    } catch {}
  };

  const handleDownloadPng = async () => {
    if (activeTab === "general") {
      await downloadQrCodePng(
        generalUrl,
        session.eventName,
        `${formatDisplayDate(session.eventDate)} (${formatTime12h(session.openingTime)} - ${formatTime12h(closeTime)})`,
        `light-nation-${session.eventName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-general-gps`,
        "GENERAL ATTENDANCE · GPS REQUIRED",
      );
    } else {
      await downloadQrCodePng(
        protocolUrl,
        session.eventName,
        `${formatDisplayDate(session.eventDate)} (${formatTime12h(session.openingTime)} - ${formatTime12h(closeTime)})`,
        `light-nation-${session.eventName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-protocol-entrance`,
        "PROTOCOL DESK · GPS NOT REQUIRED",
      );
    }
  };

  const handleDownloadSvg = () => {
    if (activeTab === "general") {
      downloadQrCodeSvg(
        generalUrl,
        session.eventName,
        `${formatDisplayDate(session.eventDate)} (${formatTime12h(session.openingTime)} - ${formatTime12h(closeTime)})`,
        `light-nation-${session.eventName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-general-gps`,
        "GENERAL ATTENDANCE · GPS REQUIRED",
      );
    } else {
      downloadQrCodeSvg(
        protocolUrl,
        session.eventName,
        `${formatDisplayDate(session.eventDate)} (${formatTime12h(session.openingTime)} - ${formatTime12h(closeTime)})`,
        `light-nation-${session.eventName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-protocol-entrance`,
        "PROTOCOL DESK · GPS NOT REQUIRED",
      );
    }
  };

  const handleDownloadBoth = async () => {
    await downloadBothQrCodes(
      generalUrl,
      protocolUrl,
      session.eventName,
      `${formatDisplayDate(session.eventDate)} (${formatTime12h(session.openingTime)} - ${formatTime12h(closeTime)})`,
      `light-nation-${session.eventName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      "png",
    );
  };

  const handleRotateCurrentToken = async () => {
    if (isRotating) return;
    const confirmed = window.confirm(
      `Revoke and regenerate the ${
        activeTab === "general" ? "General Attendance" : "Protocol Desk"
      } QR code? The previous token will immediately stop working. Existing attendance records will remain safe.`,
    );
    if (!confirmed) return;

    setIsRotating(true);
    setRotationNotice(null);
    try {
      await rotateToken(
        session.id,
        activeTab,
        true,
        "Administrator requested token regeneration",
      );
      await refreshData();
      setRotationNotice("Token successfully regenerated. Previous QR code invalidated.");
      setTimeout(() => setRotationNotice(null), 3500);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to regenerate token.");
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-xl max-h-[90dvh] overflow-y-auto overflow-x-hidden custom-scrollbar p-4 sm:p-6">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 pe-6">
            <DialogTitle className="text-base sm:text-lg">
              Session Attendance QR Passes
            </DialogTitle>
            <SessionStatusBadge status={session.status} />
          </div>
          <DialogDescription>
            Each session has two distinct QR access methods linked to the same
            attendance records and opening/closing times.
          </DialogDescription>
        </DialogHeader>

        {rotationNotice && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            <CheckIcon className="size-4 shrink-0 text-emerald-600" />
            <span>{rotationNotice}</span>
          </div>
        )}

        {/* Dual QR Method Switcher Tabs (Responsive Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 rounded-xl border border-(--ln-border) bg-(--ln-surface-warm) p-1 w-full">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`rounded-lg px-3 py-2 text-center text-xs font-semibold transition-all ${
              activeTab === "general"
                ? "bg-(--ln-surface) text-brand-600 shadow-theme-xs dark:text-brand-400 font-bold"
                : "text-(--ln-fg-muted) hover:text-(--ln-fg-primary)"
            }`}
          >
            1. General QR (GPS Required)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("protocol")}
            className={`rounded-lg px-3 py-2 text-center text-xs font-semibold transition-all ${
              activeTab === "protocol"
                ? "bg-(--ln-surface) text-brand-600 shadow-theme-xs dark:text-brand-400 font-bold"
                : "text-(--ln-fg-muted) hover:text-(--ln-fg-primary)"
            }`}
          >
            2. Protocol QR (Entrance Desk)
          </button>
        </div>

        {/* Method Information Pill */}
        <div className="rounded-xl border border-(--ln-border) bg-(--ln-surface-warm)/50 p-3 text-xs">
          {activeTab === "general" ? (
            <div className="flex items-start gap-2.5 text-(--ln-fg-muted)">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-[11px] font-bold text-brand-600">
                1
              </span>
              <div>
                <strong className="text-(--ln-fg-primary)">
                  General Attendance QR
                </strong>{" "}
                — Display on auditorium screens or share in WhatsApp groups.
                Attendee device GPS is validated server-side within the church
                geofence (
                <strong>
                  {session.geofenceRadiusM || settings.geofenceRadiusM || 100}m
                </strong>{" "}
                radius).
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 text-(--ln-fg-muted)">
              <LockIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <strong className="text-(--ln-fg-primary)">
                  Protocol QR (Entrance Access)
                </strong>{" "}
                — For church entrances. Download as PNG or SVG and send to the
                Protocol HOD, who distributes it to protocol members assigned to
                the entrances. Anyone scanning it can register without GPS
                verification. Shares the exact same session, form, duplicate
                checks, and closing time.
              </div>
            </div>
          )}
        </div>

        {/* QR Code Graphic Box */}
        <div className="flex flex-col items-center rounded-2xl border border-(--ln-border) bg-(--ln-surface-warm)/30 p-4 sm:p-5 text-center">
          <QrCodeDisplay value={activeUrl} size={190} />

          <h4 className="mt-3 text-base font-semibold text-(--ln-fg-primary)">
            {session.eventName}
          </h4>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-(--ln-fg-muted)">
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="size-3.5 text-brand-600 dark:text-brand-400" />
              {formatDisplayDate(session.eventDate)}
            </span>
            <span className="tabular inline-flex items-center gap-1.5">
              <ClockIcon className="size-3.5 text-brand-600 dark:text-brand-400" />
              {formatTime12h(session.openingTime)} –{" "}
              {formatTime12h(closeTime)}
            </span>
            <span className="tabular inline-flex items-center gap-1.5 font-medium text-(--ln-fg-primary)">
              <UsersIcon className="size-3.5 text-brand-600 dark:text-brand-400" />
              {session.registrationCount} Registered
            </span>
          </div>

          <div className="mt-2.5">
            <Badge
              variant="light"
              color={activeTab === "general" ? "primary" : "warning"}
              size="sm"
            >
              {activeTab === "general"
                ? "GPS Verification Required"
                : "Protocol Verified · No GPS"}
            </Badge>
          </div>
        </div>

        {/* Link Box */}
        <div className="space-y-1.5 min-w-0">
          <span className="block text-xs font-medium text-(--ln-fg-muted)">
            {activeTab === "general"
              ? "General Attendance URL (WhatsApp & Screens)"
              : "Protocol Access URL (No GPS Required)"}
          </span>
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-(--ln-border) bg-(--ln-surface-warm)/60 px-3 py-2">
            <LinkIcon className="size-4 shrink-0 text-(--ln-fg-muted)" />
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-(--ln-fg-secondary)">
              {activeUrl}
            </code>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleCopyLink}
              className="shrink-0"
            >
              {copiedLink ? (
                <>
                  <CheckIcon className="size-3.5 text-emerald-600" />
                  Copied
                </>
              ) : (
                <>
                  <CopyIcon className="size-3.5" />
                  Copy Link
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Download & Management Actions */}
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleDownloadPng}
                className="flex-1 sm:flex-initial justify-center"
              >
                <DownloadIcon className="size-3.5" />
                Download PNG
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleDownloadSvg}
                className="flex-1 sm:flex-initial justify-center"
              >
                <DownloadIcon className="size-3.5" />
                Download SVG
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleDownloadBoth}
                className="w-full sm:w-auto justify-center"
              >
                <DownloadIcon className="size-3.5" />
                Download Both QRs
              </Button>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="xs"
              loading={isRotating}
              onClick={handleRotateCurrentToken}
              className="w-full sm:w-auto justify-center text-(--ln-fg-muted) hover:text-red-600"
              title="Revoke and regenerate compromised QR token"
            >
              <RegenerateIcon className="size-3.5" />
              Revoke &amp; Regenerate
            </Button>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-(--ln-border)">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
            <Button
              type="button"
              nativeButton={false}
              className="w-full sm:w-auto text-center justify-center"
              render={
                <Link
                  href={`/attend/${
                    activeTab === "general"
                      ? session.token
                      : session.protocolToken || ""
                  }`}
                  target="_blank"
                />
              }
            >
              Open {activeTab === "general" ? "General" : "Protocol"} Check-In Page
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
