import { appConfig } from "../../config/env";
import { mountAttendancePage } from "../../features/attendance/pages/attendance-page";
import { mountLoginPage } from "../../features/auth/pages/login-page";
import { sessionService } from "../../features/auth/services/session.service";
import {
  getAdminEntryForRole,
  getMainNavigationForRole,
} from "../../features/auth/services/role-navigation.service";
import { mountCalendarPage } from "../../features/calendar/pages/calendar-page";
import { mountHandoffNotesPage } from "../../features/handoff-notes/pages/handoff-notes-page";
import { subscribeToHandoffNotesRealtime } from "../../features/handoff-notes/services/handoff-notes-realtime.service";
import { mountMedicalNotesPage } from "../../features/medical-notes/pages/medical-notes-page";
import { mountNotificationsPage } from "../../features/notifications/pages/notifications-page";
import { subscribeToNotificationsRealtime } from "../../features/notifications/services/notifications-realtime.service";
import { isAuthenticated } from "../../guards/auth-guard";
import {
  canAccessHandoffNotes,
  canAccessNotifications,
  isApRole,
} from "../../guards/role-guard";
import { listHandoffNotes } from "../../services/main-api/handoff-notes";
import { listNotifications } from "../../services/main-api/notifications";
import type { UserRole } from "../../types/role.types";
import { escapeHtml } from "../../utils/dom";
import { mountDashboardPage } from "./pages/dashboard-page";

import { authService } from "../../features/auth/services/auth.service";
import { superAdminSessionService } from "../../features/super-admin/services/super-admin-session.service";

let hashNavigationHandler: (() => void) | null = null;
let hashNavigationRoot: HTMLElement | null = null;
let handoffNavRealtimeUnsubscribe: (() => void) | null = null;
let handoffBadgeRefreshHandler: (() => void) | null = null;
let notificationsNavRealtimeUnsubscribe: (() => void) | null = null;
let notificationsBadgeRefreshHandler: (() => void) | null = null;

export function mountMainApp(root: HTMLElement): void {
  bindHashNavigation(root);

  if (!isAuthenticated()) {
    void renderLogin(root);
    return;
  }

  const session = sessionService.getSession();

  if (!session) {
    mountLoginPage(root);
    return;
  }

  const mainNavigation = getMainNavigationForRole(session.role);
  const adminEntry = getAdminEntryForRole(session.role);
  const isApWorkspace = isApRole(session.role);
  const activeKey = resolveActiveNavigationKey(
    mainNavigation.map((item) => item.key),
  );

  root.innerHTML = `
    <main class="app-shell app-shell--main${isApWorkspace ? " app-shell--ap" : ""} ${activeKey === "calendar" ? "app-shell--calendar" : ""}" aria-labelledby="main-app-title">
      <aside class="app-sidebar" aria-label="${isApWorkspace ? "Navegacion AP" : "Main navigation"}">
        <p class="app-brand">${isApWorkspace ? "CRIT Assist AP" : "CRIT Assistance"}</p>
        <nav class="app-nav">
          ${mainNavigation
            .map((item) => {
              const activeClass =
                item.key === activeKey ? " app-nav__item--active" : "";
              if (item.key === "badge-scan") {
                return `<a class="app-nav__item" href="/checkin.html?mode=reception-checkin"><span>${item.label}</span></a>`;
              }
              const badge =
                item.key === "handoff-notes"
                  ? `<span class="app-nav__badge" data-handoff-nav-badge hidden></span>`
                  : item.key === "notifications"
                    ? `<span class="app-nav__badge" data-notifications-nav-badge hidden></span>`
                  : "";
              return `<a class="app-nav__item${activeClass}" href="#${item.key}" data-nav-key="${item.key}"><span>${item.label}</span>${badge}</a>`;
            })
            .join("")}

          ${
            adminEntry
              ? `<a class="app-nav__item app-nav__item--admin-entry" href="/admin.html">${adminEntry.label}</a>`
              : ""
          }
        </nav>
        <div class="app-session-actions">
          <span class="app-session-actions__eyebrow">Usuario autenticado</span>
          <span class="app-session-actions__label">${escapeHtml(session.user?.email ?? session.user?.fullName ?? formatRoleLabel(session.role))}</span>
          <button id="main-logout-button" class="app-logout-button" type="button">Cerrar sesion</button>
        </div>
      </aside>
      <section class="app-content ${activeKey === "calendar" ? "app-content--calendar" : ""}">
        <header class="app-header">
          <div>
            <p class="app-eyebrow">${isApWorkspace ? "Personal AP" : "Main app"}</p>
            <h1 id="main-app-title">${isApWorkspace ? "Acompanamiento operativo" : "Operational workspace"}</h1>
          </div>
          <span class="app-status">${formatRoleLabel(session.role)}</span>
        </header>
        <section id="main-view" aria-live="polite"></section>
      </section>
    </main>
  `;

  const viewRoot = root.querySelector<HTMLElement>("#main-view");
  if (viewRoot) {
    mountMainView(viewRoot, activeKey, session.role);
  }

  bindHandoffNavBadge(root, session.role);
  bindNotificationsNavBadge(root, session.role);

  root.querySelectorAll<HTMLAnchorElement>("[data-nav-key]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetKey = link.dataset.navKey;

      if (targetKey && targetKey === getHashRouteKey()) {
        event.preventDefault();
        mountMainApp(root);
      }
    });
  });

  root.querySelector<HTMLButtonElement>("#main-logout-button")?.addEventListener("click", () => {
    sessionService.clearSession();
    window.location.hash = "";
    mountMainApp(root);
  });
}

