import { bindAdminDrawer, renderAdminDrawer } from "../../../features/admin/components/admin-drawer";
import { readAdminListControls, renderAdminListControls, renderAdminPagination } from "../../../features/admin/components/admin-list";
import { renderAdminTable } from "../../../features/admin/components/admin-table";
import { appointmentTypesService, type ListAppointmentTypesOptions } from "../../../features/admin/services/appointment-types.service";
import { escapeHtml } from "../../../utils/dom";

interface AppointmentTypesPageState extends Required<Pick<ListAppointmentTypesOptions, "page" | "pageSize" | "sortBy" | "sortDir">> {
  search: string;
  drawerOpen: boolean;
  message: string | null;
}

const DEFAULT_STATE: AppointmentTypesPageState = {
  page: 1,
  pageSize: 20,
  search: "",
  sortBy: "name",
  sortDir: "asc",
  drawerOpen: false,
  message: null,
};

export async function mountAppointmentTypesPage(
  root: HTMLElement,
  messageOrState: string | AppointmentTypesPageState | null = null,
): Promise<void> {
  const state = typeof messageOrState === "object" && messageOrState !== null
    ? messageOrState
    : { ...DEFAULT_STATE, message: messageOrState };

  root.innerHTML = `<section class="app-panel"><h2>Tipos de terapia</h2><p>Cargando tipos...</p></section>`;

  try {
    const appointmentTypes = await appointmentTypesService.list(toListOptions(state));

    root.innerHTML = `
      <section class="app-panel admin-list-page">
        <div class="admin-section-header">
          <div>
            <h2>Tipos de terapia</h2>
            <p>Catalogo usado al crear citas en calendario.</p>
          </div>
          <button class="primary-action" type="button" data-admin-open-drawer>Nuevo tipo</button>
        </div>
        ${state.message ? `<p class="inline-alert" role="status">${escapeHtml(state.message)}</p>` : ""}
        ${renderAdminListControls({
          search: state.search,
          searchPlaceholder: "Nombre del tipo",
          pageSize: state.pageSize,
          sortBy: state.sortBy,
          sortDir: state.sortDir,
          sortOptions: [
            { value: "name", label: "Nombre" },
            { value: "defaultDurationMinutes", label: "Duracion" },
            { value: "defaultPreSessionMinutes", label: "Antes" },
            { value: "defaultPostSessionMinutes", label: "Despues" },
          ],
        })}
        ${renderAdminTable(
          [
            { header: "Nombre", sortBy: "name", render: (item) => escapeHtml(item.name) },
            { header: "Duracion", sortBy: "defaultDurationMinutes", render: (item) => `${item.defaultDurationMinutes} min` },
            { header: "Antes", sortBy: "defaultPreSessionMinutes", render: (item) => `${item.defaultPreSessionMinutes} min` },
            { header: "Despues", sortBy: "defaultPostSessionMinutes", render: (item) => `${item.defaultPostSessionMinutes} min` },
          ],
          appointmentTypes.items,
          { sortBy: state.sortBy, sortDir: state.sortDir },
        )}
        ${renderAdminPagination(appointmentTypes.meta)}
      </section>
      ${renderAdminDrawer({ open: state.drawerOpen, title: "Nuevo tipo", body: renderCreateAppointmentTypeForm() })}
    `;

    bindAppointmentTypesEvents(root, state);
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

function renderCreateAppointmentTypeForm() {
  return `
    <form class="form-panel" data-appointment-type-form>
      <label>Nombre<input name="name" required maxlength="150" /></label>
      <label>Duracion minutos<input name="defaultDurationMinutes" type="number" min="1" required value="45" /></label>
      <label>Minutos antes<input name="defaultPreSessionMinutes" type="number" min="0" value="0" /></label>
      <label>Minutos despues<input name="defaultPostSessionMinutes" type="number" min="0" value="0" /></label>
      <button type="submit" class="primary-action">Crear tipo</button>
    </form>
  `;
}

function bindAppointmentTypesEvents(root: HTMLElement, state: AppointmentTypesPageState) {
  root.querySelector<HTMLButtonElement>("[data-admin-open-drawer]")?.addEventListener("click", () => {
    void mountAppointmentTypesPage(root, { ...state, drawerOpen: true, message: null });
  });
  bindAdminDrawer(root, () => void mountAppointmentTypesPage(root, { ...state, drawerOpen: false }));

  root.querySelector<HTMLFormElement>("[data-admin-list-controls]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = readAdminListControls(event.currentTarget as HTMLFormElement);
    void mountAppointmentTypesPage(root, {
      ...state,
      ...values,
      page: 1,
      sortBy: values.sortBy as AppointmentTypesPageState["sortBy"],
      message: null,
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-admin-sort-by]").forEach((button) => {
    button.addEventListener("click", () => {
      void mountAppointmentTypesPage(root, {
        ...state,
        page: 1,
        sortBy: button.dataset.adminSortBy as AppointmentTypesPageState["sortBy"],
        sortDir: button.dataset.adminSortDir === "desc" ? "desc" : "asc",
      });
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-admin-page]").forEach((button) => {
    button.addEventListener("click", () => void mountAppointmentTypesPage(root, { ...state, page: Number(button.dataset.adminPage ?? state.page) }));
  });

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
      .then(() => mountAppointmentTypesPage(root, { ...state, page: 1, drawerOpen: false, message: "Tipo creado." }))
      .catch((error) => mountAppointmentTypesPage(root, {
        ...state,
        message: error instanceof Error ? error.message : "No se pudo crear el tipo.",
      }));
  });
}

function toListOptions(state: AppointmentTypesPageState): ListAppointmentTypesOptions {
  return {
    page: state.page,
    pageSize: state.pageSize,
    search: state.search || undefined,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
  };
}
