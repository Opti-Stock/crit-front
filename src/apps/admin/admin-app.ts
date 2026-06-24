import { sessionService } from "../../features/auth/services/session.service";
import { canAccessAdminEntry } from "../../guards/role-guard";

export function mountAdminApp(root: HTMLElement): void {
  const session = sessionService.getSession();

  if (!session || !canAccessAdminEntry(session.role)) {
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

  root.innerHTML = `
    <main class="app-shell app-shell--admin" aria-labelledby="admin-app-title">
      <aside class="app-sidebar" aria-label="Admin navigation">
        <p class="app-brand">CRIT Admin</p>
        <nav class="app-nav">
          <span class="app-nav__item app-nav__item--active">Usuarios</span>
          <span class="app-nav__item">Roles</span>
          <span class="app-nav__item">Clinicas</span>
          <span class="app-nav__item">Colaboradores</span>
        </nav>
      </aside>
      <section class="app-content">
        <header class="app-header">
          <div>
            <p class="app-eyebrow">Admin app</p>
            <h1 id="admin-app-title">Administration workspace</h1>
          </div>
          <span class="app-status">MVP shell</span>
        </header>
        <section class="app-panel" aria-label="Current status">
          <h2>Admin foundation ready</h2>
          <p>
            This shell is the starting point for CRIT Assistance administration.
          </p>
        </section>
      </section>
    </main>
  `;
}