import { bindAdminDrawer, renderAdminDrawer } from "../../../features/admin/components/admin-drawer";
import { readAdminListControls, renderAdminListControls, renderAdminPagination } from "../../../features/admin/components/admin-list";
import { renderAdminTable } from "../../../features/admin/components/admin-table";
import { clinicsService, type ListClinicsOptions } from "../../../features/admin/services/clinics.service";
import { roomsService } from "../../../features/admin/services/rooms.service";
import { escapeHtml } from "../../../utils/dom";

interface ClinicsPageState extends Required<Pick<ListClinicsOptions, "page" | "pageSize" | "includeDeleted" | "sortBy" | "sortDir">> {
  search: string;
  status: "" | "active" | "inactive";
  drawerOpen: boolean;
  message: string | null;
}

const DEFAULT_STATE: ClinicsPageState = {
  page: 1,
  pageSize: 20,
  search: "",
  status: "",
  includeDeleted: false,
  sortBy: "name",
  sortDir: "asc",
  drawerOpen: false,
  message: null,
};

export async function mountClinicsPage(
  root: HTMLElement,
  messageOrState: string | ClinicsPageState | null = null,
  includeDeleted = false,
): Promise<void> {
  const state = typeof messageOrState === "object" && messageOrState !== null
    ? messageOrState
    : { ...DEFAULT_STATE, message: messageOrState, includeDeleted };

  root.innerHTML = `<section class="app-panel"><h2>Clinicas</h2><p>Loading clinics...</p></section>`;

  try {
    const [clinics, rooms] = await Promise.all([
      clinicsService.list(toListOptions(state)),
      roomsService.getAll({ includeDeleted: state.includeDeleted }),
    ]);
    const roomCapacityByClinicId = new Map<string, number>();
    for (const room of rooms) {
      if (room.status !== "active" || room.capacity == null) continue;
      roomCapacityByClinicId.set(room.clinicId, (roomCapacityByClinicId.get(room.clinicId) ?? 0) + room.capacity);
    }

    root.innerHTML = `
      <section class="app-panel admin-list-page">
        <div class="admin-section-header">
          <div>
            <h2>Clinicas</h2>
            <p>Crear y consultar clinicas del tenant.</p>
          </div>
          <button class="primary-action" type="button" data-admin-open-drawer>Nueva clinica</button>
        </div>
        ${state.message ? `<p class="inline-alert" role="status">${escapeHtml(state.message)}</p>` : ""}
        ${renderAdminListControls({
          search: state.search,
          searchPlaceholder: "Nombre o especialización",
          pageSize: state.pageSize,
          sortBy: state.sortBy,
          sortDir: state.sortDir,
          sortOptions: [
            { value: "name", label: "Nombre" },
            { value: "specialization", label: "Especialización" },
            { value: "capacity", label: "Capacidad" },
            { value: "status", label: "Estado" },
          ],
          filters: `
            <label>
              <span>Estado</span>
              <select name="status">
                <option value="">Todos</option>
                <option value="active" ${state.status === "active" ? "selected" : ""}>Activa</option>
                <option value="inactive" ${state.status === "inactive" ? "selected" : ""}>Inactiva</option>
              </select>
            </label>
            <label class="admin-list-controls__check">
              <input name="includeDeleted" type="checkbox" ${state.includeDeleted ? "checked" : ""} />
              <span>Mostrar eliminadas</span>
            </label>
          `,
        })}
        ${renderAdminTable(
          [
            { header: "Nombre", sortBy: "name", render: (clinic) => escapeHtml(clinic.name) },
            { header: "Especializacion", sortBy: "specialization", render: (clinic) => clinic.specialization ? escapeHtml(clinic.specialization) : "-" },
            { header: "Capacidad", sortBy: "capacity", render: (clinic) => clinic.capacity == null ? "-" : String(clinic.capacity) },
            {
              header: "Capacidad consultorios",
              render: (clinic) => {
                const roomCapacity = roomCapacityByClinicId.get(clinic.id) ?? 0;
                const mismatch = clinic.capacity != null && roomCapacity > 0 && clinic.capacity !== roomCapacity;
                return mismatch ? `<span class="admin-warning-text">${roomCapacity} - revisar capacidad</span>` : String(roomCapacity);
              },
            },
            { header: "Estado", sortBy: "status", render: (clinic) => clinic.deletedAt ? "Eliminada" : clinic.status === "active" ? "Activa" : "Inactiva" },
            {
              header: "Acciones",
              render: (clinic) => clinic.deletedAt
                ? `<button class="secondary-action" type="button" data-restore-clinic-id="${escapeHtml(clinic.id)}">Restaurar</button>`
                : `<button class="secondary-action admin-danger-action" type="button" data-delete-clinic-id="${escapeHtml(clinic.id)}">Eliminar</button>`,
            },
          ],
          clinics.items,
          { sortBy: state.sortBy, sortDir: state.sortDir },
        )}
        ${renderAdminPagination(clinics.meta)}
      </section>
      ${renderAdminDrawer({ open: state.drawerOpen, title: "Nueva clinica", body: renderCreateClinicForm() })}
    `;

    bindClinicsEvents(root, state);
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

function renderCreateClinicForm() {
  return `
    <form class="form-panel" data-admin-create-clinic-form>
      <label>Nombre<input name="name" required /></label>
      <label>Especializacion<input name="specialization" /></label>
      <label>Capacidad<input name="capacity" type="number" min="1" step="1" /></label>
      <button type="submit" class="primary-action">Crear clinica</button>
    </form>
  `;
}

function bindClinicsEvents(root: HTMLElement, state: ClinicsPageState) {
  root.querySelector<HTMLButtonElement>("[data-admin-open-drawer]")?.addEventListener("click", () => {
    void mountClinicsPage(root, { ...state, drawerOpen: true, message: null });
  });
  bindAdminDrawer(root, () => void mountClinicsPage(root, { ...state, drawerOpen: false }));

  root.querySelector<HTMLFormElement>("[data-admin-list-controls]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const values = readAdminListControls(form);
    const data = new FormData(form);
    void mountClinicsPage(root, {
      ...state,
      ...values,
      page: 1,
      sortBy: values.sortBy as ClinicsPageState["sortBy"],
      status: normalizeStatus(data.get("status")),
      includeDeleted: data.get("includeDeleted") === "on",
      message: null,
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-admin-sort-by]").forEach((button) => {
    button.addEventListener("click", () => {
      void mountClinicsPage(root, {
        ...state,
        page: 1,
        sortBy: button.dataset.adminSortBy as ClinicsPageState["sortBy"],
        sortDir: button.dataset.adminSortDir === "desc" ? "desc" : "asc",
      });
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-admin-page]").forEach((button) => {
    button.addEventListener("click", () => void mountClinicsPage(root, { ...state, page: Number(button.dataset.adminPage ?? state.page) }));
  });

  root.querySelector<HTMLFormElement>("[data-admin-create-clinic-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const capacityValue = String(data.get("capacity") ?? "").trim();
    void clinicsService
      .create({
        name: String(data.get("name") ?? "").trim(),
        specialization: String(data.get("specialization") ?? "").trim() || undefined,
        capacity: capacityValue ? Number(capacityValue) : undefined,
      })
      .then(() => mountClinicsPage(root, { ...state, page: 1, drawerOpen: false, message: "Clinica creada." }))
      .catch((error) => mountClinicsPage(root, {
        ...state,
        message: error instanceof Error ? error.message : "No se pudo crear la clinica.",
      }));
  });

  bindClinicActions(root, state);
}

function bindClinicActions(root: HTMLElement, state: ClinicsPageState) {
  root.querySelectorAll<HTMLButtonElement>("[data-delete-clinic-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const clinicId = button.dataset.deleteClinicId;
      if (!clinicId) return;
      if (!markInlineConfirmed(button, "Confirmar")) return;
      void clinicsService
        .delete(clinicId, readInlineReason(button))
        .then(() => mountClinicsPage(root, { ...state, message: "Clinica eliminada." }))
        .catch((error) => mountClinicsPage(root, { ...state, message: error instanceof Error ? error.message : "No se pudo eliminar la clinica." }));
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-restore-clinic-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const clinicId = button.dataset.restoreClinicId;
      if (!clinicId) return;
      if (!markInlineConfirmed(button, "Confirmar")) return;
      void clinicsService
        .restore(clinicId, readInlineReason(button))
        .then(() => mountClinicsPage(root, { ...state, message: "Clinica restaurada." }))
        .catch((error) => mountClinicsPage(root, { ...state, message: error instanceof Error ? error.message : "No se pudo restaurar la clinica." }));
    });
  });
}

function toListOptions(state: ClinicsPageState): ListClinicsOptions {
  return {
    page: state.page,
    pageSize: state.pageSize,
    search: state.search || undefined,
    status: state.status || undefined,
    includeDeleted: state.includeDeleted,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
  };
}

function normalizeStatus(value: FormDataEntryValue | null): ClinicsPageState["status"] {
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
