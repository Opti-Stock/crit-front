import type { AppointmentSummary } from "../../../types/operational.types";

export interface AttendanceViewContext {
  appointment: AppointmentSummary;
  attendanceRecordId?: string;
}
