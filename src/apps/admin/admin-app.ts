import { mountLoginPage } from "../../features/auth/pages/login-page";
import { authService } from "../../features/auth/services/auth.service";
import { getMainNavigationForRole } from "../../features/auth/services/role-navigation.service";
import { sessionService } from "../../features/auth/services/session.service";
import { superAdminSessionService } from "../../features/super-admin/services/super-admin-session.service";
import { canAccessAdminEntry } from "../../guards/role-guard";
import {
  bindSidebarCollapse,
  getSidebarCollapsedShellClass,
  getSidebarIconForKey,
  renderSidebarLogoutButton,
  renderSidebarNavItem,
  renderSidebarToggle,
} from "../../components/app-sidebar";
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
import { mountAppointmentTypesPage } from "./pages/appointment-types-page";

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
    const mainAppHref = resolveMainAppHref(session.role);

    root.innerHTML = `
      <main class="app-shell app-shell--admin${getSidebarCollapsedShellClass()}" aria-labelledby="admin-app-title" data-app-shell>
        <aside class="app-sidebar" aria-label="Admin navigation">
          ${renderAdminBrand(mainAppHref)}
          <nav class="app-nav">
            ${renderSidebarNavItem({
              active: true,
              icon: "admin",
              label: "Admin",
            })}
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

    bindAdminBackButton(root);
    bindSidebarCollapse(root);
    return;
  }

  const activeKey = resolveAdminNavigationKey();
  const activeItem = getAdminNavigationItem(activeKey);
  const mainAppHref = resolveMainAppHref(session.role);

  root.innerHTML = `
    <main class="app-shell app-shell--admin${getSidebarCollapsedShellClass()}" aria-labelledby="admin-app-title" data-app-shell>
      <aside class="app-sidebar" aria-label="Admin navigation">
        ${renderAdminBrand(mainAppHref)}
        <nav class="app-nav">
          ${ADMIN_NAVIGATION_ITEMS.map((item) => {
            return renderSidebarNavItem({
              active: item.key === activeKey,
              dataAdminNavKey: item.key,
              href: `#${item.key}`,
              icon: getSidebarIconForKey(item.key),
              label: item.label,
            });
          }).join("")}
        </nav>
        <div class="app-session-actions">
          <span class="app-session-actions__label">${escapeHtml(session.user?.email ?? session.user?.fullName ?? formatRoleLabel(session.role))}</span>
          ${renderSidebarLogoutButton("admin-logout-button")}
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

  bindAdminBackButton(root);
  bindSidebarCollapse(root);

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

    case "appointment-types":
      await mountAppointmentTypesPage(root);
      return;

    case "users":
    default:
      await mountUsersPage(root);
  }
}

function renderAdminBrand(href: string): string {
  return `
    <div class="app-sidebar__header app-sidebar__header--admin">
      <div class="admin-sidebar-brand">
        <button
        type="button"
        class="admin-back-circle-button"
        aria-label="Volver a la aplicación"
        title="Volver a la aplicación"
        data-admin-main-app-href="${escapeHtml(href)}"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
            <path d="M15 18 9 12l6-6" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <span class="admin-sidebar-title app-brand__text">CRIT Assistance</span>
      </div>
      ${renderSidebarToggle()}
    </div>
  `;
}

function bindAdminBackButton(root: HTMLElement): void {
  root
    .querySelector<HTMLButtonElement>("[data-admin-main-app-href]")
    ?.addEventListener("click", (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const href = button.dataset.adminMainAppHref ?? "/";
      window.location.assign(href);
    });
}

function resolveMainAppHref(role: UserRole): string {
  const [mainEntry] = getMainNavigationForRole(role);
  return mainEntry ? `/#${mainEntry.key}` : "/";
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
