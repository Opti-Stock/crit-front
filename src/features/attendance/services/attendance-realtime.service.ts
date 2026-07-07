import type {
  AppointmentSummary,
  AttendanceSummary,
} from "../../../types/operational.types";

export type AttendanceRealtimeStatus = "connected" | "unavailable" | "error";

export interface AttendanceRealtimeHandlers {
  onAppointmentChanged?: (appointment: AppointmentSummary) => void;
  onAttendanceChanged?: (attendance: AttendanceSummary) => void;
  onStatusChange?: (status: AttendanceRealtimeStatus, detail?: string) => void;
}

export interface AttendanceRealtimeSubscription {
  unsubscribe: () => void;
}

export const ATTENDANCE_REALTIME_CONTRACT =
  "Contrato pendiente: exponer SSE o WebSocket autenticado para eventos appointment_changed, attendance_changed y reception_checkin_registered con appointment, attendance y scope por usuario/area.";

export function subscribeToAttendanceRealtime(
  handlers: AttendanceRealtimeHandlers,
): AttendanceRealtimeSubscription {
  window.queueMicrotask(() => {
    handlers.onStatusChange?.("unavailable", ATTENDANCE_REALTIME_CONTRACT);
  });

  return {
    unsubscribe: () => undefined,
  };
}
