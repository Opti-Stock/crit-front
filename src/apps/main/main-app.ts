import { appConfig } from "../../config/env";
import { mountLoginPage } from "../../features/auth/pages/login-page";
import { sessionService } from "../../features/auth/services/session.service";
import { isAuthenticated } from "../../guards/auth-guard";

export function mountMainApp(root: HTMLElement): void {
  if (!isAuthenticated()) {
    mountLoginPage(root, {
      onSubmit: async ({ email, password }) => {
        if (appConfig.authBypassEnabled) {
          sessionService.setSession({
            accessToken: buildMockAccessToken(email, password),
          });

          mountMainApp(root);
          return;
        }

        console.info("Login skeleton submit", {
          email,
          hasPassword: Boolean(password),
        });
      },
    });

    return;
  }

  root.innerHTML = `
    <main class="app-shell app-shell--main" aria-labelledby="main-app-title">
      <aside class="app-sidebar" aria-label="Main navigation">
        <p class="app-brand">CRIT Assistance</p>
        <nav class="app-nav">
          <span class="app-nav__item app-nav__item--active">Dashboard</span>
          <span class="app-nav__item">Asistencias</span>
          <span class="app-nav__item">Calendario</span>
          <span class="app-nav__item">Notas</span>
        </nav>
      </aside>
      <section class="app-content">
        <header class="app-header">
          <div>
            <p class="app-eyebrow">Main app</p>
            <h1 id="main-app-title">Operational workspace</h1>
          </div>
          <span class="app-status">MVP shell</span>
        </header>
        <section class="app-panel" aria-label="Current status">
          <h2>Frontend foundation ready</h2>
          <p>
            This shell is the starting point for the CRIT Assistance operational app.
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