import type { HandoffNoteSummary } from "../../../types/operational.types";

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
  "Contrato pendiente: exponer SSE o WebSocket autenticado para eventos handoff_note_created y handoff_note_read con note, patientId, handoffNoteId y unreadCount por usuario.";

export function subscribeToHandoffNotesRealtime(
  handlers: HandoffRealtimeHandlers,
): HandoffRealtimeSubscription {
  window.queueMicrotask(() => {
    handlers.onStatusChange?.("unavailable", HANDOFF_REALTIME_CONTRACT);
  });

  return {
    unsubscribe: () => undefined,
  };
}
