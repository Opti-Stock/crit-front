export function mountMainApp(root: HTMLElement): void {
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
        </section>
      </section>
    </main>
  `;
}
