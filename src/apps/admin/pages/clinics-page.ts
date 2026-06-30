import { clinicsService } from "../../../features/admin/services/clinics.service";
import { renderAdminTable } from "../../../features/admin/components/admin-table";

export async function mountClinicsPage(
  root: HTMLElement,
): Promise<void> {
  root.innerHTML = `
    <section class="app-panel">
      <h2>Clínicas</h2>
      <p>Loading clinics...</p>
    </section>
  `;

  try {
    const clinics = await clinicsService.getAll();

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
            <h2>Clínicas</h2>
            <p>Manage clinics.</p>
          </div>

          <button
            class="primary-action"
            disabled
          >
            New clinic
          </button>
        </div>

        ${renderAdminTable(
          [
            {
              header: "Nombre",
              render: (clinic) => clinic.name,
            },
            {
              header: "Estado",
              render: (clinic) =>
                clinic.active ? "Activa" : "Inactiva",
            },
          ],
          clinics,
        )}

      </section>
    `;
  } catch (error) {
    root.innerHTML = `
      <section class="app-panel">
        <h2>Clínicas</h2>

        <p>Failed to load clinics.</p>

        <pre>${
          error instanceof Error
            ? error.message
            : "Unknown error"
        }</pre>
      </section>
    `;
  }
}