import type {
  AppointmentSummary,
  AttendanceSummary,
} from "../../../types/operational.types";
import type { CalendarVisualState } from "../config/calendar-status.config";
import { toDateKey } from "./calendar-date";

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

  return appointments.map((appointment) => {
    const attendance = attendanceByAppointment.get(appointment.id) ?? null;
    return {
      appointment,
      attendance,
      dateKey: toDateKey(new Date(appointment.startsAt)),
      visualState: deriveVisualState(appointment, attendance),
    };
  });
}

function deriveVisualState(
  appointment: AppointmentSummary,
  attendance: AttendanceSummary | null,
): CalendarVisualState {
  if (attendance?.status) {
    return attendance.status;
  }

  if (appointment.status === "cancelled" || appointment.status === "rescheduled") {
    return appointment.status;
  }

  return "scheduled";
}
