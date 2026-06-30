import { rolesService } from "../../../features/admin/services/roles.service";
import { renderAdminTable } from "../../../features/admin/components/admin-table";

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
            <p>Manage available roles.</p>
          </div>

          <button
            class="primary-action"
            disabled
          >
            New role
          </button>
        </div>

        ${renderAdminTable(
          [
            {
              header: "Nombre",
              render: (role) => role.name,
            },
            {
              header: "Descripción",
              render: (role) =>
                role.description ?? "-",
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

        <p>
          Failed to load roles.
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