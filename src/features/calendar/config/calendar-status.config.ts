import type {
  AppointmentStatus,
  AttendanceStatus,
} from "../../../types/operational.types";

export type CalendarVisualState =
  | AppointmentStatus
  | AttendanceStatus;

export interface CalendarStatusConfig {
  label: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger" | "muted";
  shortLabel: string;
}

export const CALENDAR_STATUS_CONFIG: Record<
  CalendarVisualState,
  CalendarStatusConfig
> = {
  scheduled: {
    label: "Programada",
    shortLabel: "Prog.",
    tone: "info",
  },
  cancelled: {
    label: "Cancelada",
    shortLabel: "Canc.",
    tone: "danger",
  },
  rescheduled: {
    label: "Reprogramada",
    shortLabel: "Reprog.",
    tone: "warning",
  },
  present: {
    label: "Asistencia",
    shortLabel: "Asist.",
    tone: "success",
  },
  absent: {
    label: "Inasistencia",
    shortLabel: "Inasist.",
    tone: "danger",
  },
};

export function getCalendarStatusConfig(
  status: CalendarVisualState,
): CalendarStatusConfig {
  return CALENDAR_STATUS_CONFIG[status];
}
