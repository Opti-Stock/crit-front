import { renderAdminTable } from "../../../features/admin/components/admin-table";
import { clinicsService } from "../../../features/admin/services/clinics.service";
import { roomsService } from "../../../features/admin/services/rooms.service";
import { escapeHtml } from "../../../utils/dom";

export async function mountRoomsPage(
  root: HTMLElement,
  message: string | null = null,
  includeDeleted = false,
): Promise<void> {
  root.innerHTML = `
    <section class="app-panel">
      <h2>Consultorios</h2>
      <p>Loading rooms...</p>
    </section>
  `;

  try {
    const [rooms, clinics] = await Promise.all([
      roomsService.getAll({ includeDeleted }),
      clinicsService.getAll({ includeDeleted }),
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
          <button class="secondary-action" type="button" data-toggle-deleted-rooms>
            ${includeDeleted ? "Ocultar eliminados" : "Mostrar eliminados"}
          </button>
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
              render: (room) => (room.deletedAt ? "Eliminado" : room.status === "active" ? "Activo" : "Inactivo"),
            },
            {
              header: "Acciones",
              render: (room) =>
                room.deletedAt
                  ? `<button class="secondary-action" type="button" data-restore-room-id="${escapeHtml(room.id)}">Restaurar</button>`
                  : `<button class="secondary-action admin-danger-action" type="button" data-delete-room-id="${escapeHtml(room.id)}">Eliminar</button>`,
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
          .then(() => mountRoomsPage(root, "Consultorio creado.", includeDeleted))
          .catch((error) =>
            mountRoomsPage(
              root,
              error instanceof Error
                ? error.message
                : "No se pudo crear el consultorio.",
              includeDeleted,
            ),
          );
      });

    root.querySelector<HTMLButtonElement>("[data-toggle-deleted-rooms]")?.addEventListener("click", () => {
      void mountRoomsPage(root, null, !includeDeleted);
    });

    root.querySelectorAll<HTMLButtonElement>("[data-delete-room-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const roomId = button.dataset.deleteRoomId;
        if (!roomId) return;
        if (!markInlineConfirmed(button, "Confirmar")) return;
        void roomsService
          .delete(roomId, readInlineReason(button))
          .then(() => mountRoomsPage(root, "Consultorio eliminado.", includeDeleted))
          .catch((error) =>
            mountRoomsPage(
              root,
              error instanceof Error ? error.message : "No se pudo eliminar el consultorio.",
              includeDeleted,
            ),
          );
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-restore-room-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const roomId = button.dataset.restoreRoomId;
        if (!roomId) return;
        if (!markInlineConfirmed(button, "Confirmar")) return;
        void roomsService
          .restore(roomId, readInlineReason(button))
          .then(() => mountRoomsPage(root, "Consultorio restaurado.", includeDeleted))
          .catch((error) =>
            mountRoomsPage(
              root,
              error instanceof Error ? error.message : "No se pudo restaurar el consultorio.",
              includeDeleted,
            ),
          );
      });
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
