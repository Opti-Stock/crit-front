import type {
  AppointmentSummary,
  AttendanceSummary,
} from "../../../types/operational.types";
import { appConfig } from "../../../config/env";
import { sessionService } from "../../auth/services/session.service";
import { subscribeToSse } from "../../../services/realtime/sse-client";

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
  "Eventos en tiempo real no disponibles. Puedes refrescar la vista para ver cambios recientes.";

export function subscribeToAttendanceRealtime(
  handlers: AttendanceRealtimeHandlers,
): AttendanceRealtimeSubscription {
  const subscription = subscribeToSse({
    url: `${appConfig.mainApiUrl}/realtime/events`,
    accessToken: sessionService.getAccessToken(),
    onOpen: () => handlers.onStatusChange?.("connected"),
    onError: (message) => handlers.onStatusChange?.("error", message || ATTENDANCE_REALTIME_CONTRACT),
    onEvent: (eventName, envelope) => {
      if (eventName === "appointment_changed") {
        handlers.onAppointmentChanged?.(envelope.data as AppointmentSummary);
      }
      if (eventName === "attendance_changed") {
        handlers.onAttendanceChanged?.(envelope.data as AttendanceSummary);
      }
    },
  });

  return {
    unsubscribe: () => subscription.unsubscribe(),
  };
}
