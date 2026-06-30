import { usersService } from "../../../features/admin/services/users.service";
import { renderAdminTable } from "../../../features/admin/components/admin-table";

export async function mountUsersPage(
  root: HTMLElement,
): Promise<void> {
  root.innerHTML = `
    <section class="app-panel">
      <h2>Usuarios</h2>
      <p>Loading users...</p>
    </section>
  `;

  try {
    const users = await usersService.getAll();

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
            <p>Manage application users.</p>
          </div>

          <button
            class="primary-action"
            disabled
          >
            New user
          </button>
        </div>

        ${renderAdminTable(
          [
            {
              header: "Nombre",
              render: (user) => user.fullName,
            },
            {
              header: "Correo",
              render: (user) => user.email,
            },
            {
              header: "Estado",
              render: (user) =>
                user.active
                  ? "Activo"
                  : "Inactivo",
            },
          ],
          users,
        )}
      </section>
    `;
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