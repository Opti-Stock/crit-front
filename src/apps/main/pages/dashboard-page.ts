import type { UserRole } from "../../../types/role.types";

export function mountDashboardPage(root: HTMLElement, role: UserRole): void {
  root.innerHTML = `
    <section class="feature-page">
      <header class="feature-header">
        <div>
          <p class="app-eyebrow">Dashboard</p>
          <h2>Operational workspace</h2>
        </div>
      </header>
      <section class="app-panel">
        <h3>CRIT Assistance MVP</h3>
        <p>Selecciona una seccion del menu para trabajar con las vistas operativas.</p>
        <p>Rol actual: <strong>${role}</strong></p>
      </section>
    </section>
  `;
}
