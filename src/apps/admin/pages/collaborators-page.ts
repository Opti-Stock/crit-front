import { collaboratorsService } from "../../../features/admin/services/collaborators.service";
import { renderAdminTable } from "../../../features/admin/components/admin-table";

export async function mountCollaboratorsPage(
  root: HTMLElement,
): Promise<void> {
  root.innerHTML = `
    <section class="app-panel">
      <h2>Colaboradores</h2>
      <p>Loading collaborators...</p>
    </section>
  `;

  try {
    const collaborators =
      await collaboratorsService.getAll();

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
            <h2>Colaboradores</h2>
            <p>Manage collaborators.</p>
          </div>

          <button
            class="primary-action"
            disabled
          >
            New collaborator
          </button>
        </div>

        ${renderAdminTable(
          [
            {
              header: "Nombre",
              render: (collaborator) =>
                collaborator.fullName,
            },
            {
              header: "Correo",
              render: (collaborator) =>
                collaborator.email,
            },
            {
              header: "Estado",
              render: (collaborator) =>
                collaborator.active
                  ? "Activo"
                  : "Inactivo",
            },
          ],
          collaborators,
        )}

      </section>
    `;
  } catch (error) {
    root.innerHTML = `
      <section class="app-panel">
        <h2>Colaboradores</h2>

        <p>
          Failed to load collaborators.
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