import type { NotificationSummary } from "../../../types/operational.types";

export type NotificationsRealtimeStatus = "connected" | "unavailable" | "error";

export interface NotificationCreatedEvent {
  notification: NotificationSummary;
  unreadCount?: number;
}

export interface NotificationReadEvent {
  notificationId: string;
  unreadCount?: number;
}

export interface NotificationsRealtimeHandlers {
  onNotificationCreated?: (event: NotificationCreatedEvent) => void;
  onNotificationRead?: (event: NotificationReadEvent) => void;
  onStatusChange?: (status: NotificationsRealtimeStatus, detail?: string) => void;
}

export interface NotificationsRealtimeSubscription {
  unsubscribe: () => void;
}

export const NOTIFICATIONS_REALTIME_CONTRACT =
  "Contrato pendiente: exponer SSE o WebSocket autenticado para eventos notification_created y notification_read con notification, notificationId y unreadCount por usuario.";

export function subscribeToNotificationsRealtime(
  handlers: NotificationsRealtimeHandlers,
): NotificationsRealtimeSubscription {
  window.queueMicrotask(() => {
    handlers.onStatusChange?.("unavailable", NOTIFICATIONS_REALTIME_CONTRACT);
  });

  return {
    unsubscribe: () => undefined,
  };
}
