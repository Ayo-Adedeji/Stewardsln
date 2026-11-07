"use client";

import BrandLogo from "@/components/shared/brand-logo";
import { FadeIn } from "@/components/shared/motion";
import PageHeader from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAttendance } from "@/context/attendance-context";
import { type ThemeMode, useTheme } from "@/context/theme-context";
import {
  AlertIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  CheckIcon,
  ContrastIcon,
  CopyIcon,
  DatabaseIcon,
  FloppyDiscIcon,
  LockIcon,
  MapPinIcon,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SparkIcon,
  SunIcon,
  TrashBinIcon,
} from "@/icons";
import {
  formatCoordinateDms,
  parseCoordinatePair,
  parseCoordinateSingle,
} from "@/utils";
import type { AdminProfile, InviteAdminRole } from "@/types/attendance";
import { useEffect, useMemo, useState } from "react";

const APPEARANCE_CARDS: {
  id: ThemeMode;
  title: string;
  subtitle: string;
  previewBg: string;
  previewCard: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}[] = [
  {
    id: "light",
    title: "Light Mode",
    subtitle: "Crisp white surfaces on warm alabaster canvas",
    previewBg: "bg-[#F7F7F5] border-[#E7E5E4]",
    previewCard: "bg-white border-[#E7E5E4]",
    Icon: SunIcon,
  },
  {
    id: "neutral",
    title: "Neutral Mode",
    subtitle: "Warm stone & soft alabaster with restrained contrast",
    previewBg: "bg-[#EFECE6] border-[#DDD7CC]",
    previewCard: "bg-[#FAF8F5] border-[#DDD7CC]",
    Icon: ContrastIcon,
  },
  {
    id: "dark",
    title: "Dark Mode",
    subtitle: "Deep charcoal surfaces with accessible light contrast",
    previewBg: "bg-[#111111] border-[#2E2E2E]",
    previewCard: "bg-[#1A1A1A] border-[#2E2E2E]",
    Icon: MoonIcon,
  },
];

