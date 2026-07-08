import { renderAdminTable } from "../../../features/admin/components/admin-table";
import { clinicsService } from "../../../features/admin/services/clinics.service";
import { roomsService } from "../../../features/admin/services/rooms.service";
import { escapeHtml } from "../../../utils/dom";

export async function mountClinicsPage(
  root: HTMLElement,
  message: string | null = null,
  includeDeleted = false,
): Promise<void> {
  root.innerHTML = `
    <section class="app-panel">
      <h2>Clinicas</h2>
      <p>Loading clinics...</p>
    </section>
  `;

  try {
    const [clinics, rooms] = await Promise.all([
      clinicsService.getAll({ includeDeleted }),
      roomsService.getAll({ includeDeleted }),
    ]);
    const roomCapacityByClinicId = new Map<string, number>();
    for (const room of rooms) {
      if (room.status !== "active" || room.capacity == null) continue;
      roomCapacityByClinicId.set(
        room.clinicId,
        (roomCapacityByClinicId.get(room.clinicId) ?? 0) + room.capacity,
      );
    }

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
            <h2>Clinicas</h2>
            <p>Crear y consultar clinicas del tenant.</p>
          </div>
          <button class="secondary-action" type="button" data-toggle-deleted-clinics>
            ${includeDeleted ? "Ocultar eliminadas" : "Mostrar eliminadas"}
          </button>
        </div>

        ${message ? `<p class="inline-alert" role="status">${escapeHtml(message)}</p>` : ""}

        <form class="form-panel" data-admin-create-clinic-form>
          <h3>Nueva clinica</h3>
          <label>Nombre<input name="name" required /></label>
          <label>Especializacion<input name="specialization" /></label>
          <label>Capacidad<input name="capacity" type="number" min="1" step="1" /></label>
          <button type="submit" class="primary-action">Crear clinica</button>
        </form>

        ${renderAdminTable(
          [
            {
              header: "Nombre",
              render: (clinic) => escapeHtml(clinic.name),
            },
            {
              header: "Especializacion",
              render: (clinic) =>
                clinic.specialization ? escapeHtml(clinic.specialization) : "-",
            },
            {
              header: "Capacidad",
              render: (clinic) =>
                clinic.capacity == null ? "-" : String(clinic.capacity),
            },
            {
              header: "Capacidad consultorios",
              render: (clinic) => {
                const roomCapacity = roomCapacityByClinicId.get(clinic.id) ?? 0;
                const mismatch =
                  clinic.capacity != null && roomCapacity > 0 && clinic.capacity !== roomCapacity;
                return mismatch
                  ? `<span class="admin-warning-text">${roomCapacity} - revisar capacidad</span>`
                  : String(roomCapacity);
              },
            },
            {
              header: "Estado",
              render: (clinic) =>
                clinic.deletedAt ? "Eliminada" : clinic.status === "active" ? "Activa" : "Inactiva",
            },
            {
              header: "Acciones",
              render: (clinic) =>
                clinic.deletedAt
                  ? `<button class="secondary-action" type="button" data-restore-clinic-id="${escapeHtml(clinic.id)}">Restaurar</button>`
                  : `<button class="secondary-action admin-danger-action" type="button" data-delete-clinic-id="${escapeHtml(clinic.id)}">Eliminar</button>`,
            },
          ],
          clinics,
        )}
      </section>
    `;

    root
      .querySelector<HTMLFormElement>("[data-admin-create-clinic-form]")
      ?.addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.currentTarget as HTMLFormElement;
        const data = new FormData(form);
        const capacityValue = String(data.get("capacity") ?? "").trim();
        void clinicsService
          .create({
            name: String(data.get("name") ?? "").trim(),
            specialization:
              String(data.get("specialization") ?? "").trim() || undefined,
            capacity: capacityValue ? Number(capacityValue) : undefined,
          })
          .then(() => mountClinicsPage(root, "Clinica creada.", includeDeleted))
          .catch((error) =>
            mountClinicsPage(
              root,
              error instanceof Error ? error.message : "No se pudo crear la clinica.",
              includeDeleted,
            ),
          );
      });

    root.querySelector<HTMLButtonElement>("[data-toggle-deleted-clinics]")?.addEventListener("click", () => {
      void mountClinicsPage(root, null, !includeDeleted);
    });

    root.querySelectorAll<HTMLButtonElement>("[data-delete-clinic-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const clinicId = button.dataset.deleteClinicId;
        if (!clinicId) return;
        if (!markInlineConfirmed(button, "Confirmar")) return;
        void clinicsService
          .delete(clinicId)
          .then(() => mountClinicsPage(root, "Clinica eliminada.", includeDeleted))
          .catch((error) =>
            mountClinicsPage(
              root,
              error instanceof Error ? error.message : "No se pudo eliminar la clinica.",
              includeDeleted,
            ),
          );
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-restore-clinic-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const clinicId = button.dataset.restoreClinicId;
        if (!clinicId) return;
        void clinicsService
          .restore(clinicId)
          .then(() => mountClinicsPage(root, "Clinica restaurada.", includeDeleted))
          .catch((error) =>
            mountClinicsPage(
              root,
              error instanceof Error ? error.message : "No se pudo restaurar la clinica.",
              includeDeleted,
            ),
          );
      });
    });
  } catch (error) {
    root.innerHTML = `
      <section class="app-panel">
        <h2>Clinicas</h2>
        <p>Failed to load clinics.</p>
        <pre>${error instanceof Error ? error.message : "Unknown error"}</pre>
      </section>
    `;
  }
}

function markInlineConfirmed(button: HTMLButtonElement, label: string): boolean {
  if (button.dataset.confirmed === "true") return true;
  button.dataset.confirmed = "true";
  button.textContent = label;
  window.setTimeout(() => {
    if (button.isConnected && button.dataset.confirmed === "true") {
      button.dataset.confirmed = "false";
      button.textContent = "Eliminar";
    }
  }, 3000);
  return false;
}
