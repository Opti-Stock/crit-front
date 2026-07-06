import { superAdminService } from "../../features/super-admin/services/super-admin.service";
import { superAdminSessionService } from "../../features/super-admin/services/super-admin-session.service";
import type { TenantSummary } from "../../features/super-admin/types/super-admin.types";

interface SuperAdminState {
  tenants: TenantSummary[];
  isLoading: boolean;
  error: string | null;
}

const state: SuperAdminState = {
  tenants: [],
  isLoading: false,
  error: null,
};

export function mountSuperAdminApp(root: HTMLElement): void {
  const session = superAdminSessionService.getSession();

  if (!session) {
    renderLogin(root);
    return;
  }

  renderShell(root);
  void loadTenants(root);
}

function renderLogin(root: HTMLElement, errorMessage: string | null = null): void {
  root.innerHTML = `
    <main class="auth-page" aria-labelledby="super-admin-login-title">
      <section class="auth-card">
        <header class="auth-card__header">
          <p class="auth-card__eyebrow">CRIT Platform</p>
          <h1 id="super-admin-login-title" class="auth-card__title">Super admin</h1>
          <p class="auth-card__subtitle">Manage CRIT centers and create their first administrator.</p>
        </header>
        <form id="super-admin-login-form" class="auth-form" novalidate>
          <div class="auth-form__field">
            <label for="platform-email">Email</label>
            <input id="platform-email" name="email" type="email" autocomplete="email" required />
          </div>
          <div class="auth-form__field">
            <label for="platform-password">Password</label>
            <input id="platform-password" name="password" type="password" autocomplete="current-password" required />
          </div>
          ${errorMessage ? `<p class="auth-form__error" role="alert">${escapeHtml(errorMessage)}</p>` : ""}
          <button type="submit" class="auth-form__submit">Sign in</button>
        </form>
      </section>
    </main>
  `;

  root.querySelector<HTMLFormElement>("#super-admin-login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    try {
      const response = await superAdminService.login({
        email: String(formData.get("email") ?? "").trim(),
        password: String(formData.get("password") ?? ""),
      });
      superAdminSessionService.setSession({
        accessToken: response.accessToken,
        fullName: response.superAdmin.fullName,
        email: response.superAdmin.email,
      });
      mountSuperAdminApp(root);
    } catch {
      renderLogin(root, "No se pudo iniciar sesion.");
    }
  });
}

