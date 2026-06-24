import {
  listNotifications,
  markNotificationAsRead,
  markNotificationAsUnread,
} from "../../../services/main-api/notifications";
import type {
  NotificationStatusFilter,
  NotificationSummary,
} from "../../../types/operational.types";
import { escapeHtml, formatDateTime } from "../../../utils/dom";

interface NotificationsState {
  filter: NotificationStatusFilter | "";
  items: NotificationSummary[];
  message: string | null;
  isLoading: boolean;
}

export function mountNotificationsPage(root: HTMLElement): void {
  const state: NotificationsState = {
    filter: "",
    items: [],
    message: null,
    isLoading: true,
  };
  render(root, state);
  void load(root, state);
}

async function load(root: HTMLElement, state: NotificationsState): Promise<void> {
  try {
    const result = await listNotifications({
      pageSize: 50,
      status: state.filter || undefined,
    });
    state.items = result.data;
    state.message = null;
  } catch (error) {
    state.message =
      error instanceof Error ? error.message : "No se pudieron cargar notificaciones.";
  } finally {
    state.isLoading = false;
    render(root, state);
  }
}

function render(root: HTMLElement, state: NotificationsState): void {
  root.innerHTML = `
    <section class="feature-page">
      <header class="feature-header">
        <div><p class="app-eyebrow">Notificaciones</p><h2>Bandeja interna</h2></div>
        <select data-notification-filter>
          <option value="" ${state.filter === "" ? "selected" : ""}>Todas</option>
          <option value="unread" ${state.filter === "unread" ? "selected" : ""}>No leidas</option>
          <option value="read" ${state.filter === "read" ? "selected" : ""}>Leidas</option>
        </select>
      </header>
      ${state.message ? `<p class="inline-alert">${escapeHtml(state.message)}</p>` : ""}
      ${state.isLoading ? `<p class="empty-state">Cargando notificaciones...</p>` : renderItems(state.items)}
    </section>
  `;
  bindEvents(root, state);
}

function renderItems(items: NotificationSummary[]): string {
  if (items.length === 0) return `<p class="empty-state">No hay notificaciones.</p>`;
  return `<div class="data-list">${items.map((item) => `
    <article class="data-card" data-notification-id="${escapeHtml(item.id)}">
      <div class="data-card__header">
        <div><p class="data-card__meta">${formatDateTime(item.createdAt)} - ${escapeHtml(item.type)}</p><h3>${escapeHtml(item.title)}</h3></div>
        <span class="status-pill">${item.readAt ? "Leida" : "No leida"}</span>
      </div>
      <p>${escapeHtml(item.message)}</p>
      <div class="button-row">
        <button type="button" data-notification-read>Marcar leida</button>
        <button type="button" data-notification-unread>Marcar no leida</button>
      </div>
    </article>
  `).join("")}</div>`;
}

function bindEvents(root: HTMLElement, state: NotificationsState): void {
  root.querySelector<HTMLSelectElement>("[data-notification-filter]")?.addEventListener(
    "change",
    (event) => {
      const select = event.currentTarget as HTMLSelectElement;
      state.filter = select.value as NotificationsState["filter"];
      state.isLoading = true;
      render(root, state);
      void load(root, state);
    },
  );

  root.querySelectorAll<HTMLButtonElement>("[data-notification-read]").forEach(
    (button) => button.addEventListener("click", () => void setRead(root, state, button, true)),
  );
  root.querySelectorAll<HTMLButtonElement>("[data-notification-unread]").forEach(
    (button) => button.addEventListener("click", () => void setRead(root, state, button, false)),
  );
}

async function setRead(
  root: HTMLElement,
  state: NotificationsState,
  button: HTMLButtonElement,
  read: boolean,
): Promise<void> {
  const id = button.closest<HTMLElement>("[data-notification-id]")?.dataset.notificationId;
  if (!id) return;
  try {
    if (read) await markNotificationAsRead(id);
    else await markNotificationAsUnread(id);
    await load(root, state);
  } catch (error) {
    state.message =
      error instanceof Error ? error.message : "No se pudo actualizar la notificacion.";
    render(root, state);
  }
}
