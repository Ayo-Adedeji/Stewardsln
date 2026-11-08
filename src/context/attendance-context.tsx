"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  AdminInvitation,
  AdminProfile,
  AdminRole,
  AttendanceAnalytics,
  AttendanceRecord,
  AttendanceSession,
  ChurchSettings,
  Department,
  FormSchema,
  InviteAdminRole,
  OwnershipTransferLog,
  SessionStatus,
  SessionType,
} from "@/types/attendance";
import { CENTRAL_CHURCH_DEPARTMENTS } from "@/utils/departments";
import { formatIsoToTime12h } from "@/utils/format";
import { getFormTemplateForSessionType } from "@/utils/form-templates";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface CreateSessionInput {
  eventName: string;
  sessionType?: SessionType;
  eventDate: string;
  openingTime: string;
  closingTime: string;
  protocolClosingTime?: string; // optional later close time for Protocol QR
  description?: string;
  status?: SessionStatus;
  expectedCapacity?: number;
  formSchema?: FormSchema;
  geofenceLatitude?: number | null;
  geofenceLongitude?: number | null;
  geofenceRadiusM?: number | null;
  gpsAccuracyThresholdM?: number | null;
}

export interface UpdateSessionInput {
  eventName?: string;
  sessionType?: SessionType;
  eventDate?: string;
  openingTime?: string;
  closingTime?: string;
  protocolClosingTime?: string | null; // null clears it
  description?: string;
  status?: SessionStatus;
  expectedCapacity?: number;
  formSchema?: FormSchema;
  geofenceLatitude?: number | null;
  geofenceLongitude?: number | null;
  geofenceRadiusM?: number | null;
  gpsAccuracyThresholdM?: number | null;
}

export interface SubmitGpsAttendanceInput {
  token: string;
  fullName: string;
  departmentId: string;
  customDepartment?: string;
  responses?: Record<string, unknown>;
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface SubmitProtocolAttendanceInput {
  token: string;
  fullName: string;
  departmentId: string;
  customDepartment?: string;
  responses?: Record<string, unknown>;
}

export interface SubmitAttendanceResult {
  outcome:
    | "success"
    | "duplicate"
    | "not-open"
    | "closed"
    | "invalid-qr"
    | "location-required"
    | "outside-geofence"
    | "poor-accuracy"
    | "protocol-only";
  record?: AttendanceRecord;
  session?: AttendanceSession;
  location?: {
    status: string;
    distanceM?: number;
    radiusM?: number;
    accuracyM?: number;
    accuracyThresholdM?: number;
  };
  errorMessage?: string;
  myRegistrations?: number;
}

export interface DepartmentInput {
  name: string;
  code: string;
  description: string;
  leaderName: string;
  memberCount?: number;
  isEnabled?: boolean;
}

export interface TransferSuperAdminInput {
  targetAdminId: string;
  previousAdminNewRole?: InviteAdminRole;
  confirmation: string;
  reason?: string;
}

export interface ManageTeamMemberInput {
  memberId: string;
  role?: InviteAdminRole;
  isActive?: boolean;
}

export interface AnalyticsFilters {
  from?: string;
  to?: string;
  sessionType?: SessionType;
}

interface AttendanceContextValue {
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
  departments: Department[];
  settings: ChurchSettings;
  adminProfile: AdminProfile | null;
  teamMembers: AdminProfile[];
  invitations: AdminInvitation[];
  ownershipTransferLogs: OwnershipTransferLog[];
  analytics: AttendanceAnalytics | null;
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  refreshData: () => Promise<void>;
  fetchAnalytics: (filters?: AnalyticsFilters) => Promise<AttendanceAnalytics | null>;
  createSession: (input: CreateSessionInput) => Promise<AttendanceSession>;
  updateSession: (id: string, input: UpdateSessionInput) => Promise<AttendanceSession>;
  updateSessionStatus: (id: string, status: SessionStatus) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  rotateToken: (
    sessionId: string,
    accessType: "general" | "protocol",
    regenerate?: boolean,
    reason?: string,
  ) => Promise<{ token: string }>;
  getSessionByToken: (token: string) => AttendanceSession | undefined;
  submitGpsAttendance: (
    input: SubmitGpsAttendanceInput,
  ) => Promise<SubmitAttendanceResult>;
  submitProtocolAttendance: (
    input: SubmitProtocolAttendanceInput,
  ) => Promise<SubmitAttendanceResult>;
  addDepartment: (input: DepartmentInput) => Promise<Department>;
  updateDepartment: (
    id: string,
    input: Partial<DepartmentInput>,
  ) => Promise<void>;
  deleteDepartment: (id: string) => Promise<void>;
  toggleDepartmentStatus: (id: string) => Promise<void>;
  updateSettings: (partial: Partial<ChurchSettings>) => Promise<void>;
  inviteAdmin: (
    email: string,
    role: InviteAdminRole,
  ) => Promise<AdminInvitation>;
  revokeInvitation: (id: string) => Promise<void>;
  transferSuperAdminOwnership: (
    input: TransferSuperAdminInput,
  ) => Promise<void>;
  manageTeamMember: (input: ManageTeamMemberInput) => Promise<void>;
  signOut: () => Promise<void>;
}

const DEFAULT_EMPTY_SETTINGS: ChurchSettings = {
  churchName: "Light Nation",
  branchName: "Ibadan",
  tagline: "The shout of a king is among us.",
  address: "Main Auditorium, Ibadan",
  timezone: "Africa/Lagos",
  publicBaseUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  geofenceLatitude: 7.3775, // Default church latitude (Ibadan)
  geofenceLongitude: 3.947, // Default church longitude (Ibadan)
  geofenceRadiusM: 100, // 100m default radius
  gpsAccuracyThresholdM: 250, // 250m default threshold for indoor auditoriums
  preventDuplicateSubmissions: true,
  allowOtherDepartment: false,
  autoCloseAfterEndTime: true,
  adminName: "",
  adminEmail: "",
  adminRole: "Administrator",
  adminPhone: "",
};

export function computeSessionLiveStatus(
  dbStatus: string,
  sessionDate: string,
  startTime: string,
  endTime: string,
  timezone = "Africa/Lagos",
  protocolEndTime?: string,
): SessionStatus {
  if (dbStatus === "closed" || dbStatus === "expired") {
    return "closed";
  }

  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const getPart = (t: string) =>
      parts.find((p) => p.type === t)?.value || "";
    const currentDate = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
    const currentTime = `${getPart("hour")}:${getPart("minute")}:${getPart("second")}`;

    const effectiveEnd = protocolEndTime || endTime;
    const cleanStart =
      startTime.length === 5 ? `${startTime}:00` : startTime;
    const cleanEnd =
      effectiveEnd.length === 5 ? `${effectiveEnd}:00` : effectiveEnd;

    if (
      currentDate > sessionDate ||
      (currentDate === sessionDate && currentTime >= cleanEnd)
    ) {
      return "closed";
    }

    if (
      currentDate < sessionDate ||
      (currentDate === sessionDate && currentTime < cleanStart)
    ) {
      return "scheduled";
    }

    return "open";
  } catch {
    if (dbStatus === "active") return "open";
    if (dbStatus === "upcoming") return "scheduled";
    return "closed";
  }
}

