import { clinicsService } from "../../../features/admin/services/clinics.service";
import { rolesService } from "../../../features/admin/services/roles.service";
import { usersService } from "../../../features/admin/services/users.service";
import { renderAdminTable } from "../../../features/admin/components/admin-table";
import { escapeHtml } from "../../../utils/dom";

export async function mountUsersPage(
  root: HTMLElement,
  message: string | null = null,
): Promise<void> {
  root.innerHTML = `
    <section class="app-panel">
      <h2>Usuarios</h2>
      <p>Loading users...</p>
    </section>
  `;

  try {
    const [users, roles, clinics] = await Promise.all([
      usersService.getAll(),
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
              ${roles.map((role) => `<option value="${escapeHtml(role.id)}">${escapeHtml(role.name)}</option>`).join("")}
            </select>
          </label>
          <label>Especialidad
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
                  ? "Activo"
                  : "Inactivo",
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
          .then(() => mountUsersPage(root, "Usuario creado."))
          .catch((error) =>
            mountUsersPage(
              root,
              error instanceof Error ? error.message : "No se pudo crear el usuario.",
            ),
          );
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
