import type {
  AppointmentSummary,
  AttendanceSummary,
} from "../../../types/operational.types";
import type { CalendarVisualState } from "../config/calendar-status.config";
import { toDateKey } from "./calendar-date.ts";

export interface CalendarAppointment {
  appointment: AppointmentSummary;
  attendance: AttendanceSummary | null;
  dateKey: string;
  visualState: CalendarVisualState;
}

export function toCalendarAppointments(
  appointments: readonly AppointmentSummary[],
  attendanceRecords: readonly AttendanceSummary[],
): CalendarAppointment[] {
  const attendanceByAppointment = new Map(
    attendanceRecords.map((record) => [record.appointmentId, record]),
  );

  return appointments
    .filter(isRenderableAppointment)
    .map((appointment) => {
      const attendance = attendanceByAppointment.get(appointment.id) ?? null;
      return {
        appointment,
        attendance,
        dateKey: toDateKey(new Date(appointment.startsAt)),
        visualState: deriveVisualState(appointment, attendance),
      };
    });
}

function isRenderableAppointment(appointment: AppointmentSummary): boolean {
  const startsAt = new Date(appointment.startsAt);
  const endsAt = new Date(appointment.endsAt);
  const startsAtMs = startsAt.getTime();
  const endsAtMs = endsAt.getTime();

  return (
    Boolean(appointment.patient?.fullName?.trim()) &&
    Number.isFinite(startsAtMs) &&
    Number.isFinite(endsAtMs) &&
    endsAtMs > startsAtMs
  );
}

function deriveVisualState(
  appointment: AppointmentSummary,
  attendance: AttendanceSummary | null,
): CalendarVisualState {
  if (attendance?.status) {
    return attendance.status;
  }

  if (appointment.attendanceStatus && appointment.attendanceStatus !== "pending") {
    return appointment.attendanceStatus;
  }

  if (appointment.status === "cancelled" || appointment.status === "rescheduled") {
    return appointment.status;
  }

  return "scheduled";
}
