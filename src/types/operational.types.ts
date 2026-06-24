export interface EntityRef {
  id: string;
  fullName?: string;
  name?: string;
}

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "rescheduled";

export type AttendanceStatus =
  | "pending"
  | "present"
  | "absent"
  | "late"
  | "cancelled"
  | "rescheduled";

export const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = [
  "pending",
  "present",
  "absent",
  "late",
  "cancelled",
  "rescheduled",
] as const;

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

export type HandoffPriority = "low" | "medium" | "high" | "urgent";
export type HandoffStatus = "pending" | "read" | "archived";

export interface HandoffNoteSummary {
  id: string;
  patient: { id: string; fullName: string };
  appointmentId: string | null;
  createdBy: { id: string; fullName: string };
  title: string;
  content: string;
  priority: HandoffPriority;
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
  readAt: string | null;
  createdAt: string;
}
