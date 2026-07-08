import type { NotificationSummary } from "../../../types/operational.types";
import { appConfig } from "../../../config/env";
import { sessionService } from "../../auth/services/session.service";
import { subscribeToSse } from "../../../services/realtime/sse-client";

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
  "Eventos en tiempo real no disponibles. La lista se actualiza al abrir el modulo.";

export function subscribeToNotificationsRealtime(
  handlers: NotificationsRealtimeHandlers,
): NotificationsRealtimeSubscription {
  const subscription = subscribeToSse({
    url: `${appConfig.mainApiUrl}/realtime/events`,
    accessToken: sessionService.getAccessToken(),
    onOpen: () => handlers.onStatusChange?.("connected"),
    onError: (message) => handlers.onStatusChange?.("error", message || NOTIFICATIONS_REALTIME_CONTRACT),
    onEvent: (eventName, envelope) => {
      if (eventName === "notification_created") {
        handlers.onNotificationCreated?.(envelope.data as NotificationCreatedEvent);
      }
      if (eventName === "notification_read") {
        handlers.onNotificationRead?.(envelope.data as NotificationReadEvent);
      }
    },
  });

  return {
    unsubscribe: () => subscription.unsubscribe(),
  };
}