function bindHashNavigation(root: HTMLElement): void {
  if (hashNavigationRoot === root && hashNavigationHandler) {
    return;
  }

  if (hashNavigationHandler) {
    window.removeEventListener("hashchange", hashNavigationHandler);
  }

  hashNavigationRoot = root;
  hashNavigationHandler = () => mountMainApp(root);
  window.addEventListener("hashchange", hashNavigationHandler);
}

function buildMockAccessToken(email: string, password: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  const passwordMarker = password ? "with-password" : "without-password";

  return `mock-token:${normalizedEmail}:${passwordMarker}`;
}

function resolveActiveNavigationKey(allowedKeys: string[]): string {
  const hashKey = getHashRouteKey();

  if (allowedKeys.includes(hashKey)) {
    return hashKey;
  }

  return allowedKeys[0] ?? "dashboard";
}

function getHashRouteKey(): string {
  return window.location.hash.replace("#", "").split("?")[0] ?? "";
}

function bindHandoffNavBadge(root: HTMLElement, role: UserRole): void {
  if (handoffNavRealtimeUnsubscribe) {
    handoffNavRealtimeUnsubscribe();
    handoffNavRealtimeUnsubscribe = null;
  }

  if (handoffBadgeRefreshHandler) {
    window.removeEventListener(
      "handoff-notes:unread-count-changed",
      handoffBadgeRefreshHandler,
    );
    handoffBadgeRefreshHandler = null;
  }

  if (!canAccessHandoffNotes(role)) {
    return;
  }

  void refreshHandoffNavBadge(root, role);

  handoffBadgeRefreshHandler = () => {
    void refreshHandoffNavBadge(root, role);
  };
  window.addEventListener(
    "handoff-notes:unread-count-changed",
    handoffBadgeRefreshHandler,
  );

  handoffNavRealtimeUnsubscribe = subscribeToHandoffNotesRealtime({
    onNoteCreated: (event) => {
      void refreshHandoffNavBadge(root, role, event.unreadCount);
    },
    onNoteRead: (event) => {
      void refreshHandoffNavBadge(root, role, event.unreadCount);
    },
  }).unsubscribe;
}

