import { mainApiClient } from "./client";
import type { PaginationMeta } from "../../types/api";
import type {
  NotificationStatusFilter,
  NotificationSummary,
} from "../../types/operational.types";

export function listNotifications(query: {
  page?: number;
  pageSize?: number;
  status?: NotificationStatusFilter;
} = {}) {
  return mainApiClient.requestWithMeta<NotificationSummary[], PaginationMeta>(
    "/notifications",
    { query },
  );
}

export function markNotificationAsRead(notificationId: string) {
  return mainApiClient.request<NotificationSummary>(
    `/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "PATCH" },
  );
}

export function markNotificationAsUnread(notificationId: string) {
  return mainApiClient.request<NotificationSummary>(
    `/notifications/${encodeURIComponent(notificationId)}/unread`,
    { method: "PATCH" },
  );
}