function formatTimestamp(isoString: string, timezone = "Africa/Lagos"): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: timezone,
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export default function SettingsView() {
  const {
    settings,
    adminProfile,
    teamMembers,
    invitations,
    ownershipTransferLogs,
    updateSettings,
    inviteAdmin,
    revokeInvitation,
    transferSuperAdminOwnership,
    manageTeamMember,
  } = useAttendance();
  const { themeMode, setThemeMode } = useTheme();

  const [churchName, setChurchName] = useState(settings.churchName);
  const [branchName, setBranchName] = useState(settings.branchName);
  const [tagline, setTagline] = useState(settings.tagline);
  const [address, setAddress] = useState(settings.address);
  const [publicBaseUrl, setPublicBaseUrl] = useState(
    settings.publicBaseUrl || "http://localhost:3000",
  );
  const [geofenceLat, setGeofenceLat] = useState<string>(
    settings.geofenceLatitude !== null ? String(settings.geofenceLatitude) : "7.3775",
  );
  const [geofenceLng, setGeofenceLng] = useState<string>(
    settings.geofenceLongitude !== null ? String(settings.geofenceLongitude) : "3.9470",
  );
  const [geofenceRadius, setGeofenceRadius] = useState<number>(
    settings.geofenceRadiusM || 100,
  );
  const [gpsAccuracy, setGpsAccuracy] = useState<number>(
    settings.gpsAccuracyThresholdM || 250,
  );

  // Smart Coordinate Converter & GPS State
  const [quickPasteInput, setQuickPasteInput] = useState("");
  const [quickPasteStatus, setQuickPasteStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [gpsDetectMessage, setGpsDetectMessage] = useState<string | null>(null);

  const currentLatDms = useMemo(() => {
    const parsed = parseCoordinateSingle(geofenceLat);
    return parsed !== null ? formatCoordinateDms(parsed, true) : null;
  }, [geofenceLat]);

  const currentLngDms = useMemo(() => {
    const parsed = parseCoordinateSingle(geofenceLng);
    return parsed !== null ? formatCoordinateDms(parsed, false) : null;
  }, [geofenceLng]);

  const handleQuickPaste = (val: string) => {
    setQuickPasteInput(val);
    if (!val.trim()) {
      setQuickPasteStatus(null);
      return;
    }
    const parsed = parseCoordinatePair(val);
    if (parsed) {
      setGeofenceLat(String(parsed.lat));
      setGeofenceLng(String(parsed.lng));
      setQuickPasteStatus({
        type: "success",
        message: `Recognized & converted: ${parsed.formattedLatDms}, ${parsed.formattedLngDms} (${parsed.lat}, ${parsed.lng})`,
      });
    } else {
      setQuickPasteStatus({
        type: "error",
        message: "Format not recognized. Try pasting: 7°22'38\"N 3°56'49\"E, or 7.3775, 3.9470",
      });
    }
  };

  const handleDetectCurrentLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGpsDetectMessage("Geolocation is not supported by your browser.");
      return;
    }
    setIsDetectingGps(true);
    setGpsDetectMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetectingGps(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setGeofenceLat(String(lat));
        setGeofenceLng(String(lng));
        const latDms = formatCoordinateDms(lat, true);
        const lngDms = formatCoordinateDms(lng, false);
        setGpsDetectMessage(
          `Detected location: ${latDms}, ${lngDms} (±${Math.round(pos.coords.accuracy)}m accuracy)`,
        );
      },
      (err) => {
        setIsDetectingGps(false);
        let msg = "Unable to acquire location.";
        if (err.code === 1) msg = "Location permission denied in browser.";
        else if (err.code === 2) msg = "GPS position unavailable.";
        else if (err.code === 3) msg = "Location request timed out.";
        setGpsDetectMessage(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  };

  // Address-to-GPS Geocoding State
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeFeedback, setGeocodeFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleGeocodeAddress = async (searchAddr?: string) => {
    const query = (searchAddr ?? address).trim();
    if (!query) {
      setGeocodeFeedback({
        type: "error",
        message: "Please enter an address first.",
      });
      return;
    }

    setIsGeocoding(true);
    setGeocodeFeedback(null);

    try {
      // 1. Query internal API route
      let foundLat: number | null = null;
      let foundLng: number | null = null;
      let foundName = "";

      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.latitude && data.longitude) {
          foundLat = data.latitude;
          foundLng = data.longitude;
          foundName = data.displayName || query;
        }
      }

      // 2. Fallback to direct client fetch if server fetch wasn't reachable
      if (foundLat === null || foundLng === null) {
        const fallbackQuery = /nigeria/i.test(query)
          ? query
          : `${query}, Ibadan, Nigeria`;
        const directRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            fallbackQuery,
          )}&limit=1`,
        );
        if (directRes.ok) {
          const directData = await directRes.json();
          if (Array.isArray(directData) && directData.length > 0) {
            foundLat = Number(parseFloat(directData[0].lat).toFixed(6));
            foundLng = Number(parseFloat(directData[0].lon).toFixed(6));
            foundName = directData[0].display_name || fallbackQuery;
          }
        }
      }

      if (foundLat !== null && foundLng !== null) {
        setGeofenceLat(String(foundLat));
        setGeofenceLng(String(foundLng));
        const latDms = formatCoordinateDms(foundLat, true);
        const lngDms = formatCoordinateDms(foundLng, false);
        setGeocodeFeedback({
          type: "success",
          message: `Coordinates set to ${latDms}, ${lngDms} (${foundLat}, ${foundLng}) for "${foundName.slice(0, 70)}..."`,
        });
      } else {
        setGeocodeFeedback({
          type: "error",
          message:
            "Could not locate this address. Please include city/area (e.g., 'Ring Road, Ibadan, Nigeria') or paste coordinates from Google Maps.",
        });
      }
    } catch {
      setGeocodeFeedback({
        type: "error",
        message: "Address lookup failed. Check network connection or enter coordinates directly.",
      });
    } finally {
      setIsGeocoding(false);
    }
  };

  const [adminName, setAdminName] = useState(settings.adminName);
  const [adminEmail, setAdminEmail] = useState(settings.adminEmail);
  const [adminRole, setAdminRole] = useState(settings.adminRole);
  const [adminPhone, setAdminPhone] = useState(settings.adminPhone);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteAdminRole>("admin");
  const [isInviting, setIsInviting] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  // Ownership Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedTargetAdminId, setSelectedTargetAdminId] =
    useState<string>("");
  const [previousAdminNewRole, setPreviousAdminNewRole] =
    useState<InviteAdminRole>("admin");
  const [transferReason, setTransferReason] = useState("");
  const [transferConfirmation, setTransferConfirmation] = useState("");
  const [transferError, setTransferError] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferSuccessNotice, setTransferSuccessNotice] = useState<
    string | null
  >(null);

  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const isSuperAdmin =
    Boolean(adminProfile?.isActive) && adminProfile?.role === "super_admin";

  const eligibleTransferTargets = useMemo(() => {
    if (!adminProfile) return [];
    return teamMembers.filter(
      (m) => m.id !== adminProfile.id && m.isActive && m.role !== "super_admin",
    );
  }, [teamMembers, adminProfile]);

  const selectedTargetAdmin: AdminProfile | undefined = useMemo(() => {
    return eligibleTransferTargets.find((m) => m.id === selectedTargetAdminId);
  }, [eligibleTransferTargets, selectedTargetAdminId]);

  const isConfirmationMatched = useMemo(() => {
    const cleaned = transferConfirmation.trim();
    if (!cleaned || !selectedTargetAdmin) return false;
    return (
      cleaned.toUpperCase() === "TRANSFER" ||
      cleaned.toLowerCase() === selectedTargetAdmin.email.toLowerCase()
    );
  }, [transferConfirmation, selectedTargetAdmin]);

  useEffect(() => {
    setChurchName(settings.churchName);
    setBranchName(settings.branchName);
    setTagline(settings.tagline);
    setAddress(settings.address);
    setPublicBaseUrl(settings.publicBaseUrl || "http://localhost:3000");
    if (settings.geofenceLatitude !== null) setGeofenceLat(String(settings.geofenceLatitude));
    if (settings.geofenceLongitude !== null) setGeofenceLng(String(settings.geofenceLongitude));
    if (settings.geofenceRadiusM) setGeofenceRadius(settings.geofenceRadiusM);
    if (settings.gpsAccuracyThresholdM) setGpsAccuracy(settings.gpsAccuracyThresholdM);
    setAdminName(settings.adminName);
    setAdminEmail(settings.adminEmail);
    setAdminRole(settings.adminRole);
    setAdminPhone(settings.adminPhone);
  }, [settings]);

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const parsedLat = parseCoordinateSingle(geofenceLat) ?? 7.3775;
      const parsedLng = parseCoordinateSingle(geofenceLng) ?? 3.9470;
      await updateSettings({
        churchName,
        branchName,
        tagline,
        address,
        publicBaseUrl: publicBaseUrl.trim() || "http://localhost:3000",
        geofenceLatitude: parsedLat,
        geofenceLongitude: parsedLng,
        geofenceRadiusM: geofenceRadius || 100,
        gpsAccuracyThresholdM: gpsAccuracy || 250,
        adminName,
        adminPhone,
      });
      setGeofenceLat(String(parsedLat));
      setGeofenceLng(String(parsedLng));
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2600);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateInvitation = async () => {
    if (!inviteEmail.trim() || isInviting) return;
    setIsInviting(true);
    try {
      await inviteAdmin(inviteEmail.trim(), inviteRole);
      setInviteEmail("");
    } finally {
      setIsInviting(false);
    }
  };

  const openTransferModal = (preselectedAdminId?: string) => {
    const initialTarget =
      preselectedAdminId || eligibleTransferTargets[0]?.id || "";
    setSelectedTargetAdminId(initialTarget);
    setPreviousAdminNewRole("admin");
    setTransferReason("");
    setTransferConfirmation("");
    setTransferError(null);
    setIsTransferModalOpen(true);
  };

  const handleConfirmTransfer = async () => {
    if (!selectedTargetAdmin || !isConfirmationMatched || isTransferring) {
      return;
    }

    setIsTransferring(true);
    setTransferError(null);

    try {
      await transferSuperAdminOwnership({
        targetAdminId: selectedTargetAdmin.id,
        previousAdminNewRole,
        confirmation: transferConfirmation.trim(),
        reason: transferReason.trim(),
      });

      setIsTransferModalOpen(false);
      setTransferSuccessNotice(
        `Super Administrator ownership has been transferred to ${selectedTargetAdmin.fullName} (${selectedTargetAdmin.email}). Your account role is now ${previousAdminNewRole === "coordinator" ? "Department Coordinator" : "Administrator"}.`,
      );
    } catch (err) {
      setTransferError(
        err instanceof Error
          ? err.message
          : "Ownership transfer failed. Please verify requirements and try again.",
      );
    } finally {
      setIsTransferring(false);
    }
  };

  const getInvitationLink = (token: string) => {
    const base = (
      settings.publicBaseUrl ||
      (typeof window !== "undefined" ? window.location.origin : "") ||
      "http://localhost:3000"
    ).replace(/\/+$/, "");
    return `${base}/invite/${encodeURIComponent(token)}`;
  };

  const handleCopyInvite = async (id: string, token: string) => {
    const url = getInvitationLink(token);
    try {
      await navigator.clipboard.writeText(url);
    } catch {}
    setCopiedInviteId(id);
    setTimeout(() => setCopiedInviteId(null), 2000);
  };

  return (
    <>
      <form onSubmit={handleSaveAll} className="space-y-8">
        <FadeIn>
          <PageHeader
            subtitle="Preferences & Governance"
            title="System Settings"
            description="Configure Light Nation Ibadan branding, appearance themes, administrator team access, Super Admin ownership transfer, and attendance rules."
            actions={
              <Button type="submit" loading={isSaving} loadingText="Saving...">
                <FloppyDiscIcon className="size-4" />
                {savedNotice ? "Settings Saved" : "Save Changes"}
              </Button>
            }
          />
        </FadeIn>

        {savedNotice && (
          <FadeIn>
            <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircleIcon className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                Your Light Nation Ibadan settings and administrator profile have
                been saved to Supabase.
              </span>
            </div>
          </FadeIn>
        )}

        {transferSuccessNotice && (
          <FadeIn>
            <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircleIcon className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{transferSuccessNotice}</span>
            </div>
          </FadeIn>
        )}

        {/* Appearance & Three-Theme Selector Section */}
        <FadeIn delayMs={40}>
          <Card className="p-6">
            <div>
              <h2 className="section-heading">
                Appearance &amp; Three-Theme System
              </h2>
              <p className="supporting-text">
                Select your preferred interface appearance. Your choice applies
                across all administrative pages and the public registration
                form.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {APPEARANCE_CARDS.map((mode) => {
                const Icon = mode.Icon;
                const isSelected = themeMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setThemeMode(mode.id)}
                    className={`group flex flex-col justify-between rounded-2xl border p-4 text-start transition-all ${
                      isSelected
                        ? "border-brand-500 bg-(--ln-surface-warm)/40 ring-2 ring-brand-500/20"
                        : "border-(--ln-border) hover:border-(--ln-border-strong)"
                    }`}
                  >
                    <div>
                      {/* Visual Mini Preview */}
                      <div
                        className={`mb-3.5 rounded-xl border p-3 ${mode.previewBg}`}
                      >
                        <div
                          className={`rounded-lg border p-2.5 shadow-2xs ${mode.previewCard}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="h-2 w-14 rounded-full bg-brand-500" />
                            <span className="size-2.5 rounded-full bg-amber-500" />
                          </div>
                          <div className="mt-2 h-1.5 w-24 rounded-full bg-gray-400/40" />
                          <div className="mt-1.5 h-1.5 w-16 rounded-full bg-gray-400/25" />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-(--ln-fg-primary)">
                          <Icon className="size-4 text-brand-600 dark:text-brand-400" />
                          {mode.title}
                        </span>
                        {isSelected && (
                          <Badge variant="light" color="primary" size="sm">
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-(--ln-fg-muted)">
                        {mode.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </FadeIn>

        <div className="grid grid-cols-12 gap-6">
          {/* Church Branding & Identity */}
          <FadeIn delayMs={80} className="col-span-12 xl:col-span-7">
            <Card className="h-full p-6">
              <div>
                <h2 className="section-heading">
                  Church Branding &amp; Official Lockup
                </h2>
                <p className="supporting-text">
                  Official identity lockup and configuration for Light Nation
                  Ibadan.
                </p>
              </div>

              {/* Live Brand Lockup Preview Box */}
              <div className="flex flex-col justify-between gap-4 rounded-2xl border border-dashed border-(--ln-border-strong) bg-(--ln-surface-warm)/45 p-4 sm:flex-row sm:items-center">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold tracking-wider text-brand-600 uppercase dark:text-brand-400">
                    Active Brand Lockup Preview
                  </span>
                  <div className="pt-1">
                    <BrandLogo size="lg" href={undefined} />
                  </div>
                </div>

                <div className="text-xs text-(--ln-fg-muted) sm:text-end">
                  <p className="font-medium text-(--ln-fg-primary)">
                    Official Brand Mark Asset:
                  </p>
                  <code className="mt-0.5 inline-block rounded border border-(--ln-border) bg-(--ln-surface) px-2 py-0.5 font-mono text-[11px] text-(--ln-fg-secondary)">
                    /images/brand/light-nation-mark.png
                  </code>
                  <p className="mt-1 text-[11px]">
                    Primary brand colour reference:{" "}
                    <code className="font-mono font-semibold text-brand-500">
                      #FF4500
                    </code>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Primary Church Name</FieldLabel>
                  <Input
                    value={churchName}
                    onChange={(e) => setChurchName(e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel>Branch / Campus Subtitle</FieldLabel>
                  <Input
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                  />
                </Field>

                <Field className="sm:col-span-2">
                  <FieldLabel>Church Tagline / Affirmation</FieldLabel>
                  <Input
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                  />
                </Field>

                <Field className="sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <FieldLabel>Auditorium Location / Address</FieldLabel>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => handleGeocodeAddress()}
                      disabled={isGeocoding || !address.trim()}
                      className="text-xs text-brand-600 dark:text-brand-400 gap-1 hover:text-brand-700"
                    >
                      <SearchIcon className="size-3" />
                      {isGeocoding ? "Finding GPS..." : "Set GPS from this Address"}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. Ring Road, Ibadan, Oyo State, Nigeria"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleGeocodeAddress()}
                      disabled={isGeocoding || !address.trim()}
                      className="shrink-0 text-xs px-3"
                    >
                      {isGeocoding ? "Searching..." : "Lookup GPS"}
                    </Button>
                  </div>
                  {geocodeFeedback && (
                    <p
                      className={`mt-1 text-[11px] font-medium ${
                        geocodeFeedback.type === "success"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {geocodeFeedback.message}
                    </p>
                  )}
                </Field>

                <Field className="sm:col-span-2">
                  <FieldLabel>Public QR Registration Base URL</FieldLabel>
                  <Input
                    type="url"
                    value={publicBaseUrl}
                    onChange={(e) => setPublicBaseUrl(e.target.value)}
                    placeholder="http://localhost:3000"
                  />
                </Field>

                {/* Church Geofence Settings */}
                <div className="sm:col-span-2 pt-3 border-t border-(--ln-border) space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-semibold text-(--ln-fg-primary) uppercase tracking-wider">
                        Auditorium GPS Geofence Configuration
                      </h3>
                      <p className="text-xs text-(--ln-fg-muted)">
                        Used to verify physical attendee presence during General Attendance QR check-in.
                      </p>
                    </div>

                    {/* Action Buttons: Geolocation Detect + Geocode from Address */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => handleGeocodeAddress()}
                        disabled={isGeocoding || !address.trim()}
                        className="gap-1.5 text-xs shrink-0"
                      >
                        <SearchIcon className="size-3.5 text-brand-500" />
                        {isGeocoding ? "Looking up..." : "Use Address GPS"}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={handleDetectCurrentLocation}
                        disabled={isDetectingGps}
                        className="gap-1.5 text-xs shrink-0"
                      >
                        <MapPinIcon className="size-3.5 text-brand-500" />
                        {isDetectingGps ? "Detecting GPS..." : "Capture Current GPS"}
                      </Button>
                    </div>
                  </div>

                  {gpsDetectMessage && (
                    <div className="flex items-center gap-2 rounded-lg border border-brand-500/25 bg-brand-500/10 px-3 py-1.5 text-xs text-brand-700 dark:text-brand-300">
                      <SparkIcon className="size-3.5 shrink-0" />
                      <span>{gpsDetectMessage}</span>
                    </div>
                  )}

                  {/* Quick Paste from Google Maps */}
                  <div className="rounded-xl border border-(--ln-border) bg-(--ln-surface-warm)/35 p-3 space-y-2">
                    <FieldLabel className="text-xs font-medium text-(--ln-fg-primary)">
                      Smart Coordinate Converter (Paste from Google Maps or GPS)
                    </FieldLabel>
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={quickPasteInput}
                        onChange={(e) => handleQuickPaste(e.target.value)}
                        placeholder="e.g. 7°22'38.4&quot;N 3°56'49.2&quot;E, 7.3775, 3.9470, or Maps link"
                        className="text-xs h-8.5 font-mono"
                      />
                      {quickPasteInput && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => {
                            setQuickPasteInput("");
                            setQuickPasteStatus(null);
                          }}
                          className="text-xs shrink-0"
                        >
                          Clear
                        </Button>
                      )}
                    </div>

                    {quickPasteStatus && (
                      <p
                        className={`text-[11px] font-medium ${
                          quickPasteStatus.type === "success"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {quickPasteStatus.message}
                      </p>
                    )}

                    {/* Coordinate Explanatory Callout */}
                    <p className="text-[11px] text-(--ln-fg-muted) leading-relaxed">
                      💡 <strong>Note on coordinates:</strong> The small zero (<code>°</code>) is the <strong>Degree symbol</strong>.
                      {" "}<code>N</code> (North) is <strong>Latitude</strong> and <code>E</code> (East) is <strong>Longitude</strong>.
                      {" "}You can paste degrees or decimal numbers — the system converts both automatically.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field>
                      <div className="flex items-center justify-between">
                        <FieldLabel className="text-xs">Latitude (North / South)</FieldLabel>
                        {currentLatDms && (
                          <span className="font-mono text-[10px] text-brand-600 dark:text-brand-400 font-medium">
                            {currentLatDms}
                          </span>
                        )}
                      </div>
                      <Input
                        type="text"
                        value={geofenceLat}
                        onChange={(e) => setGeofenceLat(e.target.value)}
                        placeholder="7.3775 or 7°22'38&quot;N"
                        className="text-xs font-mono"
                      />
                    </Field>

                    <Field>
                      <div className="flex items-center justify-between">
                        <FieldLabel className="text-xs">Longitude (East / West)</FieldLabel>
                        {currentLngDms && (
                          <span className="font-mono text-[10px] text-brand-600 dark:text-brand-400 font-medium">
                            {currentLngDms}
                          </span>
                        )}
                      </div>
                      <Input
                        type="text"
                        value={geofenceLng}
                        onChange={(e) => setGeofenceLng(e.target.value)}
                        placeholder="3.9470 or 3°56'49&quot;E"
                        className="text-xs font-mono"
                      />
                    </Field>

                    <Field>
                      <FieldLabel className="text-xs">Permitted Geofence Radius (m)</FieldLabel>
                      <Input
                        type="number"
                        min={20}
                        max={5000}
                        value={geofenceRadius}
                        onChange={(e) => setGeofenceRadius(Number(e.target.value))}
                        className="text-xs"
                      />
                      <span className="text-[10px] text-(--ln-fg-muted)">
                        Default: 100 metres around auditorium.
                      </span>
                    </Field>

                    <Field>
                      <FieldLabel className="text-xs">Acceptable GPS Accuracy (m)</FieldLabel>
                      <Input
                        type="number"
                        min={5}
                        max={1000}
                        value={gpsAccuracy}
                        onChange={(e) => setGpsAccuracy(Number(e.target.value))}
                        className="text-xs"
                      />
                      <span className="text-[10px] text-(--ln-fg-muted)">
                        Maximum phone GPS drift (Default: 250m for indoor church buildings).
                      </span>
                    </Field>
                  </div>
                </div>
              </div>
            </Card>
          </FadeIn>

          {/* Administrator Settings */}
          <FadeIn delayMs={120} className="col-span-12 xl:col-span-5">
            <Card className="h-full p-6">
              <div>
                <h2 className="section-heading">Administrator Profile</h2>
                <p className="supporting-text">
                  Your signed-in administrator profile details stored in
                  Supabase.
                </p>
              </div>

              <div className="space-y-4">
                <Field>
                  <FieldLabel>Administrator Name</FieldLabel>
                  <Input
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel>Official Email Address</FieldLabel>
                  <Input type="email" value={adminEmail} disabled />
                </Field>

                <Field>
                  <FieldLabel>Role / Designation</FieldLabel>
                  <Input value={adminRole} disabled />
                </Field>

                <Field>
                  <FieldLabel>Contact Phone Number</FieldLabel>
                  <Input
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value)}
                  />
                </Field>
              </div>
            </Card>
          </FadeIn>

          {/* Administrator Team, Invitations & Super Admin Ownership Transfer */}
          <FadeIn delayMs={140} className="col-span-12">
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="section-heading">
                    Administrator Team &amp; Super Admin Ownership
                  </h2>
                  <p className="supporting-text">
                    Public sign-up is disabled. Invite administrators via
                    one-time links, manage active roles, or transfer Super
                    Administrator ownership.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="light" color="primary">
                    {teamMembers.filter((m) => m.isActive).length} Active{" "}
                    {teamMembers.filter((m) => m.isActive).length === 1
                      ? "Admin"
                      : "Admins"}
                  </Badge>
                  {isSuperAdmin && eligibleTransferTargets.length > 0 && (
                    <Button
                      type="button"
                      variant="brand-outline"
                      size="xs"
                      onClick={() => openTransferModal()}
                    >
                      <LockIcon className="size-3.5" />
                      Transfer Super Admin Ownership
                    </Button>
                  )}
                </div>
              </div>

              {/* Invite New Administrator Form */}
              {adminProfile &&
                (adminProfile.role === "super_admin" ||
                  adminProfile.role === "admin") && (
                  <div className="grid grid-cols-1 gap-3 rounded-2xl border border-(--ln-border) bg-(--ln-surface-warm)/40 p-4 md:grid-cols-12">
                    <div className="md:col-span-6">
                      <Input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="Enter new administrator email address..."
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Select
                        value={inviteRole}
                        onValueChange={(val) =>
                          setInviteRole((val as InviteAdminRole) ?? "admin")
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrator</SelectItem>
                          <SelectItem value="coordinator">
                            Department Coordinator
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-3">
                      <Button
                        type="button"
                        onClick={handleCreateInvitation}
                        loading={isInviting}
                        loadingText="Creating..."
                        disabled={!inviteEmail.trim()}
                        className="w-full"
                      >
                        <PlusIcon className="size-4" />
                        Generate Invite Link
                      </Button>
                    </div>
                  </div>
                )}

              {/* Pending Invitations */}
              {invitations.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold tracking-wider text-(--ln-fg-muted) uppercase">
                    Pending Invitations
                  </h3>
                  <div className="space-y-2">
                    {invitations.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex flex-col justify-between gap-3 rounded-xl border border-(--ln-border) bg-(--ln-surface-warm)/30 p-3.5 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-(--ln-fg-primary)">
                              {inv.email}
                            </span>
                            <Badge variant="light" color="warning" size="sm">
                              {inv.role}
                            </Badge>
                          </div>
                          <code className="mt-1 block truncate text-xs text-(--ln-fg-muted)">
                            {getInvitationLink(inv.token)}
                          </code>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={() => handleCopyInvite(inv.id, inv.token)}
                          >
                            {copiedInviteId === inv.id ? (
                              <>
                                <CheckIcon className="size-3.5 text-emerald-600" />
                                Copied
                              </>
                            ) : (
                              <>
                                <CopyIcon className="size-3.5" />
                                Copy Invite Link
                              </>
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => void revokeInvitation(inv.id)}
                            aria-label="Revoke invitation"
                            className="text-(--ln-fg-muted) hover:text-red-600"
                          >
                            <TrashBinIcon className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Organization Administrators List */}
              {teamMembers.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-semibold tracking-wider text-(--ln-fg-muted) uppercase">
                    Organization Administrators
                  </h3>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {teamMembers.map((member) => {
                      const isSelf = member.id === adminProfile?.id;
                      const canPromoteToSuperAdmin =
                        isSuperAdmin &&
                        !isSelf &&
                        member.isActive &&
                        member.role !== "super_admin";

                      return (
                        <div
                          key={member.id}
                          className="flex flex-col justify-between gap-3 rounded-xl border border-(--ln-border) p-4 sm:flex-row sm:items-center"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold text-(--ln-fg-primary)">
                                {member.fullName}
                                {isSelf ? " (You)" : ""}
                              </p>
                              <Badge
                                variant="light"
                                color={
                                  member.role === "super_admin"
                                    ? "primary"
                                    : member.role === "admin"
                                      ? "success"
                                      : "gray"
                                }
                                size="sm"
                              >
                                {member.role === "super_admin"
                                  ? "Super Admin"
                                  : member.role === "coordinator"
                                    ? "Coordinator"
                                    : "Admin"}
                              </Badge>
                              {!member.isActive && (
                                <Badge variant="light" color="error" size="sm">
                                  Inactive
                                </Badge>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-xs text-(--ln-fg-muted)">
                              {member.email}
                            </p>
                          </div>

                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {isSuperAdmin &&
                              !isSelf &&
                              member.role !== "super_admin" && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  onClick={() =>
                                    void manageTeamMember({
                                      memberId: member.id,
                                      isActive: !member.isActive,
                                    })
                                  }
                                >
                                  {member.isActive ? "Deactivate" : "Activate"}
                                </Button>
                              )}

                            {canPromoteToSuperAdmin && (
                              <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                onClick={() => openTransferModal(member.id)}
                              >
                                <LockIcon className="size-3.5 text-brand-600 dark:text-brand-400" />
                                Make Super Admin
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Super Admin Ownership Transfer Guidance / Audit Log */}
              <div className="rounded-2xl border border-(--ln-border) bg-(--ln-surface-warm)/35 p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <LockIcon className="size-4 text-brand-600 dark:text-brand-400" />
                      <h3 className="text-sm font-semibold text-(--ln-fg-primary)">
                        Super Admin Ownership Governance
                      </h3>
                    </div>
                    <p className="text-xs leading-relaxed text-(--ln-fg-muted)">
                      The initial Super Admin is never permanently locked as the
                      owner. Ownership can be atomically transferred to any
                      active administrator in your organization, automatically
                      transitioning the previous Super Admin to a regular Admin
                      (or Coordinator) and recording an immutable audit log.
                    </p>
                  </div>

                  {isSuperAdmin && (
                    <div className="shrink-0">
                      {eligibleTransferTargets.length > 0 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => openTransferModal()}
                        >
                          Transfer Ownership
                        </Button>
                      ) : (
                        <span className="inline-block rounded-lg border border-(--ln-border) bg-(--ln-surface) px-3 py-1.5 text-[11px] font-medium text-(--ln-fg-muted)">
                          Invite &amp; activate another admin to enable transfer
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Ownership Transfer Audit History */}
                {ownershipTransferLogs.length > 0 && (
                  <div className="mt-4 border-t border-(--ln-border) pt-3.5">
                    <h4 className="mb-2.5 text-[11px] font-semibold tracking-wider text-(--ln-fg-muted) uppercase">
                      Ownership Transfer Audit Log (
                      {ownershipTransferLogs.length})
                    </h4>
                    <div className="space-y-2">
                      {ownershipTransferLogs.map((log) => (
                        <div
                          key={log.id}
                          className="flex flex-col justify-between gap-2 rounded-xl border border-(--ln-border) bg-(--ln-surface) px-3.5 py-2.5 text-xs sm:flex-row sm:items-center"
                        >
                          <div className="space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5 font-medium text-(--ln-fg-primary)">
                              <span>{log.previousSuperAdminName}</span>
                              <span className="text-(--ln-fg-muted)">
                                ({log.previousSuperAdminEmail})
                              </span>
                              <ArrowRightIcon className="size-3.5 text-brand-500" />
                              <span className="font-semibold text-brand-600 dark:text-brand-400">
                                {log.newSuperAdminName}
                              </span>
                              <span className="text-(--ln-fg-muted)">
                                ({log.newSuperAdminEmail})
                              </span>
                            </div>
                            <p className="text-[11px] text-(--ln-fg-muted)">
                              Previous Super Admin assigned role:{" "}
                              <strong className="text-(--ln-fg-secondary)">
                                {log.previousAdminNewRole}
                              </strong>
                              {log.reason ? ` · Note: "${log.reason}"` : ""}
                            </p>
                          </div>
                          <span className="tabular shrink-0 font-mono text-[11px] text-(--ln-fg-muted)">
                            {formatTimestamp(
                              log.transferredAt,
                              settings.timezone,
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </FadeIn>

          {/* Application Information & Check-In Governance */}
          <FadeIn delayMs={160} className="col-span-12">
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="section-heading">
                    Application Information &amp; Attendance Rules
                  </h2>
                  <p className="supporting-text">
                    Configure public QR registration validation and inspect
                    system architecture status.
                  </p>
                </div>
                <Badge variant="light" color="success">
                  <DatabaseIcon className="size-3.5" />
                  Connected to Supabase
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="flex items-center justify-between gap-4 rounded-xl border border-(--ln-border) bg-(--ln-surface-warm)/35 p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-(--ln-fg-primary)">
                      Prevent Duplicate Check-Ins
                    </h3>
                    <p className="mt-0.5 text-xs text-(--ln-fg-muted)">
                      Database-enforced unique constraint per attendee per
                      session.
                    </p>
                  </div>
                  <Switch
                    checked={settings.preventDuplicateSubmissions}
                    disabled
                  />
                </div>

                <div className="flex items-center justify-between gap-4 rounded-xl border border-(--ln-border) bg-(--ln-surface-warm)/35 p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-(--ln-fg-primary)">
                      Central Department List Enforcement
                    </h3>
                    <p className="mt-0.5 text-xs text-(--ln-fg-muted)">
                      Attendees select strictly from the central church department
                      list or General Congregation. Free-text entries are disabled.
                    </p>
                  </div>
                  <Switch
                    checked={settings.allowOtherDepartment}
                    onCheckedChange={(checked) => {
                      void updateSettings({ allowOtherDepartment: checked });
                    }}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 rounded-xl border border-(--ln-border) bg-(--ln-surface-warm)/35 p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-(--ln-fg-primary)">
                      Server-Validated Session Window
                    </h3>
                    <p className="mt-0.5 text-xs text-(--ln-fg-muted)">
                      PostgreSQL validates session date, opening time, and
                      closing time on every check-in.
                    </p>
                  </div>
                  <Switch checked={settings.autoCloseAfterEndTime} disabled />
                </div>
              </div>

              {/* System Info Footer */}
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-(--ln-border) bg-(--ln-surface-warm)/45 p-4 text-xs sm:grid-cols-4">
                <div>
                  <span className="block text-(--ln-fg-muted)">
                    Application
                  </span>
                  <span className="mt-0.5 block font-semibold text-(--ln-fg-primary)">
                    Light Nation Attendance v2.0
                  </span>
                </div>
                <div>
                  <span className="block text-(--ln-fg-muted)">
                    Campus / Branch
                  </span>
                  <span className="mt-0.5 block font-semibold text-(--ln-fg-primary)">
                    {settings.churchName} {settings.branchName}
                  </span>
                </div>
                <div>
                  <span className="block text-(--ln-fg-muted)">Timezone</span>
                  <span className="mt-0.5 block font-semibold text-(--ln-fg-primary)">
                    {settings.timezone}
                  </span>
                </div>
                <div>
                  <span className="block text-(--ln-fg-muted)">Data Layer</span>
                  <span className="mt-0.5 block font-semibold text-emerald-700 dark:text-emerald-400">
                    Supabase PostgreSQL + RLS
                  </span>
                </div>
              </div>
            </Card>
          </FadeIn>
        </div>
      </form>

      {/* Explicit Super Admin Ownership Transfer Modal */}
      <Dialog
        open={isTransferModalOpen}
        onOpenChange={(open) => {
          setIsTransferModalOpen(open);
          if (!open) {
            setTransferError(null);
            setTransferConfirmation("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Transfer Super Administrator Ownership</DialogTitle>
            <DialogDescription>
              Promote another active administrator in{" "}
              <strong>
                {settings.churchName} {settings.branchName}
              </strong>{" "}
              to Super Administrator. This operation runs atomically in
              PostgreSQL and is recorded in the organization audit log.
            </DialogDescription>
          </DialogHeader>

          {transferError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300"
            >
              <AlertIcon className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
              <span>{transferError}</span>
            </div>
          )}

          <div className="mt-2 space-y-4">
            <Field>
              <FieldLabel>
                New Super Administrator (Recipient){" "}
                <span className="text-brand-600">*</span>
              </FieldLabel>
              <Select
                value={selectedTargetAdminId}
                onValueChange={(val) => setSelectedTargetAdminId(val ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an active administrator">
                    {(val) => {
                      if (!val) return "Select an active administrator";
                      const found = eligibleTransferTargets.find(
                        (t) => t.id === val,
                      );
                      return found ? `${found.fullName} (${found.email})` : val;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {eligibleTransferTargets.map((target) => (
                    <SelectItem key={target.id} value={target.id}>
                      {target.fullName} ({target.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Your Role After Ownership Transfer</FieldLabel>
              <Select
                value={previousAdminNewRole}
                onValueChange={(val) =>
                  setPreviousAdminNewRole((val as InviteAdminRole) ?? "admin")
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your new role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    Regular Administrator (Recommended Default)
                  </SelectItem>
                  <SelectItem value="coordinator">
                    Department Coordinator
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>
                Reason / Handover Note{" "}
                <span className="font-normal text-(--ln-fg-muted)">
                  (Optional, saved in audit log)
                </span>
              </FieldLabel>
              <Input
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="e.g. Leadership transition to new branch administrator"
              />
            </Field>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
              <p className="font-semibold">Confirmation Required</p>
              <p className="mt-1 leading-relaxed">
                To confirm this transfer, type{" "}
                <code className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono font-bold">
                  TRANSFER
                </code>{" "}
                {selectedTargetAdmin ? (
                  <>
                    or{" "}
                    <code className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono font-bold">
                      {selectedTargetAdmin.email}
                    </code>{" "}
                  </>
                ) : null}
                below.
              </p>
            </div>

            <Field>
              <FieldLabel>
                Type Confirmation <span className="text-brand-600">*</span>
              </FieldLabel>
              <Input
                value={transferConfirmation}
                onChange={(e) => setTransferConfirmation(e.target.value)}
                placeholder={
                  selectedTargetAdmin
                    ? `Type TRANSFER or ${selectedTargetAdmin.email}`
                    : "Type TRANSFER"
                }
              />
            </Field>

            <div className="flex flex-col-reverse justify-end gap-2.5 pt-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTransferModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!isConfirmationMatched || !selectedTargetAdmin}
                loading={isTransferring}
                loadingText="Transferring Ownership..."
                onClick={handleConfirmTransfer}
              >
                Confirm Ownership Transfer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