function mapUiStatusToDb(
  uiStatus: SessionStatus,
): "active" | "upcoming" | "closed" {
  if (uiStatus === "open") return "active";
  if (uiStatus === "scheduled") return "upcoming";
  return "closed";
}

function formatRoleLabel(role: string): string {
  if (role === "super_admin") return "Super Administrator";
  if (role === "coordinator") return "Department Coordinator";
  return "Administrator";
}

const AttendanceContext = createContext<AttendanceContextValue | undefined>(
  undefined,
);

export function AttendanceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [settings, setSettings] = useState<ChurchSettings>(
    DEFAULT_EMPTY_SETTINGS,
  );
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [teamMembers, setTeamMembers] = useState<AdminProfile[]>([]);
  const [invitations, setInvitations] = useState<AdminInvitation[]>([]);
  const [ownershipTransferLogs, setOwnershipTransferLogs] = useState<
    OwnershipTransferLog[]
  >([]);
  const [analytics, setAnalytics] = useState<AttendanceAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const fetchAnalytics = useCallback(
    async (filters?: AnalyticsFilters): Promise<AttendanceAnalytics | null> => {
      try {
        const { data, error: rpcErr } = await supabase.rpc(
          "get_attendance_analytics",
          {
            p_from: filters?.from || null,
            p_to: filters?.to || null,
            p_session_type: filters?.sessionType || null,
          },
        );

        if (rpcErr) {
          console.error("Failed to load analytics:", rpcErr);
          return null;
        }

        const res = data as AttendanceAnalytics;
        setAnalytics(res);
        return res;
      } catch (err) {
        console.error("Analytics fetch error:", err);
        return null;
      }
    },
    [supabase],
  );

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setAdminProfile(null);
        setTeamMembers([]);
        setInvitations([]);
        setOwnershipTransferLogs([]);
        setSessions([]);
        setRecords([]);
        setDepartments([]);
        setSettings(DEFAULT_EMPTY_SETTINGS);
        setAnalytics(null);
        setIsLoading(false);
        return;
      }

      const { data: profileRow, error: profileError } = await supabase
        .from("admin_profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw new Error(
          `Failed to load administrator profile: ${profileError.message}`,
        );
      }

      if (!profileRow) {
        setAdminProfile(null);
        setIsLoading(false);
        return;
      }

      const currentProfile: AdminProfile = {
        id: profileRow.id,
        organizationId: profileRow.organization_id,
        fullName: profileRow.full_name,
        email: profileRow.email,
        phone: profileRow.phone || "",
        role: profileRow.role as AdminRole,
        isActive: profileRow.is_active,
        createdAt: profileRow.created_at,
      };
      setAdminProfile(currentProfile);

      const orgId = profileRow.organization_id;

      // Protocol-only members use RPCs, don't query staff tables directly
      const isStaff = ["super_admin", "admin", "coordinator"].includes(
        currentProfile.role,
      );

      const [
        orgResult,
        deptsResult,
        sessionsResult,
        recordsResult,
        teamResult,
        invitesResult,
        transferLogsResult,
        tokensResult,
      ] = await Promise.all([
        supabase.from("organizations").select("*").eq("id", orgId).single(),
        supabase
          .from("departments")
          .select("*")
          .eq("organization_id", orgId)
          .order("name", { ascending: true }),
        isStaff
          ? supabase
              .from("attendance_sessions")
              .select("*")
              .eq("organization_id", orgId)
              .order("session_date", { ascending: false })
              .order("start_time", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        isStaff
          ? supabase
              .from("attendance_records")
              .select("*")
              .eq("organization_id", orgId)
              .order("submitted_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("admin_profiles")
          .select("*")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: true }),
        isStaff
          ? supabase
              .from("admin_invitations")
              .select("*")
              .eq("organization_id", orgId)
              .is("accepted_at", null)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        isStaff
          ? supabase
              .from("ownership_transfer_logs")
              .select("*")
              .eq("organization_id", orgId)
              .order("transferred_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        isStaff
          ? supabase
              .from("session_access_tokens")
              .select("*")
              .eq("organization_id", orgId)
              .is("revoked_at", null)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (orgResult.error) {
        throw new Error(
          `Failed to load church organization: ${orgResult.error.message}`,
        );
      }
      if (deptsResult.error) {
        throw new Error(
          `Failed to load departments: ${deptsResult.error.message}`,
        );
      }
      if (sessionsResult.error) {
        throw new Error(
          `Failed to load attendance sessions: ${sessionsResult.error.message}`,
        );
      }
      if (recordsResult.error) {
        throw new Error(
          `Failed to load attendance records: ${recordsResult.error.message}`,
        );
      }

      const org = orgResult.data;
      const tz = org.timezone || "Africa/Lagos";

      setSettings({
        organizationId: org.id,
        churchName: org.name,
        branchName: org.branch,
        tagline: "The shout of a king is among us.",
        address: "Main Auditorium, Ibadan",
        timezone: tz,
        publicBaseUrl:
          org.public_base_url ||
          process.env.NEXT_PUBLIC_APP_URL ||
          "http://localhost:3000",
        geofenceLatitude: org.geofence_latitude ?? 7.3775,
        geofenceLongitude: org.geofence_longitude ?? 3.947,
        geofenceRadiusM: org.geofence_radius_m ?? 100,
        gpsAccuracyThresholdM: org.gps_accuracy_threshold_m ?? 250,
        preventDuplicateSubmissions: true,
        allowOtherDepartment: Boolean(org.allow_other_department_by_default),
        autoCloseAfterEndTime: true,
        adminName: currentProfile.fullName,
        adminEmail: currentProfile.email,
        adminRole: formatRoleLabel(currentProfile.role),
        adminPhone: currentProfile.phone,
      });

      const mappedDepts: Department[] =
        deptsResult.data && deptsResult.data.length > 0
          ? deptsResult.data.map((d) => ({
              id: d.id,
              name: d.name,
              code: d.code,
              description: d.description || "",
              leaderName: d.lead_name || "",
              isEnabled: Boolean(d.enabled),
              memberCount: Number(d.member_count ?? 0),
              createdAt: d.created_at ? String(d.created_at).slice(0, 10) : "",
            }))
          : CENTRAL_CHURCH_DEPARTMENTS.map((d, idx) => ({
              id: `dept-central-${idx + 1}`,
              name: d.name,
              code: d.code,
              description: d.description,
              leaderName: d.leadName || "",
              isEnabled: true,
              memberCount: 10,
              createdAt: new Date().toISOString().slice(0, 10),
            }));
      setDepartments(mappedDepts);

      // Map tokens by sessionId + type
      const tokensBySession = new Map<
        string,
        { general?: string; protocol?: string }
      >();
      for (const t of tokensResult.data || []) {
        const existing = tokensBySession.get(t.session_id) || {};
        if (t.access_type === "general") existing.general = t.token;
        if (t.access_type === "protocol") existing.protocol = t.token;
        tokensBySession.set(t.session_id, existing);
      }

      const sessionLookup = new Map<
        string,
        { title: string; date: string; type: SessionType }
      >();

      const mappedSessions: AttendanceSession[] = (
        sessionsResult.data || []
      ).map((s) => {
        const tokens = tokensBySession.get(s.id);
        const generalToken = tokens?.general || s.qr_token;
        const protocolToken = tokens?.protocol;

        sessionLookup.set(s.id, {
          title: s.title,
          date: String(s.session_date),
          type: (s.session_type || "sunday_service") as SessionType,
        });

        return {
          id: s.id,
          eventName: s.title,
          sessionType: (s.session_type || "general_event") as SessionType,
          eventDate: String(s.session_date),
          openingTime: String(s.start_time).slice(0, 5),
          closingTime: String(s.end_time).slice(0, 5),
          protocolClosingTime: s.protocol_end_time
            ? String(s.protocol_end_time).slice(0, 5)
            : undefined,
          opensAt: s.opens_at,
          closesAt: s.closes_at,
          timezone: s.timezone || tz,
          description: s.notes || "",
          token: generalToken,
          protocolToken,
          status: computeSessionLiveStatus(
            s.status,
            String(s.session_date),
            String(s.start_time),
            String(s.end_time),
            s.timezone || tz,
            s.protocol_end_time
              ? String(s.protocol_end_time).slice(0, 5)
              : undefined,
          ),
          registrationCount: Number(s.registration_count ?? 0),
          expectedCapacity: Number(s.expected_capacity ?? 100),
          allowOtherDepartment: Boolean(s.allow_other_department),
          formSchema: s.form_schema || getFormTemplateForSessionType(s.session_type),
          formVersion: s.form_version ?? 1,
          geofenceLatitude: s.geofence_latitude,
          geofenceLongitude: s.geofence_longitude,
          geofenceRadiusM: s.geofence_radius_m,
          gpsAccuracyThresholdM: s.gps_accuracy_threshold_m,
          createdAt: s.created_at,
        };
      });
      setSessions(mappedSessions);

      const mappedRecords: AttendanceRecord[] = (
        recordsResult.data || []
      ).map((r) => {
        const sMeta = sessionLookup.get(r.session_id);
        return {
          id: r.id,
          sessionId: r.session_id,
          sessionName: sMeta?.title || "Service Session",
          sessionType: sMeta?.type,
          sessionDate:
            sMeta?.date ||
            (r.submitted_at ? String(r.submitted_at).slice(0, 10) : ""),
          fullName: r.full_name,
          departmentId: r.department_id || "other",
          departmentName: r.department_name_snapshot,
          isCustomDepartment: Boolean(r.custom_department || !r.department_id),
          customDepartment: r.custom_department || undefined,
          verificationMethod: r.verification_method || "legacy_unverified",
          registeredByName: r.registered_by_name,
          responses: r.responses || {},
          gpsDistanceM: r.gps_distance_m,
          gpsAccuracyM: r.gps_accuracy_m,
          registeredAt: r.submitted_at,
          registrationTime: formatIsoToTime12h(r.submitted_at, tz),
        };
      });
      setRecords(mappedRecords);

      if (teamResult.data) {
        setTeamMembers(
          teamResult.data.map((m) => ({
            id: m.id,
            organizationId: m.organization_id,
            fullName: m.full_name,
            email: m.email,
            phone: m.phone || "",
            role: m.role as AdminRole,
            isActive: m.is_active,
            createdAt: m.created_at,
          })),
        );
      }

      if (invitesResult.data) {
        setInvitations(
          invitesResult.data.map((inv) => ({
            id: inv.id,
            organizationId: inv.organization_id,
            email: inv.email,
            role: inv.role as InviteAdminRole,
            token: inv.token,
            expiresAt: inv.expires_at,
            acceptedAt: inv.accepted_at,
            createdAt: inv.created_at,
          })),
        );
      }

      if (transferLogsResult.data) {
        setOwnershipTransferLogs(
          transferLogsResult.data.map((log) => ({
            id: log.id,
            organizationId: log.organization_id,
            previousSuperAdminId: log.previous_super_admin_id,
            previousSuperAdminName: log.previous_super_admin_name,
            previousSuperAdminEmail: log.previous_super_admin_email,
            newSuperAdminId: log.new_super_admin_id,
            newSuperAdminName: log.new_super_admin_name,
            newSuperAdminEmail: log.new_super_admin_email,
            previousAdminNewRole: (log.previous_admin_new_role === "coordinator"
              ? "coordinator"
              : "admin") as InviteAdminRole,
            reason: log.reason || "",
            transferredAt: log.transferred_at,
          })),
        );
      }

      // Initial analytics load if staff
      if (isStaff) {
        void fetchAnalytics();
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Unable to load data from Supabase.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, fetchAnalytics]);

  useEffect(() => {
    void refreshData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED"
      ) {
        void refreshData();
      }
    });

    // Realtime subscriptions for live update of attendance records & sessions
    const recordsChannel = supabase
      .channel("public:attendance_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_records" },
        () => {
          void refreshData();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_sessions" },
        () => {
          void refreshData();
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(recordsChannel);
    };
  }, [supabase, refreshData]);

  // Periodically refresh dynamic session statuses based on clock time
  useEffect(() => {
    const timer = setInterval(() => {
      setSessions((prev) => {
        let changed = false;
        const next = prev.map((s) => {
          const liveStatus = computeSessionLiveStatus(
            s.status === "closed" ? "closed" : "active",
            s.eventDate,
            s.openingTime,
            s.closingTime,
            s.timezone || settings.timezone,
            s.protocolClosingTime,
          );
          if (liveStatus !== s.status) {
            changed = true;
            return { ...s, status: liveStatus };
          }
          return s;
        });
        return changed ? next : prev;
      });
    }, 10000);

    return () => clearInterval(timer);
  }, [settings.timezone]);

  const createSession = async (
    input: CreateSessionInput,
  ): Promise<AttendanceSession> => {
    setError(null);
    if (!adminProfile) {
      const msg =
        "You must be signed in as an administrator to create a session.";
      setError(msg);
      throw new Error(msg);
    }

    const sessionType = input.sessionType || "sunday_service";
    const formSchema =
      input.formSchema || getFormTemplateForSessionType(sessionType);
    const dbStatus = mapUiStatusToDb(input.status ?? "open");

    const { data, error: insertError } = await supabase
      .from("attendance_sessions")
      .insert({
        organization_id: adminProfile.organizationId,
        title: input.eventName.trim(),
        session_type: sessionType,
        session_date: input.eventDate,
        start_time: input.openingTime,
        end_time: input.closingTime,
        protocol_end_time: input.protocolClosingTime || null,
        status: dbStatus,
        location: settings.address || "Main Auditorium",
        notes: input.description?.trim() || "",
        allow_other_department: settings.allowOtherDepartment,
        expected_capacity: input.expectedCapacity ?? 250,
        form_schema: formSchema,
        geofence_latitude: input.geofenceLatitude ?? null,
        geofence_longitude: input.geofenceLongitude ?? null,
        geofence_radius_m: input.geofenceRadiusM ?? null,
        gps_accuracy_threshold_m: input.gpsAccuracyThresholdM ?? null,
        created_by: adminProfile.id,
      })
      .select("*")
      .single();

    if (insertError || !data) {
      const msg =
        insertError?.message || "Failed to create attendance session.";
      setError(msg);
      throw new Error(msg);
    }

    // Fetch tokens generated by database trigger
    const { data: tokens } = await supabase
      .from("session_access_tokens")
      .select("access_type, token")
      .eq("session_id", data.id)
      .is("revoked_at", null);

    const generalToken =
      tokens?.find((t) => t.access_type === "general")?.token || data.qr_token;
    const protocolToken = tokens?.find(
      (t) => t.access_type === "protocol",
    )?.token;

    const created: AttendanceSession = {
      id: data.id,
      eventName: data.title,
      sessionType: data.session_type as SessionType,
      eventDate: String(data.session_date),
      openingTime: String(data.start_time).slice(0, 5),
      closingTime: String(data.end_time).slice(0, 5),
      protocolClosingTime: data.protocol_end_time
        ? String(data.protocol_end_time).slice(0, 5)
        : undefined,
      opensAt: data.opens_at,
      closesAt: data.closes_at,
      timezone: data.timezone,
      description: data.notes || "",
      token: generalToken,
      protocolToken,
      status: computeSessionLiveStatus(
        data.status,
        String(data.session_date),
        String(data.start_time),
        String(data.end_time),
        data.timezone || settings.timezone,
        data.protocol_end_time
          ? String(data.protocol_end_time).slice(0, 5)
          : undefined,
      ),
      registrationCount: Number(data.registration_count ?? 0),
      expectedCapacity: Number(data.expected_capacity ?? 250),
      allowOtherDepartment: Boolean(data.allow_other_department),
      formSchema: data.form_schema || formSchema,
      formVersion: data.form_version ?? 1,
      geofenceLatitude: data.geofence_latitude,
      geofenceLongitude: data.geofence_longitude,
      geofenceRadiusM: data.geofence_radius_m,
      gpsAccuracyThresholdM: data.gps_accuracy_threshold_m,
      createdAt: data.created_at,
    };

    setSessions((prev) => [created, ...prev]);
    return created;
  };

  const updateSession = async (
    id: string,
    input: UpdateSessionInput,
  ): Promise<AttendanceSession> => {
    setError(null);
    const patch: Record<string, unknown> = {};

    if (input.eventName !== undefined) patch.title = input.eventName.trim();
    if (input.sessionType !== undefined) patch.session_type = input.sessionType;
    if (input.eventDate !== undefined) patch.session_date = input.eventDate;
    if (input.openingTime !== undefined) patch.start_time = input.openingTime;
    if (input.closingTime !== undefined) patch.end_time = input.closingTime;
    if (input.protocolClosingTime !== undefined)
      patch.protocol_end_time = input.protocolClosingTime ?? null;
    if (input.description !== undefined) patch.notes = input.description.trim();
    if (input.status !== undefined)
      patch.status = mapUiStatusToDb(input.status);
    if (input.expectedCapacity !== undefined)
      patch.expected_capacity = input.expectedCapacity;
    if (input.formSchema !== undefined) patch.form_schema = input.formSchema;
    if (input.geofenceLatitude !== undefined)
      patch.geofence_latitude = input.geofenceLatitude;
    if (input.geofenceLongitude !== undefined)
      patch.geofence_longitude = input.geofenceLongitude;
    if (input.geofenceRadiusM !== undefined)
      patch.geofence_radius_m = input.geofenceRadiusM;
    if (input.gpsAccuracyThresholdM !== undefined)
      patch.gps_accuracy_threshold_m = input.gpsAccuracyThresholdM;

    const { data, error: updateError } = await supabase
      .from("attendance_sessions")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError || !data) {
      const msg =
        updateError?.message || "Failed to update attendance session.";
      setError(msg);
      throw new Error(msg);
    }

    const updatedSession = sessions.find((s) => s.id === id);
    const resultSession: AttendanceSession = {
      id: data.id,
      eventName: data.title,
      sessionType: data.session_type as SessionType,
      eventDate: String(data.session_date),
      openingTime: String(data.start_time).slice(0, 5),
      closingTime: String(data.end_time).slice(0, 5),
      protocolClosingTime: data.protocol_end_time
        ? String(data.protocol_end_time).slice(0, 5)
        : undefined,
      opensAt: data.opens_at,
      closesAt: data.closes_at,
      timezone: data.timezone,
      description: data.notes || "",
      token: updatedSession?.token || data.qr_token,
      protocolToken: updatedSession?.protocolToken,
      status: computeSessionLiveStatus(
        data.status,
        String(data.session_date),
        String(data.start_time),
        String(data.end_time),
        data.timezone || settings.timezone,
        data.protocol_end_time
          ? String(data.protocol_end_time).slice(0, 5)
          : undefined,
      ),
      registrationCount: Number(data.registration_count ?? 0),
      expectedCapacity: Number(data.expected_capacity ?? 250),
      allowOtherDepartment: Boolean(data.allow_other_department),
      formSchema: data.form_schema,
      formVersion: data.form_version,
      geofenceLatitude: data.geofence_latitude,
      geofenceLongitude: data.geofence_longitude,
      geofenceRadiusM: data.geofence_radius_m,
      gpsAccuracyThresholdM: data.gps_accuracy_threshold_m,
      createdAt: data.created_at,
    };

    setSessions((prev) => prev.map((s) => (s.id === id ? resultSession : s)));
    return resultSession;
  };

  const updateSessionStatus = async (
    id: string,
    status: SessionStatus,
  ): Promise<void> => {
    setError(null);
    const dbStatus = mapUiStatusToDb(status);

    const { error: updateError } = await supabase
      .from("attendance_sessions")
      .update({ status: dbStatus })
      .eq("id", id);

    if (updateError) {
      const msg = `Failed to update session status: ${updateError.message}`;
      setError(msg);
      throw new Error(msg);
    }

    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s)),
    );
  };

  const deleteSession = async (id: string): Promise<void> => {
    setError(null);
    const { error: deleteError } = await supabase
      .from("attendance_sessions")
      .delete()
      .eq("id", id);

    if (deleteError) {
      const msg = `Failed to delete session: ${deleteError.message}`;
      setError(msg);
      throw new Error(msg);
    }

    setSessions((prev) => prev.filter((s) => s.id !== id));
    setRecords((prev) => prev.filter((r) => r.sessionId !== id));
  };

  const deleteRecord = async (id: string): Promise<void> => {
    setError(null);
    const { error: deleteError } = await supabase
      .from("attendance_records")
      .delete()
      .eq("id", id);

    if (deleteError) {
      const msg = `Failed to delete attendance record: ${deleteError.message}`;
      setError(msg);
      throw new Error(msg);
    }

    setRecords((prev) => {
      const matchingRec = prev.find((r) => r.id === id);
      if (matchingRec) {
        setSessions((sPrev) =>
          sPrev.map((s) =>
            s.id === matchingRec.sessionId
              ? {
                  ...s,
                  registrationCount: Math.max(0, s.registrationCount - 1),
                }
              : s,
          ),
        );
      }
      return prev.filter((r) => r.id !== id);
    });
  };

  const rotateToken = async (
    sessionId: string,
    accessType: "general" | "protocol",
    regenerate = true,
    reason = "",
  ): Promise<{ token: string }> => {
    setError(null);
    const { data, error: rpcError } = await supabase.rpc(
      "rotate_session_access_token",
      {
        p_session_id: sessionId,
        p_access_type: accessType,
        p_regenerate: regenerate,
        p_reason: reason,
      },
    );

    if (rpcError) {
      const msg = `Failed to regenerate QR token: ${rpcError.message}`;
      setError(msg);
      throw new Error(msg);
    }

    const payload = data as { token: string };

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        if (accessType === "general") {
          return { ...s, token: payload.token };
        } else {
          return { ...s, protocolToken: payload.token };
        }
      }),
    );

    return payload;
  };

  const getSessionByToken = useCallback(
    (token: string): AttendanceSession | undefined => {
      const normalized = decodeURIComponent(token).trim().toLowerCase();
      return sessions.find(
        (s) =>
          s.token.toLowerCase() === normalized ||
          s.protocolToken?.toLowerCase() === normalized,
      );
    },
    [sessions],
  );

  const submitGpsAttendance = async (
    input: SubmitGpsAttendanceInput,
  ): Promise<SubmitAttendanceResult> => {
    const { data, error: rpcError } = await supabase.rpc(
      "submit_gps_attendance",
      {
        p_token: input.token.trim(),
        p_full_name: input.fullName.trim(),
        p_department_id: input.departmentId,
        p_custom_department: input.customDepartment?.trim() || null,
        p_responses: input.responses || {},
        p_latitude: input.latitude,
        p_longitude: input.longitude,
        p_accuracy: input.accuracy,
      },
    );

    if (rpcError) {
      return {
        outcome: "invalid-qr",
        errorMessage: rpcError.message,
      };
    }

    const payload = data as SubmitAttendanceResult;
    return payload;
  };

  const submitProtocolAttendance = async (
    input: SubmitProtocolAttendanceInput,
  ): Promise<SubmitAttendanceResult> => {
    const { data, error: rpcError } = await supabase.rpc(
      "submit_protocol_attendance",
      {
        p_token: input.token.trim(),
        p_full_name: input.fullName.trim(),
        p_department_id: input.departmentId,
        p_custom_department: input.customDepartment?.trim() || null,
        p_responses: input.responses || {},
      },
    );

    if (rpcError) {
      return {
        outcome: "invalid-qr",
        errorMessage: rpcError.message,
      };
    }

    const payload = data as SubmitAttendanceResult;
    return payload;
  };

  const addDepartment = async (input: DepartmentInput): Promise<Department> => {
    setError(null);
    if (!adminProfile) {
      const msg =
        "You must be signed in as an administrator to create a department.";
      setError(msg);
      throw new Error(msg);
    }

    const normName = input.name.trim().replace(/\s+/g, " ").toLowerCase();
    const normCode = input.code.trim().toUpperCase();

    // Client-side duplicate check (case-insensitive & trimmed)
    const existingName = departments.find(
      (d) => d.name.trim().replace(/\s+/g, " ").toLowerCase() === normName,
    );
    if (existingName) {
      const msg = `A department named "${existingName.name}" already exists. Department names must be unique.`;
      setError(msg);
      throw new Error(msg);
    }

    const existingCode = departments.find(
      (d) => d.code.trim().toUpperCase() === normCode,
    );
    if (existingCode) {
      const msg = `A department with code "${existingCode.code}" already exists.`;
      setError(msg);
      throw new Error(msg);
    }

    const { data, error: insertError } = await supabase
      .from("departments")
      .insert({
        organization_id: adminProfile.organizationId,
        name: input.name.trim().replace(/\s+/g, " "),
        code: normCode,
        description: input.description.trim(),
        lead_name: input.leaderName.trim(),
        enabled: input.isEnabled ?? true,
        member_count: input.memberCount ?? 0,
      })
      .select("*")
      .single();

    if (insertError || !data) {
      let msg = insertError?.message || "Failed to create department.";
      if (insertError?.code === "23505") {
        if (
          insertError.message.includes("norm_name") ||
          insertError.details?.includes("norm_name")
        ) {
          msg = `A department with this name already exists (names must be unique regardless of capitalisation or spaces).`;
        } else if (
          insertError.message.includes("norm_code") ||
          insertError.details?.includes("norm_code")
        ) {
          msg = `A department with code "${normCode}" already exists.`;
        } else {
          msg = `A department with this name or code already exists.`;
        }
      }
      setError(msg);
      throw new Error(msg);
    }

    const created: Department = {
      id: data.id,
      name: data.name,
      code: data.code,
      description: data.description || "",
      leaderName: data.lead_name || "",
      isEnabled: Boolean(data.enabled),
      memberCount: Number(data.member_count ?? 0),
      createdAt: data.created_at ? String(data.created_at).slice(0, 10) : "",
    };

    setDepartments((prev) =>
      [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
    );
    return created;
  };

  const updateDepartment = async (
    id: string,
    input: Partial<DepartmentInput>,
  ): Promise<void> => {
    setError(null);

    if (input.name !== undefined) {
      const normName = input.name.trim().replace(/\s+/g, " ").toLowerCase();
      const existingName = departments.find(
        (d) =>
          d.id !== id &&
          d.name.trim().replace(/\s+/g, " ").toLowerCase() === normName,
      );
      if (existingName) {
        const msg = `A department named "${existingName.name}" already exists. Department names must be unique.`;
        setError(msg);
        throw new Error(msg);
      }
    }

    if (input.code !== undefined) {
      const normCode = input.code.trim().toUpperCase();
      const existingCode = departments.find(
        (d) => d.id !== id && d.code.trim().toUpperCase() === normCode,
      );
      if (existingCode) {
        const msg = `A department with code "${existingCode.code}" already exists.`;
        setError(msg);
        throw new Error(msg);
      }
    }

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined)
      patch.name = input.name.trim().replace(/\s+/g, " ");
    if (input.code !== undefined) patch.code = input.code.trim().toUpperCase();
    if (input.description !== undefined)
      patch.description = input.description.trim();
    if (input.leaderName !== undefined)
      patch.lead_name = input.leaderName.trim();
    if (input.isEnabled !== undefined) patch.enabled = input.isEnabled;
    if (input.memberCount !== undefined) patch.member_count = input.memberCount;

    const { error: updateError } = await supabase
      .from("departments")
      .update(patch)
      .eq("id", id);

    if (updateError) {
      let msg = `Failed to update department: ${updateError.message}`;
      if (updateError.code === "23505") {
        msg =
          "A department with this name or code already exists (names must be unique regardless of capitalisation or spaces).";
      }
      setError(msg);
      throw new Error(msg);
    }

    setDepartments((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              ...(input.name !== undefined
                ? { name: input.name.trim().replace(/\s+/g, " ") }
                : {}),
              ...(input.code !== undefined
                ? { code: input.code.trim().toUpperCase() }
                : {}),
              ...(input.description !== undefined
                ? { description: input.description.trim() }
                : {}),
              ...(input.leaderName !== undefined
                ? { leaderName: input.leaderName.trim() }
                : {}),
              ...(input.isEnabled !== undefined
                ? { isEnabled: input.isEnabled }
                : {}),
              ...(input.memberCount !== undefined
                ? { memberCount: input.memberCount }
                : {}),
            }
          : d,
      ),
    );
  };

  const deleteDepartment = async (id: string): Promise<void> => {
    setError(null);
    const { error: deleteError } = await supabase
      .from("departments")
      .delete()
      .eq("id", id);

    if (deleteError) {
      const msg = `Failed to delete department: ${deleteError.message}`;
      setError(msg);
      throw new Error(msg);
    }

    setDepartments((prev) => prev.filter((d) => d.id !== id));
  };

  const toggleDepartmentStatus = async (id: string): Promise<void> => {
    const target = departments.find((d) => d.id === id);
    if (!target) return;
    await updateDepartment(id, { isEnabled: !target.isEnabled });
  };

  const updateSettings = async (
    partial: Partial<ChurchSettings>,
  ): Promise<void> => {
    setError(null);
    const next = { ...settings, ...partial };
    setSettings(next);

    if (!adminProfile) return;

    const orgPatch: Record<string, unknown> = {};
    if (partial.churchName !== undefined)
      orgPatch.name = partial.churchName.trim();
    if (partial.branchName !== undefined)
      orgPatch.branch = partial.branchName.trim();
    if (partial.publicBaseUrl !== undefined)
      orgPatch.public_base_url = partial.publicBaseUrl.trim();
    if (partial.allowOtherDepartment !== undefined)
      orgPatch.allow_other_department_by_default = partial.allowOtherDepartment;
    if (partial.timezone !== undefined) orgPatch.timezone = partial.timezone;
    if (partial.geofenceLatitude !== undefined)
      orgPatch.geofence_latitude = partial.geofenceLatitude;
    if (partial.geofenceLongitude !== undefined)
      orgPatch.geofence_longitude = partial.geofenceLongitude;
    if (partial.geofenceRadiusM !== undefined)
      orgPatch.geofence_radius_m = partial.geofenceRadiusM;
    if (partial.gpsAccuracyThresholdM !== undefined)
      orgPatch.gps_accuracy_threshold_m = partial.gpsAccuracyThresholdM;

    if (Object.keys(orgPatch).length > 0) {
      const { error: orgErr } = await supabase
        .from("organizations")
        .update(orgPatch)
        .eq("id", adminProfile.organizationId);

      if (orgErr) {
        const msg = `Failed to update organization settings: ${orgErr.message}`;
        setError(msg);
        throw new Error(msg);
      }
    }

    const profilePatch: Record<string, unknown> = {};
    if (partial.adminName !== undefined)
      profilePatch.full_name = partial.adminName.trim();
    if (partial.adminPhone !== undefined)
      profilePatch.phone = partial.adminPhone.trim();

    if (Object.keys(profilePatch).length > 0) {
      const { error: profErr } = await supabase
        .from("admin_profiles")
        .update(profilePatch)
        .eq("id", adminProfile.id);

      if (profErr) {
        const msg = `Failed to update administrator profile: ${profErr.message}`;
        setError(msg);
        throw new Error(msg);
      }

      setAdminProfile((prev) =>
        prev
          ? {
              ...prev,
              fullName:
                partial.adminName !== undefined
                  ? partial.adminName.trim()
                  : prev.fullName,
              phone:
                partial.adminPhone !== undefined
                  ? partial.adminPhone.trim()
                  : prev.phone,
            }
          : null,
      );
    }
  };

  const inviteAdmin = async (
    email: string,
    role: InviteAdminRole,
  ): Promise<AdminInvitation> => {
    setError(null);
    if (!adminProfile) {
      const msg =
        "You must be signed in as an administrator to send invitations.";
      setError(msg);
      throw new Error(msg);
    }

    const { data, error: inviteErr } = await supabase
      .from("admin_invitations")
      .insert({
        organization_id: adminProfile.organizationId,
        email: email.trim().toLowerCase(),
        role,
        invited_by: adminProfile.id,
      })
      .select("*")
      .single();

    if (inviteErr || !data) {
      const msg =
        inviteErr?.message || "Failed to create administrator invitation.";
      setError(msg);
      throw new Error(msg);
    }

    const created: AdminInvitation = {
      id: data.id,
      organizationId: data.organization_id,
      email: data.email,
      role: data.role as InviteAdminRole,
      token: data.token,
      expiresAt: data.expires_at,
      acceptedAt: data.accepted_at,
      createdAt: data.created_at,
    };

    setInvitations((prev) => [created, ...prev]);
    return created;
  };

  const revokeInvitation = async (id: string): Promise<void> => {
    setError(null);
    const { error: delErr } = await supabase
      .from("admin_invitations")
      .delete()
      .eq("id", id);

    if (delErr) {
      const msg = `Failed to revoke invitation: ${delErr.message}`;
      setError(msg);
      throw new Error(msg);
    }

    setInvitations((prev) => prev.filter((i) => i.id !== id));
  };

  const transferSuperAdminOwnership = async (
    input: TransferSuperAdminInput,
  ): Promise<void> => {
    setError(null);
    const { data, error: rpcError } = await supabase.rpc(
      "transfer_super_admin_ownership",
      {
        p_target_admin_id: input.targetAdminId,
        p_previous_admin_new_role: input.previousAdminNewRole ?? "admin",
        p_confirmation: input.confirmation.trim(),
        p_reason: input.reason?.trim() || "",
      },
    );

    if (rpcError) {
      setError(rpcError.message);
      throw new Error(rpcError.message);
    }

    const payload = data as {
      status: string;
      transferLog?: OwnershipTransferLog;
    };

    if (payload.transferLog) {
      setOwnershipTransferLogs((prev) => [payload.transferLog!, ...prev]);
    }

    await refreshData();
  };

  const manageTeamMember = async (
    input: ManageTeamMemberInput,
  ): Promise<void> => {
    setError(null);
    const { error: rpcError } = await supabase.rpc("manage_team_member", {
      p_member_id: input.memberId,
      p_role: input.role ?? null,
      p_is_active: input.isActive ?? null,
    });

    if (rpcError) {
      setError(rpcError.message);
      throw new Error(rpcError.message);
    }

    await refreshData();
  };

  const signOut = async (): Promise<void> => {
    await supabase.auth.signOut();
    setAdminProfile(null);
    setTeamMembers([]);
    setInvitations([]);
    setOwnershipTransferLogs([]);
    setSessions([]);
    setRecords([]);
    setDepartments([]);
    setAnalytics(null);
  };

  return (
    <AttendanceContext.Provider
      value={{
        sessions,
        records,
        departments,
        settings,
        adminProfile,
        teamMembers,
        invitations,
        ownershipTransferLogs,
        analytics,
        isHydrated: !isLoading,
        isLoading,
        error,
        clearError,
        refreshData,
        fetchAnalytics,
        createSession,
        updateSession,
        updateSessionStatus,
        deleteSession,
        deleteRecord,
        rotateToken,
        getSessionByToken,
        submitGpsAttendance,
        submitProtocolAttendance,
        addDepartment,
        updateDepartment,
        deleteDepartment,
        toggleDepartmentStatus,
        updateSettings,
        inviteAdmin,
        revokeInvitation,
        transferSuperAdminOwnership,
        manageTeamMember,
        signOut,
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
}

export function useAttendance() {
  const ctx = useContext(AttendanceContext);
  if (!ctx) {
    throw new Error("useAttendance must be used within an AttendanceProvider");
  }
  return ctx;
}
