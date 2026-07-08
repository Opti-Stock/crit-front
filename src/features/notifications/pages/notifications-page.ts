import {
  listNotifications,
  markNotificationAsRead,
  markNotificationAsUnread,
} from "../../../services/main-api/notifications";
import type {
  NotificationStatusFilter,
  NotificationSummary,
} from "../../../types/operational.types";
import type { UserRole } from "../../../types/role.types";
import { canAccessNotifications } from "../../../guards/role-guard";
import { escapeHtml, formatDateTime } from "../../../utils/dom";
import {
  NOTIFICATIONS_REALTIME_CONTRACT,
  subscribeToNotificationsRealtime,
  type NotificationsRealtimeStatus,
} from "../services/notifications-realtime.service";

interface NotificationsState {
  filter: NotificationStatusFilter | "";
  items: NotificationSummary[];
  message: string | null;
  isLoading: boolean;
  realtimeStatus: NotificationsRealtimeStatus;
  realtimeMessage: string | null;
}

let realtimeUnsubscribe: (() => void) | null = null;

export function mountNotificationsPage(root: HTMLElement, role: UserRole): void {
  if (realtimeUnsubscribe) {
    realtimeUnsubscribe();
    realtimeUnsubscribe = null;
  }

  const state: NotificationsState = {
    filter: "",
    items: [],
    message: null,
    isLoading: true,
    realtimeStatus: "unavailable",
    realtimeMessage: null,
  };

  if (!canAccessNotifications(role)) {
    render(root, state, role);
    return;
  }

  render(root, state, role);
  realtimeUnsubscribe = subscribeToNotificationsRealtime({
    onNotificationCreated: (event) => {
      state.items = upsertNotification(state.items, event.notification);
      notifyUnreadCountChanged();
      render(root, state, role);
    },
    onNotificationRead: (event) => {
      state.items = markNotificationLocallyRead(state.items, event.notificationId);
      notifyUnreadCountChanged();
      render(root, state, role);
    },
    onStatusChange: (status, detail) => {
      state.realtimeStatus = status;
      state.realtimeMessage = detail ?? null;
      render(root, state, role);
    },
  }).unsubscribe;

  void load(root, state, role);
}

async function load(
  root: HTMLElement,
  state: NotificationsState,
  role: UserRole,
): Promise<void> {
  try {
    const result = await listNotifications({
      pageSize: 50,
      status: state.filter || undefined,
    });
    state.items = result.data;
    state.message = null;
    notifyUnreadCountChanged();
  } catch (error) {
    state.message =
      error instanceof Error ? error.message : "No se pudieron cargar notificaciones.";
  } finally {
    state.isLoading = false;
    render(root, state, role);
  }
}

function render(root: HTMLElement, state: NotificationsState, role: UserRole): void {
  if (!canAccessNotifications(role)) {
    root.innerHTML = `
      <section class="feature-page notifications-page">
        <header class="feature-header">
          <div><p class="app-eyebrow">Notificaciones</p><h2>Bandeja interna</h2></div>
        </header>
        <p class="empty-state">No tienes permisos para visualizar notificaciones.</p>
      </section>
    `;
    return;
  }

  root.innerHTML = `
    <section class="feature-page notifications-page">
      <header class="feature-header notifications-header">
        <div>
          <p class="app-eyebrow">Notificaciones</p>
          <h2>Bandeja interna</h2>
        </div>
        <div class="notifications-header__actions">
          ${renderRealtimeStatus(state)}
          <select data-notification-filter aria-label="Filtrar notificaciones">
            <option value="" ${state.filter === "" ? "selected" : ""}>Todas</option>
            <option value="unread" ${state.filter === "unread" ? "selected" : ""}>No leidas</option>
            <option value="read" ${state.filter === "read" ? "selected" : ""}>Leidas</option>
          </select>
        </div>
      </header>
      ${state.message ? `<p class="inline-alert">${escapeHtml(state.message)}</p>` : ""}
      ${state.isLoading ? `<p class="empty-state">Cargando notificaciones...</p>` : renderItems(state.items)}
    </section>
  `;
  bindEvents(root, state, role);
}

