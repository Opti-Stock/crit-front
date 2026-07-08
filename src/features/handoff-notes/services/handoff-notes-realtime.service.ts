import type { HandoffNoteSummary } from "../../../types/operational.types";
import { appConfig } from "../../../config/env";
import { sessionService } from "../../auth/services/session.service";
import { subscribeToSse } from "../../../services/realtime/sse-client";

export type HandoffRealtimeStatus = "connected" | "unavailable" | "error";

export interface HandoffNoteCreatedEvent {
  note: HandoffNoteSummary;
  unreadCount?: number;
}

export interface HandoffNoteReadEvent {
  handoffNoteId: string;
  patientId: string;
  unreadCount?: number;
}

export interface HandoffRealtimeHandlers {
  onNoteCreated?: (event: HandoffNoteCreatedEvent) => void;
  onNoteRead?: (event: HandoffNoteReadEvent) => void;
  onStatusChange?: (status: HandoffRealtimeStatus, detail?: string) => void;
}

export interface HandoffRealtimeSubscription {
  unsubscribe: () => void;
}

export const HANDOFF_REALTIME_CONTRACT =
  "Eventos en tiempo real no disponibles. Puedes refrescar la vista para ver cambios recientes.";

export function subscribeToHandoffNotesRealtime(
  handlers: HandoffRealtimeHandlers,
): HandoffRealtimeSubscription {
  const subscription = subscribeToSse({
    url: `${appConfig.mainApiUrl}/realtime/events`,
    accessToken: sessionService.getAccessToken(),
    onOpen: () => handlers.onStatusChange?.("connected"),
    onError: (message) => handlers.onStatusChange?.("error", message || HANDOFF_REALTIME_CONTRACT),
    onEvent: (eventName, envelope) => {
      if (eventName === "handoff_note_created") {
        handlers.onNoteCreated?.(envelope.data as HandoffNoteCreatedEvent);
      }
      if (eventName === "handoff_note_read") {
        handlers.onNoteRead?.(envelope.data as HandoffNoteReadEvent);
      }
    },
  });

  return {
    unsubscribe: () => subscription.unsubscribe(),
  };
}
