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
import { mountSchedulingSettingsPage } from "../../features/scheduling/pages/scheduling-settings-page";
import { subscribeToNotificationsRealtime } from "../../features/notifications/services/notifications-realtime.service";
import { isAuthenticated } from "../../guards/auth-guard";
import {
  canAccessHandoffNotes,
  canAccessNotifications,
  isApRole,
} from "../../guards/role-guard";
import {
  bindSidebarCollapse,
  getSidebarCollapsedShellClass,
  getSidebarIconForKey,
  renderSidebarBrand,
  renderSidebarLogoutButton,
  renderSidebarNavItem,
} from "../../components/app-sidebar";
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
  const internalMainNavigation = mainNavigation.filter(
    (item) => item.key !== "badge-scan",
  );
  const adminEntry = getAdminEntryForRole(session.role);
  const isApWorkspace = isApRole(session.role);

  if (internalMainNavigation.length === 0) {
    if (mainNavigation.some((item) => item.key === "badge-scan")) {
      window.location.assign("/checkin.html?mode=reception-checkin");
      return;
    }

    renderNoWorkspaceAccess(root, session.role);
    return;
  }

  const activeKey = resolveActiveNavigationKey(
    internalMainNavigation.map((item) => item.key),
  );

  root.innerHTML = `
    <main class="app-shell app-shell--main${isApWorkspace ? " app-shell--ap" : ""}${activeKey === "calendar" ? " app-shell--calendar" : ""}${getSidebarCollapsedShellClass()}" aria-labelledby="main-app-title" data-app-shell>
      <aside class="app-sidebar" aria-label="${isApWorkspace ? "Navegacion AP" : "Main navigation"}">
        ${renderSidebarBrand(isApWorkspace ? "CRIT Assist AP" : "CRIT Assistance")}
        <nav class="app-nav">
          ${mainNavigation
            .map((item) => {
              const activeClass =
                item.key === activeKey;
              if (item.key === "badge-scan") {
                return renderSidebarNavItem({
                  href: "/checkin.html?mode=reception-checkin",
                  icon: getSidebarIconForKey(item.key),
                  label: item.label,
                });
              }
              const badge =
                item.key === "handoff-notes"
                  ? `<span class="app-nav__badge" data-handoff-nav-badge hidden></span>`
                  : item.key === "notifications"
                  ? `<span class="app-nav__badge" data-notifications-nav-badge hidden></span>`
                  : "";
              return renderSidebarNavItem({
                active: activeClass,
                badgeHtml: badge,
                dataNavKey: item.key,
                href: `#${item.key}`,
                icon: getSidebarIconForKey(item.key),
                label: item.label,
              });
            })
            .join("")}

          ${
            adminEntry
              ? renderSidebarNavItem({
                  extraClass: "app-nav__item--admin-entry",
                  href: "/admin.html",
                  icon: "admin",
                  label: adminEntry.label,
                })
              : ""
          }
        </nav>
        <div class="app-session-actions">
          <span class="app-session-actions__eyebrow">Usuario autenticado</span>
          <span class="app-session-actions__label">${escapeHtml(session.user?.email ?? session.user?.fullName ?? formatRoleLabel(session.role))}</span>
          ${renderSidebarLogoutButton("main-logout-button")}
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
  bindSidebarCollapse(root);

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
    void logoutFromMainApp(root, { clearHash: true });
  });
}

function renderNoWorkspaceAccess(root: HTMLElement, role: UserRole): void {
  root.innerHTML = `
    <main class="auth-page" aria-labelledby="main-app-title">
      <section class="auth-panel">
        <p class="app-eyebrow">Main app</p>
        <h1 id="main-app-title">Sin workspace operativo</h1>
        <p class="auth-form__hint">
          El rol ${escapeHtml(formatRoleLabel(role))} no tiene vistas operativas habilitadas en este MVP.
        </p>
        ${renderSidebarLogoutButton("main-logout-button")}
      </section>
    </main>
  `;

  root.querySelector<HTMLButtonElement>("#main-logout-button")?.addEventListener("click", () => {
    void logoutFromMainApp(root);
  });
}

async function logoutFromMainApp(root: HTMLElement, options: { clearHash?: boolean } = {}): Promise<void> {
    try {
      await authService.logout();
    } catch {
      // Local profile is cleared even if the server is temporarily unavailable.
    }
    sessionService.clearSession();
    if (options.clearHash) {
      window.location.hash = "";
    }
    mountMainApp(root);
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
    case "scheduling":
      void mountSchedulingSettingsPage(root, role);
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
    case "recepcion_general":
      return "Recepcion general";
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
