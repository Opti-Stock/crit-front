import { appConfig } from "../../config/env";
import { mountLoginPage } from "../../features/auth/pages/login-page";
import { sessionService } from "../../features/auth/services/session.service";
import {
  getAdminEntryForRole,
  getMainNavigationForRole,
} from "../../features/auth/services/role-navigation.service";
import { isAuthenticated } from "../../guards/auth-guard";

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

  root.innerHTML = `
    <main class="app-shell app-shell--main" aria-labelledby="main-app-title">
      <aside class="app-sidebar" aria-label="Main navigation">
        <p class="app-brand">CRIT Assistance</p>
        <nav class="app-nav">
          ${mainNavigation
            .map((item, index) => {
              const activeClass = index === 0 ? " app-nav__item--active" : "";
              return `<span class="app-nav__item${activeClass}">${item.label}</span>`;
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
        <section class="app-panel" aria-label="Current status">
          <h2>Frontend foundation ready</h2>
          <p>
            This shell is the starting point for the CRIT Assistance operational app.
          </p>
          <p>
            Current role: <strong>${formatRoleLabel(session.role)}</strong>
          </p>
          ${
            appConfig.authBypassEnabled
              ? `
                <p>
                  Auth bypass is enabled for local development. A mock access token was used
                  to enter the application shell.
                </p>
                <button id="logout-button" type="button">Clear mock session</button>
              `
              : ""
          }
        </section>
      </section>
    </main>
  `;

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

function formatRoleLabel(role: string): string {
  switch (role) {
    case "recepcion":
      return "Recepción";
    case "medico":
      return "Médico";
    case "terapeuta":
      return "Terapeuta";
    case "direccion":
      return "Dirección";
    case "admin":
      return "Admin";
    default:
      return role;
  }
}