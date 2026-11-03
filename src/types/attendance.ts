export type SessionStatus = "open" | "scheduled" | "closed";

export type AdminRole = "super_admin" | "admin" | "coordinator";

export type InviteAdminRole = "admin" | "coordinator";

export type SessionType =
  | "sunday_service"
  | "workers_meeting"
  | "conference"
  | "general_event"
  | "custom";

export type FormFieldType =
  | "full_name"
  | "department"
  | "short_text"
  | "email"
  | "phone"
  | "number"
  | "select"
  | "radio"
  | "checkbox"
  | "yes_no";

export interface FormFieldDefinition {
  id: string;
  type: FormFieldType;
  label: string;
  helpText?: string;
  required?: boolean;
  options?: string[]; // for select, radio, checkbox
}

export interface FormSchema {
  fields: FormFieldDefinition[];
}

export interface AdminProfile {
  id: string;
  organizationId: string;
  fullName: string;
  email: string;
  phone: string;
  role: AdminRole;
  isActive: boolean;
  createdAt: string;
}

export interface AdminInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: InviteAdminRole;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export interface OwnershipTransferLog {
  id: string;
  organizationId: string;
  previousSuperAdminId: string | null;
  previousSuperAdminName: string;
  previousSuperAdminEmail: string;
  newSuperAdminId: string | null;
  newSuperAdminName: string;
  newSuperAdminEmail: string;
  previousAdminNewRole: InviteAdminRole;
  reason: string;
  transferredAt: string;
}

export interface SessionAccessToken {
  id: string;
  sessionId: string;
  accessType: "general" | "protocol";
  token: string;
  createdAt: string;
  revokedAt: string | null;
  revokeReason?: string;
}

export interface AttendanceSession {
  id: string;
  eventName: string;
  sessionType: SessionType;
  eventDate: string; // YYYY-MM-DD
  openingTime: string; // HH:mm (24h)
  closingTime: string; // HH:mm (24h)
  opensAt: string; // ISO timestamptz
  closesAt: string; // ISO timestamptz
  timezone: string;
  description?: string;
  token: string; // general QR token
  protocolToken?: string; // protocol QR token
  status: SessionStatus;
  registrationCount: number;
  expectedCapacity?: number;
  allowOtherDepartment?: boolean;
  formSchema: FormSchema;
  formVersion: number;
  geofenceLatitude?: number | null;
  geofenceLongitude?: number | null;
  geofenceRadiusM?: number | null;
  gpsAccuracyThresholdM?: number | null;
  createdAt: string;
}

export type VerificationMethod =
  | "gps_verified"
  | "protocol_verified"
  | "admin_manual"
  | "legacy_unverified";

export interface AttendanceRecordResponseItem {
  label: string;
  type: FormFieldType;
  value: string | number | string[] | boolean | null;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  sessionName: string;
  sessionType?: SessionType;
  sessionDate: string; // YYYY-MM-DD
  fullName: string;
  departmentId: string;
  departmentName: string;
  isCustomDepartment?: boolean;
  verificationMethod: VerificationMethod;
  registeredByName?: string | null;
  responses?: Record<string, AttendanceRecordResponseItem>;
  gpsDistanceM?: number | null;
  gpsAccuracyM?: number | null;
  registeredAt: string; // ISO string
  registrationTime: string; // e.g. "08:14 AM"
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  leaderName: string;
  isEnabled: boolean;
  memberCount: number;
  createdAt: string;
}

export interface ChurchSettings {
  organizationId?: string;
  churchName: string;
  branchName: string;
  tagline: string;
  address: string;
  timezone: string;
  publicBaseUrl: string;
  geofenceLatitude: number | null;
  geofenceLongitude: number | null;
  geofenceRadiusM: number;
  gpsAccuracyThresholdM: number;
  preventDuplicateSubmissions: boolean;
  allowOtherDepartment: boolean;
  autoCloseAfterEndTime: boolean;
  adminName: string;
  adminEmail: string;
  adminRole: string;
  adminPhone: string;
}

export type PublicRegistrationState =
  | "form"
  | "loading"
  | "success"
  | "duplicate"
  | "not-open"
  | "closed"
  | "invalid-qr"
  | "location-required"
  | "outside-geofence"
  | "poor-accuracy";

export interface AttendanceAnalytics {
  generatedAt: string;
  timezone: string;
  today: string;
  filters: {
    from: string | null;
    to: string | null;
    sessionType: string | null;
  };
  overview: {
    totalRegistrations: number;
    uniquePeople: number;
    sundayRegistrations: number;
    sundayUniquePeople: number;
    otherRegistrations: number;
    otherUniquePeople: number;
    sessionsCount: number;
    sundayCount: number;
    averageSunday: number;
    latestSunday?: { date: string; registrations: number };
    previousSunday?: { date: string; registrations: number };
    changePct?: number;
  };
  sundayWeekly: {
    date: string;
    registrations: number;
    uniquePeople: number;
    services: number;
  }[];
  monthly: {
    month: string;
    sunday: number;
    other: number;
    total: number;
    uniquePeople: number;
  }[];
  weekly: {
    weekStart: string;
    registrations: number;
    uniquePeople: number;
  }[];
  daily: {
    date: string;
    registrations: number;
    uniquePeople: number;
    sessions: number;
  }[];
  byDepartment: {
    department: string;
    registrations: number;
    uniquePeople: number;
  }[];
  bySessionType: {
    sessionType: SessionType;
    sessions: number;
    registrations: number;
    uniquePeople: number;
  }[];
  byVerificationMethod: {
    method: VerificationMethod;
    registrations: number;
  }[];
  sessions: {
    id: string;
    title: string;
    sessionType: SessionType;
    date: string;
    registrations: number;
  }[];
}