function bindNotificationsNavBadge(root: HTMLElement, role: UserRole): void {
  if (notificationsNavRealtimeUnsubscribe) {
    notificationsNavRealtimeUnsubscribe();
    notificationsNavRealtimeUnsubscribe = null;
  }

  if (notificationsBadgeRefreshHandler) {
    window.removeEventListener(
      "notifications:unread-count-changed",
      notificationsBadgeRefreshHandler,
    );
    notificationsBadgeRefreshHandler = null;
  }

  if (!canAccessNotifications(role)) {
    return;
  }

  const badge = root.querySelector<HTMLElement>("[data-notifications-nav-badge]");
  if (!badge) {
    return;
  }

  void refreshNotificationsNavBadge(root);

  notificationsBadgeRefreshHandler = () => {
    void refreshNotificationsNavBadge(root);
  };
  window.addEventListener(
    "notifications:unread-count-changed",
    notificationsBadgeRefreshHandler,
  );

  notificationsNavRealtimeUnsubscribe = subscribeToNotificationsRealtime({
    onNotificationCreated: (event) => {
      void refreshNotificationsNavBadge(root, event.unreadCount);
    },
    onNotificationRead: (event) => {
      void refreshNotificationsNavBadge(root, event.unreadCount);
    },
  }).unsubscribe;
}

async function refreshNotificationsNavBadge(
  root: HTMLElement,
  realtimeCount?: number,
): Promise<void> {
  const badge = root.querySelector<HTMLElement>("[data-notifications-nav-badge]");
  if (!badge) return;

  try {
    const result =
      realtimeCount === undefined
        ? await listNotifications({ pageSize: 50, status: "unread" })
        : null;
    const unreadCount =
      realtimeCount ?? result?.meta?.total ?? result?.data.length ?? 0;

    badge.hidden = unreadCount <= 0;
    badge.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
    badge.setAttribute(
      "aria-label",
      `${unreadCount} notificaciones no leidas`,
    );
  } catch {
    badge.hidden = true;
    badge.textContent = "";
  }
}

async function refreshHandoffNavBadge(
  root: HTMLElement,
  role: UserRole,
  realtimeCount?: number,
): Promise<void> {
  if (!canAccessHandoffNotes(role)) return;

  const badge = root.querySelector<HTMLElement>("[data-handoff-nav-badge]");
  if (!badge) return;

  try {
    const result =
      realtimeCount === undefined
        ? await listHandoffNotes({ pageSize: 100, status: "pending" })
        : null;
    const unreadCount =
      realtimeCount ?? result?.meta?.total ?? result?.data.length ?? 0;

    badge.hidden = unreadCount <= 0;
    badge.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
    badge.setAttribute(
      "aria-label",
      `${unreadCount} notas de enlace no leidas`,
    );
  } catch {
    badge.hidden = true;
    badge.textContent = "";
  }
}

function mountMainView(root: HTMLElement, key: string, role: UserRole): void {
  switch (key) {
    case "attendance":
      mountAttendancePage(root, role);
      return;
    case "calendar":
      mountCalendarPage(root, role);
      return;
    case "medical-notes":
      mountMedicalNotesPage(root, role);
      return;
    case "handoff-notes":
      mountHandoffNotesPage(root, role);
      return;
    case "notifications":
      mountNotificationsPage(root, role);
      return;
    default:
      mountDashboardPage(root, role);
  }
}

function formatRoleLabel(role: string): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "direccion":
      return "Direccion";
    case "recepcion":
      return "Recepcion";
    case "coordinador":
      return "Coordinador";
    case "medico":
      return "Medico";
    case "terapeuta":
      return "Terapeuta";
    case "personal_acompanamiento":
      return "Personal AP";
    case "paciente_familia":
      return "Paciente/familia";
    default:
      return role;
  }
}

async function renderLogin(root: HTMLElement): Promise<void> {
  mountLoginPage(root, {
    showRoleSelector: appConfig.authBypassEnabled,

    onSubmit: async (values) => {
      if (appConfig.authBypassEnabled) {
        superAdminSessionService.clearSession();
        sessionService.setSession({
          accessToken: buildMockAccessToken(
            values.email,
            values.password,
          ),
          role: values.role,
        });

        mountMainApp(root);
        return;
      }

      try {
        const session = await authService.login(values);

        superAdminSessionService.clearSession();
        sessionService.setSession(session);

        mountMainApp(root);
      } catch (error) {
        console.error(error);

        mountLoginPage(root, {
          showRoleSelector: false,
          errorMessage: "Invalid credentials.",
          onSubmit: async (retryValues) => {
            const session = await authService.login(retryValues);

            superAdminSessionService.clearSession();
            sessionService.setSession(session);

            mountMainApp(root);
          },
        });
      }
    },
  });
}
