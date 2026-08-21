import { bindAdminDrawer, renderAdminDrawer } from "../../../features/admin/components/admin-drawer";
import { readAdminListControls, renderAdminListControls, renderAdminPagination } from "../../../features/admin/components/admin-list";
import { renderAdminTable } from "../../../features/admin/components/admin-table";
import { clinicsService } from "../../../features/admin/services/clinics.service";
import { rolesService } from "../../../features/admin/services/roles.service";
import { usersService, type ListUsersOptions } from "../../../features/admin/services/users.service";
import { escapeHtml } from "../../../utils/dom";

interface UsersPageState extends Required<Pick<ListUsersOptions, "page" | "pageSize" | "includeDeleted" | "sortBy" | "sortDir">> {
  search: string;
  status: "" | "active" | "inactive";
  roleId: string;
  drawerOpen: boolean;
  message: string | null;
}

const DEFAULT_STATE: UsersPageState = {
  page: 1,
  pageSize: 20,
  search: "",
  status: "",
  roleId: "",
  includeDeleted: false,
  sortBy: "fullName",
  sortDir: "asc",
  drawerOpen: false,
  message: null,
};

export async function mountUsersPage(
  root: HTMLElement,
  messageOrState: string | UsersPageState | null = null,
  includeDeleted = false,
): Promise<void> {
  const state = typeof messageOrState === "object" && messageOrState !== null
    ? messageOrState
    : { ...DEFAULT_STATE, message: messageOrState, includeDeleted };

  root.innerHTML = `<section class="app-panel"><h2>Usuarios</h2><p>Loading users...</p></section>`;

  try {
    const [users, roles, clinics] = await Promise.all([
      usersService.list(toListOptions(state)),
      rolesService.getAll(),
      clinicsService.getAll(),
    ]);

    root.innerHTML = `
      <section class="app-panel admin-list-page">
        <div class="admin-section-header">
          <div>
            <h2>Usuarios</h2>
            <p>Crear usuarios del tenant, revisar roles y administrar accesos.</p>
          </div>
          <button class="primary-action" type="button" data-admin-open-drawer>Nuevo usuario</button>
        </div>

        ${state.message ? `<p class="inline-alert" role="status">${escapeHtml(state.message)}</p>` : ""}

        ${renderAdminListControls({
          search: state.search,
          searchPlaceholder: "Nombre o correo",
          pageSize: state.pageSize,
          sortBy: state.sortBy,
          sortDir: state.sortDir,
          sortOptions: [
            { value: "fullName", label: "Nombre" },
            { value: "email", label: "Correo" },
            { value: "status", label: "Estado" },
          ],
          filters: `
            <label>
              <span>Rol</span>
              <select name="roleId">
                <option value="">Todos</option>
                ${roles.map((role) => `<option value="${escapeHtml(role.id)}" ${role.id === state.roleId ? "selected" : ""}>${escapeHtml(role.name)}</option>`).join("")}
              </select>
            </label>
            <label>
              <span>Estado</span>
              <select name="status">
                <option value="">Todos</option>
                <option value="active" ${state.status === "active" ? "selected" : ""}>Activo</option>
                <option value="inactive" ${state.status === "inactive" ? "selected" : ""}>Inactivo</option>
              </select>
            </label>
            <label class="admin-list-controls__check">
              <input name="includeDeleted" type="checkbox" ${state.includeDeleted ? "checked" : ""} />
              <span>Mostrar eliminados</span>
            </label>
          `,
        })}

        ${renderAdminTable(
          [
            { header: "Nombre", sortBy: "fullName", render: (user) => escapeHtml(user.fullName) },
            { header: "Correo", sortBy: "email", render: (user) => escapeHtml(user.email) },
            { header: "Roles", render: (user) => user.roles.length ? escapeHtml(user.roles.map((role) => role.name).join(", ")) : "-" },
            {
              header: "Estado",
              sortBy: "status",
              render: (user) => user.status === "active"
                ? user.deletedAt ? "Eliminado" : "Activo"
                : user.deletedAt ? "Eliminado" : "Inactivo",
            },
            {
              header: "Acciones",
              render: (user) => user.deletedAt
                ? `<button class="secondary-action" type="button" data-restore-user-id="${escapeHtml(user.id)}">Restaurar</button>`
                : `<button class="secondary-action admin-danger-action" type="button" data-delete-user-id="${escapeHtml(user.id)}">Eliminar</button>`,
            },
          ],
          users.items,
          { sortBy: state.sortBy, sortDir: state.sortDir },
        )}
        ${renderAdminPagination(users.meta)}
      </section>
      ${renderAdminDrawer({
        open: state.drawerOpen,
        title: "Nuevo usuario",
        body: renderCreateUserForm(roles, clinics),
      })}
    `;

    bindUsersEvents(root, state);
  } catch (error) {
    root.innerHTML = `
      <section class="app-panel">
        <h2>Usuarios</h2>
        <p>Failed to load users.</p>
        <pre>${error instanceof Error ? error.message : "Unknown error"}</pre>
      </section>
    `;
  }
}