function renderShell(root: HTMLElement): void {
  const session = superAdminSessionService.getSession()!;
  root.innerHTML = `
    <main class="app-shell app-shell--platform" aria-labelledby="platform-title">
      <aside class="app-sidebar">
        <p class="app-brand">CRIT Platform</p>
        <nav class="app-nav">
          <span class="app-nav__item app-nav__item--active">CRITs</span>
        </nav>
      </aside>
      <section class="app-content">
        <header class="app-header">
          <div>
            <p class="app-eyebrow">Super admin</p>
            <h1 id="platform-title">Centros CRIT</h1>
          </div>
          <button type="button" data-platform-logout>Salir</button>
        </header>
        <section class="platform-grid">
          <form id="tenant-form" class="form-panel" aria-label="Crear CRIT">
            <h2>Crear CRIT</h2>
            <label>Codigo<input name="code" placeholder="CRIT-NORTE-01" required /></label>
            <label>Nombre<input name="name" placeholder="CRIT Norte" required /></label>
            <label>Estado<input name="state" /></label>
            <label>Ciudad<input name="city" /></label>
            <button type="submit">Crear CRIT</button>
          </form>
          <form id="tenant-admin-form" class="form-panel" aria-label="Crear primer admin">
            <h2>Primer admin</h2>
            <label>CRIT<select name="tenantId" required>${renderTenantOptions(state.tenants)}</select></label>
            <label>Nombre<input name="fullName" required /></label>
            <label>Email<input name="email" type="email" required /></label>
            <label>Password<input name="password" type="password" minlength="12" required /></label>
            <button type="submit">Crear admin</button>
          </form>
        </section>
        <section class="feature-page">
          <div class="feature-header">
            <h2>Resumen operativo</h2>
            <span class="app-status">${escapeHtml(session.email)}</span>
          </div>
          <div id="tenants-view">${renderTenants()}</div>
        </section>
      </section>
    </main>
  `;

  root.querySelector<HTMLButtonElement>("[data-platform-logout]")?.addEventListener("click", () => {
    superAdminSessionService.clearSession();
    mountSuperAdminApp(root);
  });

  root.querySelector<HTMLFormElement>("#tenant-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    try {
      await superAdminService.createTenant({
        code: String(formData.get("code") ?? "").trim(),
        name: String(formData.get("name") ?? "").trim(),
        state: String(formData.get("state") ?? "").trim() || undefined,
        city: String(formData.get("city") ?? "").trim() || undefined,
      });
      form.reset();
      await loadTenants(root);
    } catch {
      state.error = "No se pudo crear el CRIT.";
      renderShell(root);
    }
  });

  root.querySelector<HTMLFormElement>("#tenant-admin-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    try {
      await superAdminService.createTenantAdmin({
        tenantId: String(formData.get("tenantId") ?? ""),
        fullName: String(formData.get("fullName") ?? "").trim(),
        email: String(formData.get("email") ?? "").trim(),
        password: String(formData.get("password") ?? ""),
      });
      form.reset();
      await loadTenants(root);
    } catch {
      state.error = "No se pudo crear el primer admin.";
      renderShell(root);
    }
  });
}

async function loadTenants(root: HTMLElement): Promise<void> {
  state.isLoading = true;
  state.error = null;
  updateTenantsView(root);

  try {
    state.tenants = await superAdminService.listTenants();
  } catch {
    state.error = "No se pudieron cargar los CRITs.";
  } finally {
    state.isLoading = false;
    renderShell(root);
  }
}

function updateTenantsView(root: HTMLElement): void {
  const tenantsView = root.querySelector<HTMLElement>("#tenants-view");
  if (tenantsView) tenantsView.innerHTML = renderTenants();
}

function renderTenants(): string {
  if (state.isLoading) return `<p class="empty-state">Cargando CRITs...</p>`;
  if (state.error) return `<p class="inline-alert">${escapeHtml(state.error)}</p>`;
  if (state.tenants.length === 0) return `<p class="empty-state">No hay CRITs registrados.</p>`;

  return `
    <div class="data-list">
      ${state.tenants
        .map(
          (tenant) => `
            <article class="data-card">
              <div class="data-card__header">
                <div>
                  <h3>${escapeHtml(tenant.name)}</h3>
                  <p class="data-card__meta">${escapeHtml(tenant.code)} · ${escapeHtml(tenant.city ?? "Sin ciudad")}</p>
                </div>
                <span class="status-pill">${tenant.status}</span>
              </div>
              <dl class="detail-grid">
                <div><dt>Usuarios</dt><dd>${tenant.counts.users}</dd></div>
                <div><dt>Clinicas</dt><dd>${tenant.counts.clinics}</dd></div>
                <div><dt>Colaboradores</dt><dd>${tenant.counts.collaborators}</dd></div>
                <div><dt>Pacientes</dt><dd>${tenant.counts.patients}</dd></div>
                <div><dt>Citas</dt><dd>${tenant.counts.appointments}</dd></div>
                <div><dt>Asistencias</dt><dd>${tenant.counts.attendanceRecords}</dd></div>
              </dl>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderTenantOptions(tenants: TenantSummary[]): string {
  if (tenants.length === 0) return `<option value="">Sin CRITs</option>`;
  return tenants
    .map((tenant) => `<option value="${tenant.id}">${escapeHtml(tenant.name)} (${escapeHtml(tenant.code)})</option>`)
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
