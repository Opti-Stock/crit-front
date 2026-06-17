export function mountAdminApp(root: HTMLElement): void {
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
