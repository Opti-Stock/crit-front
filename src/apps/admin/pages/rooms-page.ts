import { renderAdminTable } from "../../../features/admin/components/admin-table";
import { clinicsService } from "../../../features/admin/services/clinics.service";
import { roomsService } from "../../../features/admin/services/rooms.service";
import { escapeHtml } from "../../../utils/dom";

export async function mountRoomsPage(
  root: HTMLElement,
  message: string | null = null,
): Promise<void> {
  root.innerHTML = `
    <section class="app-panel">
      <h2>Consultorios</h2>
      <p>Loading rooms...</p>
    </section>
  `;

  try {
    const [rooms, clinics] = await Promise.all([
      roomsService.getAll(),
      clinicsService.getAll(),
    ]);
    const clinicNameById = new Map(clinics.map((clinic) => [clinic.id, clinic.name]));

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
            <h2>Consultorios</h2>
            <p>Crear consultorios o cuartos por clinica.</p>
          </div>
        </div>

        ${message ? `<p class="inline-alert" role="status">${escapeHtml(message)}</p>` : ""}

        <form class="form-panel" data-admin-create-room-form>
          <h3>Nuevo consultorio</h3>
          <label>Clinica
            <select name="clinicId" required>
              <option value="">Selecciona una clinica</option>
              ${clinics
                .map(
                  (clinic) =>
                    `<option value="${escapeHtml(clinic.id)}">${escapeHtml(clinic.name)}</option>`,
                )
                .join("")}
            </select>
          </label>
          <label>Nombre<input name="name" required /></label>
          <label>Capacidad<input name="capacity" type="number" min="1" step="1" /></label>
          <button type="submit" class="primary-action">Crear consultorio</button>
        </form>

        ${renderAdminTable(
          [
            {
              header: "Clinica",
              render: (room) =>
                escapeHtml(room.clinicName ?? clinicNameById.get(room.clinicId) ?? "-"),
            },
            {
              header: "Consultorio",
              render: (room) => escapeHtml(room.name),
            },
            {
              header: "Capacidad",
              render: (room) => (room.capacity == null ? "-" : String(room.capacity)),
            },
            {
              header: "Estado",
              render: (room) => (room.status === "active" ? "Activo" : "Inactivo"),
            },
          ],
          rooms,
        )}
      </section>
    `;

    root
      .querySelector<HTMLFormElement>("[data-admin-create-room-form]")
      ?.addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.currentTarget as HTMLFormElement;
        const data = new FormData(form);
        const capacityValue = String(data.get("capacity") ?? "").trim();
        void roomsService
          .create({
            clinicId: String(data.get("clinicId") ?? ""),
            name: String(data.get("name") ?? "").trim(),
            capacity: capacityValue ? Number(capacityValue) : undefined,
          })
          .then(() => mountRoomsPage(root, "Consultorio creado."))
          .catch((error) =>
            mountRoomsPage(
              root,
              error instanceof Error
                ? error.message
                : "No se pudo crear el consultorio.",
            ),
          );
      });
  } catch (error) {
    root.innerHTML = `
      <section class="app-panel">
        <h2>Consultorios</h2>
        <p>Failed to load rooms.</p>
        <pre>${error instanceof Error ? error.message : "Unknown error"}</pre>
      </section>
    `;
  }
}