function renderCreateUserForm(
  roles: Awaited<ReturnType<typeof rolesService.getAll>>,
  clinics: Awaited<ReturnType<typeof clinicsService.getAll>>,
) {
  return `
    <form class="form-panel" data-admin-create-user-form>
      <label>Nombre<input name="fullName" required /></label>
      <label>Email<input name="email" type="email" required /></label>
      <label>Password<input name="password" type="password" minlength="12" required /></label>
      <label>Rol
        <select name="roleId" required>
          <option value="">Selecciona un rol</option>
          ${roles.map((role) => `<option value="${escapeHtml(role.id)}" data-role-name="${escapeHtml(role.name)}">${escapeHtml(role.name)}</option>`).join("")}
        </select>
      </label>
      <label data-specialty-field hidden>Especialidad
        <input name="specialty" placeholder="Opcional para medico o terapeuta" />
      </label>
      <label>Acceso a clinicas
        <select name="clinicIds" multiple size="${Math.min(Math.max(clinics.length, 2), 6)}">
          ${clinics.map((clinic) => `<option value="${escapeHtml(clinic.id)}">${escapeHtml(clinic.name)}</option>`).join("")}
        </select>
      </label>
      <button type="submit" class="primary-action">Crear usuario</button>
    </form>
  `;
}

function bindUsersEvents(root: HTMLElement, state: UsersPageState) {
  root.querySelector<HTMLButtonElement>("[data-admin-open-drawer]")?.addEventListener("click", () => {
    void mountUsersPage(root, { ...state, drawerOpen: true, message: null });
  });
  bindAdminDrawer(root, () => void mountUsersPage(root, { ...state, drawerOpen: false }));

  root.querySelector<HTMLFormElement>("[data-admin-list-controls]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const values = readAdminListControls(form);
    const data = new FormData(form);
    void mountUsersPage(root, {
      ...state,
      ...values,
      page: 1,
      sortBy: values.sortBy as UsersPageState["sortBy"],
      status: normalizeStatus(data.get("status")),
      roleId: String(data.get("roleId") ?? ""),
      includeDeleted: data.get("includeDeleted") === "on",
      message: null,
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-admin-sort-by]").forEach((button) => {
    button.addEventListener("click", () => {
      void mountUsersPage(root, {
        ...state,
        page: 1,
        sortBy: button.dataset.adminSortBy as UsersPageState["sortBy"],
        sortDir: button.dataset.adminSortDir === "desc" ? "desc" : "asc",
      });
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-admin-page]").forEach((button) => {
    button.addEventListener("click", () => {
      void mountUsersPage(root, { ...state, page: Number(button.dataset.adminPage ?? state.page) });
    });
  });

  bindCreateForm(root, state);
  bindSpecialtyVisibility(root);
  bindUserActions(root, state);
}

function bindCreateForm(root: HTMLElement, state: UsersPageState) {
  root.querySelector<HTMLFormElement>("[data-admin-create-user-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const clinicIds = data.getAll("clinicIds").map((clinicId) => String(clinicId)).filter(Boolean);
    void usersService
      .create({
        fullName: String(data.get("fullName") ?? "").trim(),
        email: String(data.get("email") ?? "").trim(),
        password: String(data.get("password") ?? ""),
        roleIds: [String(data.get("roleId") ?? "")].filter(Boolean),
        clinicAccess: clinicIds.map((clinicId) => ({ clinicId, accessLevel: "standard" })),
        specialty: String(data.get("specialty") ?? "").trim() || undefined,
      })
      .then(() => mountUsersPage(root, { ...state, page: 1, drawerOpen: false, message: "Usuario creado." }))
      .catch((error) => mountUsersPage(root, {
        ...state,
        message: error instanceof Error ? error.message : "No se pudo crear el usuario.",
      }));
  });
}

