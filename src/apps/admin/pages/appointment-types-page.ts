import { renderAdminTable } from "../../../features/admin/components/admin-table";
import { appointmentTypesService } from "../../../features/admin/services/appointment-types.service";
import { escapeHtml } from "../../../utils/dom";

export async function mountAppointmentTypesPage(
  root: HTMLElement,
  message: string | null = null,
): Promise<void> {
  root.innerHTML = `
    <section class="app-panel">
      <h2>Tipos de terapia</h2>
      <p>Cargando tipos...</p>
    </section>
  `;

  try {
    const appointmentTypes = await appointmentTypesService.getAll();

    root.innerHTML = `
      <section class="app-panel">
        <div class="admin-section-header">
          <div>
            <h2>Tipos de terapia</h2>
            <p>Catalogo usado al crear citas en calendario.</p>
          </div>
        </div>
        ${message ? `<p class="inline-alert" role="status">${escapeHtml(message)}</p>` : ""}
        ${renderAdminTable(
          [
            { header: "Nombre", render: (item) => escapeHtml(item.name) },
            { header: "Duracion", render: (item) => `${item.defaultDurationMinutes} min` },
            { header: "Antes", render: (item) => `${item.defaultPreSessionMinutes} min` },
            { header: "Despues", render: (item) => `${item.defaultPostSessionMinutes} min` },
          ],
          appointmentTypes,
        )}
        <form class="form-panel form-grid" data-appointment-type-form>
          <h3>Nuevo tipo</h3>
          <label>Nombre<input name="name" required maxlength="150" /></label>
          <label>Duracion minutos<input name="defaultDurationMinutes" type="number" min="1" required value="45" /></label>
          <label>Minutos antes<input name="defaultPreSessionMinutes" type="number" min="0" value="0" /></label>
          <label>Minutos despues<input name="defaultPostSessionMinutes" type="number" min="0" value="0" /></label>
          <button type="submit">Crear tipo</button>
        </form>
      </section>
    `;

    root.querySelector<HTMLFormElement>("[data-appointment-type-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget as HTMLFormElement);
      void appointmentTypesService
        .create({
          name: String(data.get("name") ?? "").trim(),
          defaultDurationMinutes: Number(data.get("defaultDurationMinutes") ?? 45),
          defaultPreSessionMinutes: Number(data.get("defaultPreSessionMinutes") ?? 0),
          defaultPostSessionMinutes: Number(data.get("defaultPostSessionMinutes") ?? 0),
        })
        .then(() => mountAppointmentTypesPage(root, "Tipo creado."))
        .catch((error) =>
          mountAppointmentTypesPage(
            root,
            error instanceof Error ? error.message : "No se pudo crear el tipo.",
          ),
        );
    });
  } catch (error) {
    root.innerHTML = `
      <section class="app-panel">
        <h2>Tipos de terapia</h2>
        <p>No se pudieron cargar los tipos.</p>
        <pre>${error instanceof Error ? error.message : "Unknown error"}</pre>
      </section>
    `;
  }
}
