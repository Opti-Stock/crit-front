import { clinicsService } from "../../../features/admin/services/clinics.service";
import { rolesService } from "../../../features/admin/services/roles.service";
import { usersService } from "../../../features/admin/services/users.service";
import { renderAdminTable } from "../../../features/admin/components/admin-table";
import { escapeHtml } from "../../../utils/dom";

export async function mountUsersPage(
  root: HTMLElement,
  message: string | null = null,
  includeDeleted = false,
): Promise<void> {
  root.innerHTML = `
    <section class="app-panel">
      <h2>Usuarios</h2>
      <p>Loading users...</p>
    </section>
  `;

  try {
    const [users, roles, clinics] = await Promise.all([
      usersService.getAll({ includeDeleted }),
      rolesService.getAll(),
      clinicsService.getAll(),
    ]);

    root.innerHTML = `
      <section class="app-panel">
        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            margin-bottom:24px;
          "
        >
          <div>
            <h2>Usuarios</h2>
            <p>Crear usuarios del tenant y asignar su rol inicial.</p>
          </div>
          <button class="secondary-action" type="button" data-toggle-deleted-users>
            ${includeDeleted ? "Ocultar eliminados" : "Mostrar eliminados"}
          </button>
        </div>

        ${message ? `<p class="inline-alert" role="status">${escapeHtml(message)}</p>` : ""}

        <form class="form-panel" data-admin-create-user-form>
          <h3>Nuevo usuario</h3>
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

        ${renderAdminTable(
          [
            {
              header: "Nombre",
              render: (user) => escapeHtml(user.fullName),
            },
            {
              header: "Correo",
              render: (user) => escapeHtml(user.email),
            },
            {
              header: "Roles",
              render: (user) =>
                user.roles.length
                  ? escapeHtml(user.roles.map((role) => role.name).join(", "))
                  : "-",
            },
            {
              header: "Estado",
              render: (user) =>
                user.status === "active"
                  ? user.deletedAt ? "Eliminado" : "Activo"
                  : user.deletedAt ? "Eliminado" : "Inactivo",
            },
            {
              header: "Acciones",
              render: (user) =>
                user.deletedAt
                  ? `<button class="secondary-action" type="button" data-restore-user-id="${escapeHtml(user.id)}">Restaurar</button>`
                  : `<button class="secondary-action admin-danger-action" type="button" data-delete-user-id="${escapeHtml(user.id)}">Eliminar</button>`,
            },
          ],
          users,
        )}
      </section>
    `;

    root
      .querySelector<HTMLFormElement>("[data-admin-create-user-form]")
      ?.addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.currentTarget as HTMLFormElement;
        const data = new FormData(form);
        const clinicIds = data
          .getAll("clinicIds")
          .map((clinicId) => String(clinicId))
          .filter(Boolean);
        void usersService
          .create({
            fullName: String(data.get("fullName") ?? "").trim(),
            email: String(data.get("email") ?? "").trim(),
            password: String(data.get("password") ?? ""),
            roleIds: [String(data.get("roleId") ?? "")].filter(Boolean),
            clinicAccess: clinicIds.map((clinicId) => ({
              clinicId,
              accessLevel: "standard",
            })),
            specialty: String(data.get("specialty") ?? "").trim() || undefined,
          })
          .then(() => mountUsersPage(root, "Usuario creado.", includeDeleted))
          .catch((error) =>
            mountUsersPage(
              root,
              error instanceof Error ? error.message : "No se pudo crear el usuario.",
              includeDeleted,
            ),
          );
      });

    root.querySelector<HTMLButtonElement>("[data-toggle-deleted-users]")?.addEventListener("click", () => {
      void mountUsersPage(root, null, !includeDeleted);
    });

    const roleSelect = root.querySelector<HTMLSelectElement>('select[name="roleId"]');
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

    root.querySelectorAll<HTMLButtonElement>("[data-delete-user-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const userId = button.dataset.deleteUserId;
        if (!userId) return;
        if (!markInlineConfirmed(button, "Confirmar")) return;
        void usersService
          .delete(userId, readInlineReason(button))
          .then(() => mountUsersPage(root, "Usuario eliminado.", includeDeleted))
          .catch((error) =>
            mountUsersPage(
              root,
              error instanceof Error ? error.message : "No se pudo eliminar el usuario.",
              includeDeleted,
            ),
          );
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-restore-user-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const userId = button.dataset.restoreUserId;
        if (!userId) return;
        if (!markInlineConfirmed(button, "Confirmar")) return;
        void usersService
          .restore(userId, readInlineReason(button))
          .then(() => mountUsersPage(root, "Usuario restaurado.", includeDeleted))
          .catch((error) =>
            mountUsersPage(
              root,
              error instanceof Error ? error.message : "No se pudo restaurar el usuario.",
              includeDeleted,
            ),
          );
      });
    });
  } catch (error) {
    root.innerHTML = `
      <section class="app-panel">
        <h2>Usuarios</h2>

        <p>
          Failed to load users.
        </p>

        <pre>${
          error instanceof Error
            ? error.message
            : "Unknown error"
        }</pre>
      </section>
    `;
  }
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
  const reason = button.parentElement
    ?.querySelector<HTMLInputElement>("[data-admin-action-reason]")
    ?.value.trim();
  return reason || undefined;
}