function renderRealtimeStatus(state: NotificationsState): string {
  const label =
    state.realtimeStatus === "connected"
      ? "Tiempo real activo"
      : state.realtimeStatus === "error"
        ? "Tiempo real con error"
        : "Tiempo real pendiente";

  return `
    <span class="status-pill notifications-realtime" title="${escapeHtml(state.realtimeMessage ?? NOTIFICATIONS_REALTIME_CONTRACT)}">
      ${escapeHtml(label)}
    </span>
  `;
}

function renderItems(items: NotificationSummary[]): string {
  if (items.length === 0) return `<p class="empty-state">No hay notificaciones.</p>`;

  return `
    <div class="notifications-list">
      ${items.map(renderNotificationCard).join("")}
    </div>
  `;
}

function renderNotificationCard(item: NotificationSummary): string {
  const canOpenHandoff = item.type === "handoff_note_received";
  const patient = getNotificationPatientLabel(item);

  return `
    <article class="data-card notification-card${item.readAt ? "" : " notification-card--unread"}" data-notification-id="${escapeHtml(item.id)}">
      <div class="data-card__header">
        <div>
          <p class="data-card__meta">${escapeHtml(formatDateTime(item.createdAt))} - ${escapeHtml(formatNotificationType(item.type))}</p>
          <h3>${escapeHtml(item.title)}</h3>
        </div>
        <span class="status-pill">${item.readAt ? "Leida" : "No leida"}</span>
      </div>
      <dl class="notification-card__summary">
        <div><dt>Paciente</dt><dd>${escapeHtml(patient)}</dd></div>
        <div><dt>Evento</dt><dd>${escapeHtml(formatNotificationType(item.type))}</dd></div>
        <div><dt>Fecha y hora</dt><dd>${escapeHtml(formatDateTime(item.createdAt))}</dd></div>
      </dl>
      <p>${escapeHtml(item.message)}</p>
      <div class="button-row">
        ${
          canOpenHandoff
            ? `<button type="button" data-notification-open-handoff>Abrir conversacion</button>`
            : `<button type="button" disabled>Sin conversacion vinculada</button>`
        }
        ${
          item.readAt
            ? `<button class="notification-action notification-action--unread" type="button" data-notification-unread><span aria-hidden="true">●</span><span>Marcar como no leída</span></button>`
            : `<button class="notification-action notification-action--read" type="button" data-notification-read><span aria-hidden="true">✓</span><span>Marcar como leída</span></button>`
        }
      </div>
    </article>
  `;
}

function bindEvents(
  root: HTMLElement,
  state: NotificationsState,
  role: UserRole,
): void {
  root.querySelector<HTMLSelectElement>("[data-notification-filter]")?.addEventListener(
    "change",
    (event) => {
      const select = event.currentTarget as HTMLSelectElement;
      state.filter = select.value as NotificationsState["filter"];
      state.isLoading = true;
      render(root, state, role);
      void load(root, state, role);
    },
  );

  root.querySelectorAll<HTMLButtonElement>("[data-notification-read]").forEach(
    (button) =>
      button.addEventListener("click", () => void setRead(root, state, role, button, true)),
  );
  root.querySelectorAll<HTMLButtonElement>("[data-notification-unread]").forEach(
    (button) =>
      button.addEventListener("click", () => void setRead(root, state, role, button, false)),
  );
  root.querySelectorAll<HTMLButtonElement>("[data-notification-open-handoff]").forEach(
    (button) =>
      button.addEventListener(
        "click",
        () => void openHandoffNotification(root, state, role, button),
      ),
  );
}

