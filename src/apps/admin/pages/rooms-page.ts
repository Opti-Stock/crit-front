import { bindAdminDrawer, renderAdminDrawer } from "../../../features/admin/components/admin-drawer";
import { readAdminListControls, renderAdminListControls, renderAdminPagination } from "../../../features/admin/components/admin-list";
import { renderAdminTable } from "../../../features/admin/components/admin-table";
import { clinicsService } from "../../../features/admin/services/clinics.service";
import { roomsService, type ListRoomsOptions } from "../../../features/admin/services/rooms.service";
import { escapeHtml } from "../../../utils/dom";

interface RoomsPageState extends Required<Pick<ListRoomsOptions, "page" | "pageSize" | "includeDeleted" | "sortBy" | "sortDir">> {
  search: string;
  clinicId: string;
  status: "" | "active" | "inactive";
  drawerOpen: boolean;
  message: string | null;
}

const DEFAULT_STATE: RoomsPageState = {
  page: 1,
  pageSize: 20,
  search: "",
  clinicId: "",
  status: "",
  includeDeleted: false,
  sortBy: "clinicName",
  sortDir: "asc",
  drawerOpen: false,
  message: null,
};

export async function mountRoomsPage(
  root: HTMLElement,
  messageOrState: string | RoomsPageState | null = null,
  includeDeleted = false,
): Promise<void> {
  const state = typeof messageOrState === "object" && messageOrState !== null
    ? messageOrState
    : { ...DEFAULT_STATE, message: messageOrState, includeDeleted };

  root.innerHTML = `<section class="app-panel"><h2>Consultorios</h2><p>Loading rooms...</p></section>`;

  try {
    const [rooms, clinics] = await Promise.all([
      roomsService.list(toListOptions(state)),
      clinicsService.getAll({ includeDeleted: state.includeDeleted }),
    ]);
    const clinicNameById = new Map(clinics.map((clinic) => [clinic.id, clinic.name]));

    root.innerHTML = `
      <section class="app-panel admin-list-page">
        <div class="admin-section-header">
          <div>
            <h2>Consultorios</h2>
            <p>Crear consultorios o cuartos por clinica.</p>
          </div>
          <button class="primary-action" type="button" data-admin-open-drawer>Nuevo consultorio</button>
        </div>
        ${state.message ? `<p class="inline-alert" role="status">${escapeHtml(state.message)}</p>` : ""}
        ${renderAdminListControls({
          search: state.search,
          searchPlaceholder: "Consultorio o clínica",
          pageSize: state.pageSize,
          sortBy: state.sortBy,
          sortDir: state.sortDir,
          sortOptions: [
            { value: "clinicName", label: "Clínica" },
            { value: "name", label: "Consultorio" },
            { value: "capacity", label: "Capacidad" },
            { value: "status", label: "Estado" },
          ],
          filters: `
            <label>
              <span>Clinica</span>
              <select name="clinicId">
                <option value="">Todas</option>
                ${clinics.map((clinic) => `<option value="${escapeHtml(clinic.id)}" ${clinic.id === state.clinicId ? "selected" : ""}>${escapeHtml(clinic.name)}</option>`).join("")}
              </select>
            </label>
            <label>
              <span>Estado</span>
              <select name="status">
                <option value="">Todos</option>
                <option value="active" ${state.status === "active" ? "selected" : ""}>Activo</option>
                <option value="inactive" ${state.status === "inactive" ? "selected" : ""}>Inactivo</option>
              </select>
            </label>
            <label class="admin-list-controls__check">
              <input name="includeDeleted" type="checkbox" ${state.includeDeleted ? "checked" : ""} />
              <span>Mostrar eliminados</span>
            </label>
          `,
        })}
        ${renderAdminTable(
          [
            { header: "Clinica", sortBy: "clinicName", render: (room) => escapeHtml(room.clinicName ?? clinicNameById.get(room.clinicId) ?? "-") },
            { header: "Consultorio", sortBy: "name", render: (room) => escapeHtml(room.name) },
            { header: "Capacidad", sortBy: "capacity", render: (room) => room.capacity == null ? "-" : String(room.capacity) },
            { header: "Estado", sortBy: "status", render: (room) => room.deletedAt ? "Eliminado" : room.status === "active" ? "Activo" : "Inactivo" },
            {
              header: "Acciones",
              render: (room) => room.deletedAt
                ? `<button class="secondary-action" type="button" data-restore-room-id="${escapeHtml(room.id)}">Restaurar</button>`
                : `<button class="secondary-action admin-danger-action" type="button" data-delete-room-id="${escapeHtml(room.id)}">Eliminar</button>`,
            },
          ],
          rooms.items,
          { sortBy: state.sortBy, sortDir: state.sortDir },
        )}
        ${renderAdminPagination(rooms.meta)}
      </section>
      ${renderAdminDrawer({ open: state.drawerOpen, title: "Nuevo consultorio", body: renderCreateRoomForm(clinics) })}
    `;

    bindRoomsEvents(root, state);
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

function renderCreateRoomForm(clinics: Awaited<ReturnType<typeof clinicsService.getAll>>) {
  return `
    <form class="form-panel" data-admin-create-room-form>
      <label>Clinica
        <select name="clinicId" required>
          <option value="">Selecciona una clinica</option>
          ${clinics.map((clinic) => `<option value="${escapeHtml(clinic.id)}">${escapeHtml(clinic.name)}</option>`).join("")}
        </select>
      </label>
      <label>Nombre<input name="name" required /></label>
      <label>Capacidad<input name="capacity" type="number" min="1" step="1" /></label>
      <button type="submit" class="primary-action">Crear consultorio</button>
    </form>
  `;
}

function bindRoomsEvents(root: HTMLElement, state: RoomsPageState) {
  root.querySelector<HTMLButtonElement>("[data-admin-open-drawer]")?.addEventListener("click", () => {
    void mountRoomsPage(root, { ...state, drawerOpen: true, message: null });
  });
  bindAdminDrawer(root, () => void mountRoomsPage(root, { ...state, drawerOpen: false }));

  root.querySelector<HTMLFormElement>("[data-admin-list-controls]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const values = readAdminListControls(form);
    const data = new FormData(form);
    void mountRoomsPage(root, {
      ...state,
      ...values,
      page: 1,
      sortBy: values.sortBy as RoomsPageState["sortBy"],
      clinicId: String(data.get("clinicId") ?? ""),
      status: normalizeStatus(data.get("status")),
      includeDeleted: data.get("includeDeleted") === "on",
      message: null,
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-admin-sort-by]").forEach((button) => {
    button.addEventListener("click", () => {
      void mountRoomsPage(root, {
        ...state,
        page: 1,
        sortBy: button.dataset.adminSortBy as RoomsPageState["sortBy"],
        sortDir: button.dataset.adminSortDir === "desc" ? "desc" : "asc",
      });
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-admin-page]").forEach((button) => {
    button.addEventListener("click", () => void mountRoomsPage(root, { ...state, page: Number(button.dataset.adminPage ?? state.page) }));
  });

  root.querySelector<HTMLFormElement>("[data-admin-create-room-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const capacityValue = String(data.get("capacity") ?? "").trim();
    void roomsService
      .create({
        clinicId: String(data.get("clinicId") ?? ""),
        name: String(data.get("name") ?? "").trim(),
        capacity: capacityValue ? Number(capacityValue) : undefined,
      })
      .then(() => mountRoomsPage(root, { ...state, page: 1, drawerOpen: false, message: "Consultorio creado." }))
      .catch((error) => mountRoomsPage(root, {
        ...state,
        message: error instanceof Error ? error.message : "No se pudo crear el consultorio.",
      }));
  });

  bindRoomActions(root, state);
}

function bindRoomActions(root: HTMLElement, state: RoomsPageState) {
  root.querySelectorAll<HTMLButtonElement>("[data-delete-room-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const roomId = button.dataset.deleteRoomId;
      if (!roomId) return;
      if (!markInlineConfirmed(button, "Confirmar")) return;
      void roomsService
        .delete(roomId, readInlineReason(button))
        .then(() => mountRoomsPage(root, { ...state, message: "Consultorio eliminado." }))
        .catch((error) => mountRoomsPage(root, { ...state, message: error instanceof Error ? error.message : "No se pudo eliminar el consultorio." }));
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-restore-room-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const roomId = button.dataset.restoreRoomId;
      if (!roomId) return;
      if (!markInlineConfirmed(button, "Confirmar")) return;
      void roomsService
        .restore(roomId, readInlineReason(button))
        .then(() => mountRoomsPage(root, { ...state, message: "Consultorio restaurado." }))
        .catch((error) => mountRoomsPage(root, { ...state, message: error instanceof Error ? error.message : "No se pudo restaurar el consultorio." }));
    });
  });
}

function toListOptions(state: RoomsPageState): ListRoomsOptions {
  return {
    page: state.page,
    pageSize: state.pageSize,
    search: state.search || undefined,
    clinicId: state.clinicId || undefined,
    status: state.status || undefined,
    includeDeleted: state.includeDeleted,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
  };
}

function normalizeStatus(value: FormDataEntryValue | null): RoomsPageState["status"] {
  return value === "active" || value === "inactive" ? value : "";
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
  const reason = button.parentElement?.querySelector<HTMLInputElement>("[data-admin-action-reason]")?.value.trim();
  return reason || undefined;
}
