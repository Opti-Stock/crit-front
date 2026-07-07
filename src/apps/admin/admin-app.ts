import { mountLoginPage } from "../../features/auth/pages/login-page";
import { authService } from "../../features/auth/services/auth.service";
import { sessionService } from "../../features/auth/services/session.service";
import { superAdminSessionService } from "../../features/super-admin/services/super-admin-session.service";
import { canAccessAdminEntry } from "../../guards/role-guard";
import type { UserRole } from "../../types/role.types";
import { escapeHtml } from "../../utils/dom";
import {
  ADMIN_NAVIGATION_ITEMS,
  getAdminNavigationItem,
  resolveAdminNavigationKey,
} from "./routes/admin-navigation";
import { mountClinicsPage } from "./pages/clinics-page";
import { mountRoomsPage } from "./pages/rooms-page";
import { mountRolesPage } from "./pages/roles-page";
import { mountUsersPage } from "./pages/users-page";

export function mountAdminApp(root: HTMLElement): void {
  const session = sessionService.getSession();

  if (!session) {
    mountLoginPage(root, {
      onSubmit: async (values) => {
        try {
          superAdminSessionService.clearSession();
          sessionService.setSession(await authService.login(values));
          mountAdminApp(root);
        } catch {
          mountLoginPage(root, {
            errorMessage: "Invalid credentials.",
            onSubmit: async (retryValues) => {
              superAdminSessionService.clearSession();
              sessionService.setSession(await authService.login(retryValues));
              mountAdminApp(root);
            },
          });
        }
      },
    });
    return;
  }

  if (!canAccessAdminEntry(session.role)) {
    root.innerHTML = `
      <main class="app-shell app-shell--admin" aria-labelledby="admin-app-title">
        <aside class="app-sidebar" aria-label="Admin navigation">
          <p class="app-brand">CRIT Admin</p>
          <nav class="app-nav">
            <span class="app-nav__item app-nav__item--active">Admin</span>
          </nav>
        </aside>
        <section class="app-content">
          <header class="app-header">
            <div>
              <p class="app-eyebrow">Admin app</p>
              <h1 id="admin-app-title">Restricted area</h1>
            </div>
            <span class="app-status">No access</span>
          </header>
          <section class="app-panel" aria-label="Access status">
            <h2>Admin access required</h2>
            <p>
              This area is only available for users with admin or dirección access.
            </p>
          </section>
        </section>
      </main>
    `;

    return;
  }

  const activeKey = resolveAdminNavigationKey();
  const activeItem = getAdminNavigationItem(activeKey);

  root.innerHTML = `
    <main class="app-shell app-shell--admin" aria-labelledby="admin-app-title">
      <aside class="app-sidebar" aria-label="Admin navigation">
        <p class="app-brand">CRIT Admin</p>
        <nav class="app-nav">
          ${ADMIN_NAVIGATION_ITEMS.map((item) => {
            const activeClass =
              item.key === activeKey ? " app-nav__item--active" : "";

            return `<a class="app-nav__item${activeClass}" href="#${item.key}" data-admin-nav-key="${item.key}">${item.label}</a>`;
          }).join("")}
        </nav>
        <div class="app-session-actions">
          <span class="app-session-actions__label">${escapeHtml(session.user?.email ?? session.user?.fullName ?? formatRoleLabel(session.role))}</span>
          <button id="admin-logout-button" class="app-logout-button" type="button">Cerrar sesion</button>
        </div>
      </aside>

      <section class="app-content">
        <header class="app-header">
          <div>
            <p class="app-eyebrow">Admin app</p>
            <h1 id="admin-app-title">${activeItem.label}</h1>
          </div>
          <span class="app-status">${formatRoleLabel(session.role)}</span>
        </header>

        <section id="admin-view" aria-live="polite"></section>
      </section>
    </main>
  `;

  const viewRoot = root.querySelector<HTMLElement>("#admin-view");
  if (viewRoot) {
    void mountAdminView(viewRoot, activeKey);
  }

  root.querySelectorAll<HTMLAnchorElement>("[data-admin-nav-key]").forEach((link) => {
    link.addEventListener("click", () => {
      window.setTimeout(() => mountAdminApp(root), 0);
    });
  });

  root.querySelector<HTMLButtonElement>("#admin-logout-button")?.addEventListener("click", () => {
    sessionService.clearSession();
    window.location.assign("/");
  });
}

  async function mountAdminView(
    root: HTMLElement,
    key: string,
  ): Promise<void> {
    switch (key) {
      case "roles":
        await mountRolesPage(root);
        return;

      case "clinics":
        await mountClinicsPage(root);
        return;

      case "rooms":
        await mountRoomsPage(root);
        return;

      case "users":
      default:
        await mountUsersPage(root);
    }
  }

function formatRoleLabel(role: UserRole): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "direccion":
      return "Direccion";
    default:
      return role;
  }
}