async function setRead(
  root: HTMLElement,
  state: NotificationsState,
  role: UserRole,
  button: HTMLButtonElement,
  read: boolean,
): Promise<void> {
  const id = button.closest<HTMLElement>("[data-notification-id]")?.dataset.notificationId;
  if (!id) return;

  try {
    if (read) await markNotificationAsRead(id);
    else await markNotificationAsUnread(id);
    await load(root, state, role);
  } catch (error) {
    state.message =
      error instanceof Error ? error.message : "No se pudo actualizar la notificacion.";
    render(root, state, role);
  }
}

async function openHandoffNotification(
  root: HTMLElement,
  state: NotificationsState,
  role: UserRole,
  button: HTMLButtonElement,
): Promise<void> {
  const id = button.closest<HTMLElement>("[data-notification-id]")?.dataset.notificationId;
  if (!id) return;

  const notification = state.items.find((item) => item.id === id);
  if (!notification) return;

  try {
    if (!notification.readAt) {
      await markNotificationAsRead(id);
      state.items = markNotificationLocallyRead(state.items, id);
      notifyUnreadCountChanged();
    }

    const hash = buildHandoffHash(notification);

    if (window.location.hash === hash) {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } else {
      window.location.hash = hash;
    }
  } catch (error) {
    state.message =
      error instanceof Error ? error.message : "No se pudo abrir la nota de enlace.";
    render(root, state, role);
  }
}

function buildHandoffHash(notification: NotificationSummary): string {
  const target = getHandoffTarget(notification);
  const params = new URLSearchParams();

  if (target.patientId) params.set("patientId", target.patientId);
  if (target.noteId) params.set("noteId", target.noteId);

  const query = params.toString();
  return query ? `#handoff-notes?${query}` : "#handoff-notes";
}

function getHandoffTarget(notification: NotificationSummary): {
  patientId: string;
  noteId: string;
} {
  const metadata = notification.metadata;
  const metadataPatient = readObject(metadata?.patient);
  const metadataNote = readObject(metadata?.handoffNote);

  return {
    patientId:
      notification.target?.patientId ??
      readString(metadata, "patientId") ??
      readString(metadataPatient, "id") ??
      "",
    noteId:
      notification.target?.handoffNoteId ??
      notification.target?.noteId ??
      notification.target?.entityId ??
      readString(metadata, "handoffNoteId") ??
      readString(metadata, "noteId") ??
      readString(metadataNote, "id") ??
      "",
  };
}

function getNotificationPatientLabel(notification: NotificationSummary): string {
  const metadata = notification.metadata;
  const metadataPatient = readObject(metadata?.patient);
  return (
    readString(metadataPatient, "fullName") ??
    readString(metadataPatient, "name") ??
    "Paciente no disponible"
  );
}

function formatNotificationType(type: string): string {
  switch (type) {
    case "handoff_note_received":
      return "Nota de enlace";
    case "appointment_reminder":
      return "Recordatorio de cita";
    case "pending_note":
      return "Nota pendiente";
    case "unregistered_attendance":
      return "Asistencia sin registrar";
    case "appointment_change":
      return "Cambio de cita";
    case "administrative_alert":
      return "Aviso administrativo";
    default:
      return type;
  }
}

function upsertNotification(
  items: readonly NotificationSummary[],
  incoming: NotificationSummary,
): NotificationSummary[] {
  const existingIndex = items.findIndex((item) => item.id === incoming.id);
  const next =
    existingIndex === -1
      ? [incoming, ...items]
      : items.map((item) => (item.id === incoming.id ? incoming : item));
  return sortNotifications(next);
}

function markNotificationLocallyRead(
  items: readonly NotificationSummary[],
  notificationId: string,
): NotificationSummary[] {
  return items.map((item) =>
    item.id === notificationId
      ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
      : item,
  );
}

function sortNotifications(
  items: readonly NotificationSummary[],
): NotificationSummary[] {
  return [...items].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

function notifyUnreadCountChanged(): void {
  window.dispatchEvent(new CustomEvent("notifications:unread-count-changed"));
}

function readObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function readString(
  source: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = source?.[key];
  return typeof value === "string" ? value : null;
}
