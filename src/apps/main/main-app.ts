import { appConfig } from "../../config/env";
import { mountAttendancePage } from "../../features/attendance/pages/attendance-page";
import { mountLoginPage } from "../../features/auth/pages/login-page";
import { sessionService } from "../../features/auth/services/session.service";
import {
  getAdminEntryForRole,
  getMainNavigationForRole,
} from "../../features/auth/services/role-navigation.service";
import { mountMedicalNotesPage } from "../../features/medical-notes/pages/medical-notes-page";
import { isAuthenticated } from "../../guards/auth-guard";
import type { UserRole } from "../../types/role.types";
import { mountDashboardPage } from "./pages/dashboard-page";

export function mountMainApp(root: HTMLElement): void {
  if (!isAuthenticated()) {
    mountLoginPage(root, {
      onSubmit: async ({ email, password, role }) => {
        if (appConfig.authBypassEnabled) {
          sessionService.setSession({
            accessToken: buildMockAccessToken(email, password),
            role,
          });

          mountMainApp(root);
          return;
        }

        console.info("Login skeleton submit", {
          email,
          role,
          hasPassword: Boolean(password),
        });
      },
    });

    return;
  }

  const session = sessionService.getSession();

  if (!session) {
    mountLoginPage(root);
    return;
  }

  const mainNavigation = getMainNavigationForRole(session.role);
  const adminEntry = getAdminEntryForRole(session.role);
  const activeKey = resolveActiveNavigationKey(
    mainNavigation.map((item) => item.key),
  );

  root.innerHTML = `
    <main class="app-shell app-shell--main" aria-labelledby="main-app-title">
      <aside class="app-sidebar" aria-label="Main navigation">
        <p class="app-brand">CRIT Assistance</p>
        <nav class="app-nav">
          ${mainNavigation
            .map((item) => {
              const activeClass =
                item.key === activeKey ? " app-nav__item--active" : "";
              return `<a class="app-nav__item${activeClass}" href="#${item.key}" data-nav-key="${item.key}">${item.label}</a>`;
            })
            .join("")}

          ${
            adminEntry
              ? `<a class="app-nav__item app-nav__item--admin-entry" href="/admin.html">${adminEntry.label}</a>`
              : ""
          }
        </nav>
      </aside>
      <section class="app-content">
        <header class="app-header">
          <div>
            <p class="app-eyebrow">Main app</p>
            <h1 id="main-app-title">Operational workspace</h1>
          </div>
          <span class="app-status">${formatRoleLabel(session.role)}</span>
        </header>
        <section id="main-view" aria-live="polite"></section>
        ${
          appConfig.authBypassEnabled
            ? `<button id="logout-button" class="secondary-action" type="button">Clear mock session</button>`
            : ""
        }
      </section>
    </main>
  `;

  const viewRoot = root.querySelector<HTMLElement>("#main-view");
  if (viewRoot) {
    mountMainView(viewRoot, activeKey, session.role);
  }

  root.querySelectorAll<HTMLAnchorElement>("[data-nav-key]").forEach((link) => {
    link.addEventListener("click", () => {
      window.setTimeout(() => mountMainApp(root), 0);
    });
  });

  if (appConfig.authBypassEnabled) {
    const logoutButton = root.querySelector<HTMLButtonElement>("#logout-button");

    logoutButton?.addEventListener("click", () => {
      sessionService.clearSession();
      mountMainApp(root);
    });
  }
}

function buildMockAccessToken(email: string, password: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  const passwordMarker = password ? "with-password" : "without-password";

  return `mock-token:${normalizedEmail}:${passwordMarker}`;
}

function resolveActiveNavigationKey(allowedKeys: string[]): string {
  const hashKey = window.location.hash.replace("#", "");

  if (allowedKeys.includes(hashKey)) {
    return hashKey;
  }

  return allowedKeys[0] ?? "dashboard";
}

function mountMainView(root: HTMLElement, key: string, role: UserRole): void {
  switch (key) {
    case "attendance":
      mountAttendancePage(root, role);
      return;
    case "medical-notes":
      mountMedicalNotesPage(root, role);
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
      return "Personal de acompanamiento";
    case "paciente_familia":
      return "Paciente/familia";
    default:
      return role;
  }
}
