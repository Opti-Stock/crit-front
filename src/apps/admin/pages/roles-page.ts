import { renderAdminTable } from "../../../features/admin/components/admin-table";
import { rolesService } from "../../../features/admin/services/roles.service";
import { escapeHtml } from "../../../utils/dom";

export async function mountRolesPage(
  root: HTMLElement,
): Promise<void> {
  root.innerHTML = `
    <section class="app-panel">
      <h2>Roles</h2>
      <p>Loading roles...</p>
    </section>
  `;

  try {
    const roles = await rolesService.getAll();

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
            <h2>Roles</h2>
            <p>Roles disponibles del tenant. Se crean desde seed para mantener permisos consistentes.</p>
          </div>
        </div>

        ${renderAdminTable(
          [
            {
              header: "Nombre",
              render: (role) => escapeHtml(role.name),
            },
            {
              header: "Descripcion",
              render: (role) =>
                role.description ? escapeHtml(role.description) : "-",
            },
          ],
          roles,
        )}
      </section>
    `;
  } catch (error) {
    root.innerHTML = `
      <section class="app-panel">
        <h2>Roles</h2>
        <p>Failed to load roles.</p>
        <pre>${error instanceof Error ? error.message : "Unknown error"}</pre>
      </section>
    `;
  }
}
