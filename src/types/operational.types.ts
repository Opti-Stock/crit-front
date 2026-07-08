export interface EntityRef {
  id: string;
  fullName?: string;
  name?: string;
  folio?: string;
}

export type AppointmentStatus =
  | "scheduled"
  | "cancelled"
  | "rescheduled";

export type AttendanceStatus =
  | "present"
  | "absent"
  | "rescheduled";

export const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = [
  "present",
  "absent",
  "rescheduled",
] as const;

export type CheckInStatus = "checked_in" | "not_checked_in";

export interface AppointmentSummary {
  id: string;
  patient: { id: string; fullName: string };
  collaborator: { id: string; fullName: string };
  clinic: { id: string; name: string };
  room: { id: string; name: string };
  appointmentType: { id: string; name: string };
  startsAt: string;
  endsAt: string;
  preSessionMinutes: number;
  postSessionMinutes: number;
  status: AppointmentStatus;
  attendanceStatus: AttendanceStatus | "pending" | null;
  checkInStatus: CheckInStatus;
  isCheckedIn: boolean;
}

export interface AttendanceSummary {
  id: string;
  appointmentId: string;
  patient: { id: string; fullName: string };
  collaborator: { id: string; fullName: string };
  status: AttendanceStatus;
  checkedAt: string | null;
  checkedBy: { id: string; fullName: string } | null;
  notesRequired: boolean;
}

export interface AppointmentTypeSummary {
  id: string;
  name: string;
  defaultDurationMinutes: number;
  defaultPreSessionMinutes: number;
  defaultPostSessionMinutes: number;
}

export interface CatalogItem {
  id: string;
  fullName?: string;
  name?: string;
  folio?: string;
  roles?: string[];
  clinic?: { id: string; name: string };
  clinicId?: string;
}

export interface MedicalNoteSummary {
  id: string;
  appointmentId: string;
  attendanceRecordId: string | null;
  patient: { id: string; fullName: string };
  collaborator: { id: string; fullName: string };
  content: Record<string, unknown>;
  formatVersion: string;
  createdAt: string;
  updatedAt: string;
}

export type HandoffStatus = "pending" | "read" | "archived";
export type HandoffCategory =
  | "delay"
  | "cancellation"
  | "absence"
  | "reschedule"
  | "general_notice";

export interface HandoffNoteSummary {
  id: string;
  patient: { id: string; fullName: string };
  appointmentId: string | null;
  createdBy: {
    id: string;
    fullName: string;
    role?: string;
    area?: string;
  };
  title: string;
  content: string;
  category?: HandoffCategory;
  area?: string;
  status: HandoffStatus;
  recipients: { userId: string; fullName: string; readAt: string | null }[];
  createdAt: string;
}

export type NotificationStatusFilter = "unread" | "read";

export type NotificationType =
  | "appointment_reminder"
  | "pending_note"
  | "unregistered_attendance"
  | "appointment_change"
  | "handoff_note_received"
  | "administrative_alert";

export interface NotificationSummary {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  target?: {
    type?: string;
    patientId?: string;
    handoffNoteId?: string;
    noteId?: string;
    entityId?: string;
  };
  metadata?: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}
