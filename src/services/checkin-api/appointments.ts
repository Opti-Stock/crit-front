import type { ApiQueryValue } from "../../types/api";
import type {
  AppointmentStatus,
  AttendanceStatus,
  CheckInStatus,
} from "../../types/operational.types";
import { checkinApiClient } from "./client";

export interface CheckinAppointmentSummary {
  id: string;
  patient: { id: string; fullName: string };
  collaborator: { id: string; fullName: string };
  clinic: { id: string; name: string };
  room: { id: string; name: string };
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  attendanceStatus: AttendanceStatus | "pending" | null;
  checkInStatus: CheckInStatus;
  isCheckedIn: boolean;
  checkedInAt: string | null;
  attendance: {
    id: string;
    status: AttendanceStatus | "pending";
    checkedAt: string | null;
  } | null;
}

export interface ScanCheckinResult {
  patient: { id: string; fullName: string; externalId: string | null };
  checkedIn: boolean;
  alreadyCheckedIn: boolean;
  appointments: CheckinAppointmentSummary[];
}

export interface ListCheckinAppointmentsQuery {
  date?: string;
  clinicId?: string;
  search?: string;
  status?: AppointmentStatus;
  checkInStatus?: CheckInStatus;
}

export function listCheckinAppointments(query: ListCheckinAppointmentsQuery = {}) {
  return checkinApiClient.request<CheckinAppointmentSummary[]>("/appointments", {
    query: query as Record<string, ApiQueryValue>,
  });
}

export function getCheckinAppointment(appointmentId: string) {
  return checkinApiClient.request<CheckinAppointmentSummary>(
    `/appointments/${encodeURIComponent(appointmentId)}`,
  );
}

export function checkInAppointment(appointmentId: string) {
  return checkinApiClient.request<CheckinAppointmentSummary>(
    `/appointments/${encodeURIComponent(appointmentId)}/check-in`,
    { method: "POST", body: {} },
  );
}

export function scanBadgeCheckIn(input: { code: string; date?: string }) {
  return checkinApiClient.request<ScanCheckinResult>("/scan", {
    method: "POST",
    body: input,
  });
}