function bindSpecialtyVisibility(root: HTMLElement) {
  const roleSelect = root.querySelector<HTMLSelectElement>('[data-admin-create-user-form] select[name="roleId"]');
  const specialtyField = root.querySelector<HTMLElement>("[data-specialty-field]");
  const syncSpecialtyVisibility = () => {
    const selected = roleSelect?.selectedOptions[0];
    const roleName = selected?.dataset.roleName ?? selected?.textContent ?? "";
    const needsSpecialty = ["medico", "terapeuta", "coordinador"].includes(roleName);
    specialtyField?.toggleAttribute("hidden", !needsSpecialty);
    if (!needsSpecialty) {
      const input = specialtyField?.querySelector<HTMLInputElement>('input[name="specialty"]');
      if (input) input.value = "";
    }
  };
  roleSelect?.addEventListener("change", syncSpecialtyVisibility);
  syncSpecialtyVisibility();
}

function bindUserActions(root: HTMLElement, state: UsersPageState) {
  root.querySelectorAll<HTMLButtonElement>("[data-delete-user-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const userId = button.dataset.deleteUserId;
      if (!userId) return;
      if (!markInlineConfirmed(button, "Confirmar")) return;
      void usersService
        .delete(userId, readInlineReason(button))
        .then(() => mountUsersPage(root, { ...state, message: "Usuario eliminado." }))
        .catch((error) => mountUsersPage(root, {
          ...state,
          message: error instanceof Error ? error.message : "No se pudo eliminar el usuario.",
        }));
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-restore-user-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const userId = button.dataset.restoreUserId;
      if (!userId) return;
      if (!markInlineConfirmed(button, "Confirmar")) return;
      void usersService
        .restore(userId, readInlineReason(button))
        .then(() => mountUsersPage(root, { ...state, message: "Usuario restaurado." }))
        .catch((error) => mountUsersPage(root, {
          ...state,
          message: error instanceof Error ? error.message : "No se pudo restaurar el usuario.",
        }));
    });
  });
}

function toListOptions(state: UsersPageState): ListUsersOptions {
  return {
    page: state.page,
    pageSize: state.pageSize,
    search: state.search || undefined,
    status: state.status || undefined,
    roleId: state.roleId || undefined,
    includeDeleted: state.includeDeleted,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
  };
}

function normalizeStatus(value: FormDataEntryValue | null): UsersPageState["status"] {
  return value === "active" || value === "inactive" ? value : "";
}

function markInlineConfirmed(button: HTMLButtonElement, label: string): boolean {
  if (button.dataset.confirmed === "true") return true;
  const originalLabel = button.textContent ?? "";
  button.dataset.confirmed = "true";
  button.dataset.originalLabel = originalLabel;
  button.textContent = label;
  const input = document.createElement("input");
  input.className = "admin-action-reason";
  input.type = "text";
  input.placeholder = "Motivo";
  input.dataset.adminActionReason = "true";
  button.insertAdjacentElement("afterend", input);
  input.focus();
  window.setTimeout(() => {
    if (button.isConnected && button.dataset.confirmed === "true") {
      button.dataset.confirmed = "false";
      button.textContent = button.dataset.originalLabel ?? originalLabel;
      button.parentElement?.querySelector<HTMLInputElement>("[data-admin-action-reason]")?.remove();
    }
  }, 7000);
  return false;
}

function readInlineReason(button: HTMLButtonElement): string | undefined {
  const reason = button.parentElement?.querySelector<HTMLInputElement>("[data-admin-action-reason]")?.value.trim();
  return reason || undefined;
}
