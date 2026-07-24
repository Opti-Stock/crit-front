import { listAppointmentTypes } from "../../../services/main-api/calendar";
import {
  listClinics,
  listCollaborators,
  listPatients,
  listRooms,
} from "../../../services/main-api/catalogs";
import {
  schedulingService,
  type SchedulingBlock,
  type SchedulingTimeRange,
} from "../../../services/main-api/scheduling";
import type {
  AppointmentTypeSummary,
  CatalogItem,
} from "../../../types/operational.types";
import type { UserRole } from "../../../types/role.types";
import { escapeHtml } from "../../../utils/dom";

type SchedulingTab =
  | "hours"
  | "clinic-types"
  | "collaborator-types"
  | "room-types"
  | "blocks"
  | "preferences";

interface SchedulingState {
  role: UserRole;
  isManager: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  message: string | null;
  activeTab: SchedulingTab;
  clinicId: string;
  collaboratorId: string;
  roomId: string;
  patientId: string;
  clinics: CatalogItem[];
  collaborators: CatalogItem[];
  rooms: CatalogItem[];
  patients: CatalogItem[];
  appointmentTypes: AppointmentTypeSummary[];
  hours: SchedulingTimeRange[];
  clinicTypeIds: string[];
  collaboratorTypeIds: string[];
  roomTypeIds: string[];
  blocks: SchedulingBlock[];
  preferences: SchedulingTimeRange[];
}

const WEEKDAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miercoles",
  "Jueves",
  "Viernes",
  "Sabado",
] as const;

export async function mountSchedulingSettingsPage(
  root: HTMLElement,
  role: UserRole,
): Promise<void> {
  const state: SchedulingState = {
    role,
    isManager: role === "admin" || role === "coordinador",
    isLoading: true,
    isSaving: false,
    error: null,
    message: null,
    activeTab: role === "recepcion" ? "preferences" : "hours",
    clinicId: "",
    collaboratorId: "",
    roomId: "",
    patientId: "",
    clinics: [],
    collaborators: [],
    rooms: [],
    patients: [],
    appointmentTypes: [],
    hours: [],
    clinicTypeIds: [],
    collaboratorTypeIds: [],
    roomTypeIds: [],
    blocks: [],
    preferences: [],
  };

  render(root, state);

  try {
    const [clinics, appointmentTypes] = await Promise.all([
      listClinics({ pageSize: 100 }),
      listAppointmentTypes(),
    ]);
    state.clinics = clinics.data;
    state.appointmentTypes = appointmentTypes;
    state.clinicId = state.clinics[0]?.id ?? "";
    await loadClinicState(state);
  } catch (error) {
    state.error = errorMessage(error, "No se pudo cargar la configuracion.");
  } finally {
    state.isLoading = false;
    render(root, state);
    bind(root, state);
  }
}

async function loadClinicState(state: SchedulingState): Promise<void> {
  state.error = null;
  state.message = null;
  state.collaboratorId = "";
  state.roomId = "";
  state.patientId = "";
  state.preferences = [];

  if (!state.clinicId) {
    state.collaborators = [];
    state.rooms = [];
    state.patients = [];
    return;
  }

  const catalogs = await Promise.all([
    listCollaborators({ clinicId: state.clinicId, pageSize: 100 }),
    listRooms({ clinicId: state.clinicId, pageSize: 100 }),
    listPatients({ clinicId: state.clinicId, pageSize: 100 }),
  ]);
  state.collaborators = catalogs[0].data;
  state.rooms = catalogs[1].data;
  state.patients = catalogs[2].data;
  state.collaboratorId = state.collaborators[0]?.id ?? "";
  state.roomId = state.rooms[0]?.id ?? "";

  if (!state.isManager) return;

  const [hours, clinicTypes, blocks] = await Promise.all([
    schedulingService.listOperatingHours(state.clinicId),
    schedulingService.listClinicAppointmentTypes(state.clinicId),
    schedulingService.listBlocks(state.clinicId),
  ]);
  state.hours = hours;
  state.clinicTypeIds = clinicTypes.appointmentTypeIds;
  state.blocks = blocks;
  await Promise.all([
    loadCollaboratorTypes(state),
    loadRoomTypes(state),
  ]);
}

async function loadCollaboratorTypes(state: SchedulingState): Promise<void> {
  state.collaboratorTypeIds = state.collaboratorId
    ? (await schedulingService.listCollaboratorAppointmentTypes(
        state.clinicId,
        state.collaboratorId,
      )).appointmentTypeIds
    : [];
}

async function loadRoomTypes(state: SchedulingState): Promise<void> {
  state.roomTypeIds = state.roomId
    ? (await schedulingService.listRoomAppointmentTypes(
        state.clinicId,
        state.roomId,
      )).appointmentTypeIds
    : [];
}

async function loadPreferences(state: SchedulingState): Promise<void> {
  state.preferences = state.patientId
    ? await schedulingService.listPatientPreferences(
        state.clinicId,
        state.patientId,
      )
    : [];
}

function render(root: HTMLElement, state: SchedulingState): void {
  root.innerHTML = `
    <section class="scheduling-settings" aria-labelledby="scheduling-title">
      <header class="feature-header">
        <div>
          <p class="app-eyebrow">Agenda inteligente</p>
          <h2 id="scheduling-title">Configuracion de agenda</h2>
          <p>Define disponibilidad operativa y preferencias usadas por las recomendaciones.</p>
        </div>
      </header>

      ${state.error ? `<div class="inline-alert scheduling-alert" role="alert">${escapeHtml(state.error)}<button class="secondary-action" type="button" data-scheduling-retry>Reintentar</button></div>` : ""}
      ${state.message ? `<p class="inline-alert scheduling-alert scheduling-alert--success" role="status">${escapeHtml(state.message)}</p>` : ""}

      <div class="scheduling-toolbar">
        <label>
          Clinica
          <select data-scheduling-clinic ${state.isLoading || state.isSaving ? "disabled" : ""}>
            ${renderOptions(state.clinics, state.clinicId, "Selecciona una clinica")}
          </select>
        </label>
        <span class="scheduling-toolbar__status">${state.isLoading ? "Cargando..." : state.isSaving ? "Guardando..." : ""}</span>
      </div>

      ${state.isLoading ? `<p class="empty-state">Cargando reglas de agenda...</p>` : renderWorkspace(state)}
    </section>
  `;
}

function renderWorkspace(state: SchedulingState): string {
  if (!state.clinicId) {
    return `<p class="empty-state">No hay clinicas disponibles para tu usuario.</p>`;
  }

  const tabs: { key: SchedulingTab; label: string }[] = state.isManager
    ? [
        { key: "hours", label: "Horarios" },
        { key: "clinic-types", label: "Clinica y tipos" },
        { key: "collaborator-types", label: "Profesionales" },
        { key: "room-types", label: "Consultorios" },
        { key: "blocks", label: "Bloqueos" },
        { key: "preferences", label: "Preferencias" },
      ]
    : [{ key: "preferences", label: "Preferencias" }];

  return `
    <div class="scheduling-tabs" role="tablist" aria-label="Secciones de configuracion">
      ${tabs.map((tab) => `
        <button
          type="button"
          role="tab"
          aria-selected="${String(tab.key === state.activeTab)}"
          class="${tab.key === state.activeTab ? "is-active" : ""}"
          data-scheduling-tab="${tab.key}"
        >${escapeHtml(tab.label)}</button>
      `).join("")}
    </div>
    <div class="scheduling-section">
      ${renderActiveTab(state)}
    </div>
  `;
}

function renderActiveTab(state: SchedulingState): string {
  switch (state.activeTab) {
    case "hours":
      return renderTimeRangeForm(
        "Horario semanal",
        "Los horarios se interpretan en la zona horaria de la clinica.",
        "hours",
        state.hours,
      );
    case "clinic-types":
      return renderAssignmentForm(
        "Tipos disponibles en la clinica",
        "clinic-types",
        state.appointmentTypes,
        state.clinicTypeIds,
      );
    case "collaborator-types":
      return renderTargetAssignment(
        "Profesional",
        "collaborator",
        state.collaborators,
        state.collaboratorId,
        state.appointmentTypes,
        state.collaboratorTypeIds,
      );
    case "room-types":
      return renderTargetAssignment(
        "Consultorio",
        "room",
        state.rooms,
        state.roomId,
        state.appointmentTypes,
        state.roomTypeIds,
      );
    case "blocks":
      return renderBlocks(state);
    case "preferences":
      return renderPreferences(state);
  }
}

function renderTimeRangeForm(
  title: string,
  description: string,
  formName: "hours" | "preferences",
  ranges: readonly SchedulingTimeRange[],
): string {
  return `
    <div class="scheduling-section__header">
      <div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></div>
    </div>
    <form data-scheduling-${formName}-form>
      <div class="scheduling-week">
        ${WEEKDAYS.map((label, weekday) => {
          const range = ranges.find((item) => item.weekday === weekday);
          return `
            <fieldset class="scheduling-day">
              <label class="scheduling-day__toggle">
                <input type="checkbox" name="enabled-${weekday}" ${range ? "checked" : ""} />
                <span>${label}</span>
              </label>
              <label>Desde<input type="time" name="start-${weekday}" step="300" value="${escapeHtml(normalizeTime(range?.startTime ?? "08:00"))}" /></label>
              <label>Hasta<input type="time" name="end-${weekday}" step="300" value="${escapeHtml(normalizeTime(range?.endTime ?? "17:00"))}" /></label>
            </fieldset>
          `;
        }).join("")}
      </div>
      <div class="scheduling-actions">
        <button type="submit">Guardar cambios</button>
      </div>
    </form>
  `;
}

function renderAssignmentForm(
  title: string,
  formName: "clinic-types" | "collaborator-types" | "room-types",
  types: readonly AppointmentTypeSummary[],
  selectedIds: readonly string[],
): string {
  return `
    <div class="scheduling-section__header"><div><h3>${escapeHtml(title)}</h3><p>Selecciona todos los tipos compatibles.</p></div></div>
    <form data-scheduling-${formName}-form>
      <div class="scheduling-check-grid">
        ${types.length === 0
          ? `<p class="empty-state">No hay tipos de cita activos.</p>`
          : types.map((type) => `
              <label class="scheduling-check">
                <input type="checkbox" name="appointmentTypeId" value="${escapeHtml(type.id)}" ${selectedIds.includes(type.id) ? "checked" : ""} />
                <span><strong>${escapeHtml(type.name)}</strong><small>${type.defaultDurationMinutes} min</small></span>
              </label>
            `).join("")}
      </div>
      <div class="scheduling-actions"><button type="submit">Guardar compatibilidades</button></div>
    </form>
  `;
}

function renderTargetAssignment(
  label: string,
  target: "collaborator" | "room",
  items: readonly CatalogItem[],
  selectedId: string,
  types: readonly AppointmentTypeSummary[],
  selectedTypeIds: readonly string[],
): string {
  return `
    <div class="scheduling-target">
      <label>${label}
        <select data-scheduling-${target}>
          ${renderOptions(items, selectedId, `Sin ${label.toLowerCase()}s disponibles`)}
        </select>
      </label>
    </div>
    ${selectedId
      ? renderAssignmentForm(
          `Tipos compatibles por ${label.toLowerCase()}`,
          target === "room" ? "room-types" : "collaborator-types",
          types,
          selectedTypeIds,
        )
      : `<p class="empty-state">Selecciona un registro para configurarlo.</p>`}
  `;
}

function renderBlocks(state: SchedulingState): string {
  return `
    <div class="scheduling-section__header"><div><h3>Bloqueos de agenda</h3><p>Bloquea una clinica completa, un profesional o un consultorio.</p></div></div>
    <form class="form-grid scheduling-block-form" data-scheduling-block-form>
      <label>Alcance
        <select name="target">
          <option value="clinic">Clinica completa</option>
          <option value="collaborator">Profesional seleccionado</option>
          <option value="room">Consultorio seleccionado</option>
        </select>
      </label>
      <label>Profesional
        <select name="collaboratorId">${renderOptions(state.collaborators, state.collaboratorId, "Sin profesionales")}</select>
      </label>
      <label>Consultorio
        <select name="roomId">${renderOptions(state.rooms, state.roomId, "Sin consultorios")}</select>
      </label>
      <label>Inicio<input type="datetime-local" name="startsAt" required /></label>
      <label>Fin<input type="datetime-local" name="endsAt" required /></label>
      <label class="scheduling-block-form__reason">Motivo<input name="reason" maxlength="255" required /></label>
      <button type="submit">Crear bloqueo</button>
    </form>
    <div class="scheduling-block-list">
      ${state.blocks.length === 0
        ? `<p class="empty-state">No hay bloqueos activos.</p>`
        : state.blocks.map((block) => `
            <article class="scheduling-block">
              <div>
                <strong>${escapeHtml(block.reason)}</strong>
                <span>${escapeHtml(formatDateTime(block.startsAt))} a ${escapeHtml(formatDateTime(block.endsAt))}</span>
                <small>${escapeHtml(blockTargetLabel(block, state))}</small>
              </div>
              <button class="icon-button icon-button--danger" type="button" aria-label="Eliminar bloqueo" title="Eliminar bloqueo" data-delete-scheduling-block="${escapeHtml(block.id)}">x</button>
            </article>
          `).join("")}
    </div>
  `;
}

function renderPreferences(state: SchedulingState): string {
  return `
    <div class="scheduling-section__header">
      <div><h3>Preferencias del paciente</h3><p>Estas franjas mejoran el ranking, pero no reservan una cita.</p></div>
    </div>
    <div class="scheduling-target">
      <label>Paciente
        <select data-scheduling-patient>
          ${renderOptions(state.patients, state.patientId, "Selecciona un paciente")}
        </select>
      </label>
    </div>
    ${state.patientId
      ? renderTimeRangeForm(
          "Disponibilidad preferida",
          "Puedes dejar todos los dias desactivados si el paciente no tiene preferencia.",
          "preferences",
          state.preferences,
        )
      : `<p class="empty-state">Selecciona un paciente para consultar sus preferencias.</p>`}
  `;
}

function bind(root: HTMLElement, state: SchedulingState): void {
  root.querySelector<HTMLSelectElement>("[data-scheduling-clinic]")?.addEventListener("change", (event) => {
    state.clinicId = (event.currentTarget as HTMLSelectElement).value;
    void run(root, state, () => loadClinicState(state));
  });

  root.querySelectorAll<HTMLButtonElement>("[data-scheduling-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTab = button.dataset.schedulingTab as SchedulingTab;
      state.error = null;
      state.message = null;
      render(root, state);
      bind(root, state);
    });
  });

  bindTarget(root, state, "collaborator", loadCollaboratorTypes);
  bindTarget(root, state, "room", loadRoomTypes);

  root.querySelector<HTMLSelectElement>("[data-scheduling-patient]")?.addEventListener("change", (event) => {
    state.patientId = (event.currentTarget as HTMLSelectElement).value;
    void run(root, state, () => loadPreferences(state));
  });

  root.querySelector<HTMLFormElement>("[data-scheduling-hours-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const hours = readTimeRanges(event.currentTarget as HTMLFormElement);
    void run(root, state, async () => {
      state.hours = await schedulingService.replaceOperatingHours(state.clinicId, hours);
      state.message = "Horario actualizado.";
    });
  });

  bindAssignmentForm(root, state, "clinic-types", async (ids) => {
    state.clinicTypeIds = (await schedulingService.replaceClinicAppointmentTypes(
      state.clinicId,
      ids,
    )).appointmentTypeIds;
  });
  bindAssignmentForm(root, state, "collaborator-types", async (ids) => {
    state.collaboratorTypeIds = (await schedulingService.replaceCollaboratorAppointmentTypes(
      state.clinicId,
      state.collaboratorId,
      ids,
    )).appointmentTypeIds;
  });
  bindAssignmentForm(root, state, "room-types", async (ids) => {
    state.roomTypeIds = (await schedulingService.replaceRoomAppointmentTypes(
      state.clinicId,
      state.roomId,
      ids,
    )).appointmentTypeIds;
  });

  root.querySelector<HTMLFormElement>("[data-scheduling-preferences-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const preferences = readTimeRanges(event.currentTarget as HTMLFormElement);
    void run(root, state, async () => {
      state.preferences = await schedulingService.replacePatientPreferences(
        state.clinicId,
        state.patientId,
        preferences,
      );
      state.message = "Preferencias actualizadas.";
    });
  });

  root.querySelector<HTMLFormElement>("[data-scheduling-block-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const target = String(data.get("target") ?? "clinic");
    void run(root, state, async () => {
      await schedulingService.createBlock(state.clinicId, {
        collaboratorId: target === "collaborator"
          ? String(data.get("collaboratorId") ?? "") || undefined
          : undefined,
        roomId: target === "room"
          ? String(data.get("roomId") ?? "") || undefined
          : undefined,
        startsAt: toIsoDateTime(String(data.get("startsAt") ?? "")),
        endsAt: toIsoDateTime(String(data.get("endsAt") ?? "")),
        reason: String(data.get("reason") ?? "").trim(),
      });
      state.blocks = await schedulingService.listBlocks(state.clinicId);
      state.message = "Bloqueo creado.";
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-delete-scheduling-block]").forEach((button) => {
    button.addEventListener("click", () => {
      const blockId = button.dataset.deleteSchedulingBlock;
      if (!blockId) return;
      void run(root, state, async () => {
        await schedulingService.deleteBlock(state.clinicId, blockId);
        state.blocks = state.blocks.filter((block) => block.id !== blockId);
        state.message = "Bloqueo eliminado.";
      });
    });
  });

  root.querySelector<HTMLButtonElement>("[data-scheduling-retry]")?.addEventListener("click", () => {
    void run(root, state, () => loadClinicState(state));
  });
}

function bindTarget(
  root: HTMLElement,
  state: SchedulingState,
  target: "collaborator" | "room",
  loader: (state: SchedulingState) => Promise<void>,
): void {
  root.querySelector<HTMLSelectElement>(`[data-scheduling-${target}]`)?.addEventListener("change", (event) => {
    if (target === "collaborator") {
      state.collaboratorId = (event.currentTarget as HTMLSelectElement).value;
    } else {
      state.roomId = (event.currentTarget as HTMLSelectElement).value;
    }
    void run(root, state, () => loader(state));
  });
}

function bindAssignmentForm(
  root: HTMLElement,
  state: SchedulingState,
  name: "clinic-types" | "collaborator-types" | "room-types",
  save: (ids: string[]) => Promise<void>,
): void {
  root.querySelector<HTMLFormElement>(`[data-scheduling-${name}-form]`)?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const ids = data.getAll("appointmentTypeId").map(String);
    void run(root, state, async () => {
      await save(ids);
      state.message = "Compatibilidades actualizadas.";
    });
  });
}

async function run(
  root: HTMLElement,
  state: SchedulingState,
  operation: () => Promise<void>,
): Promise<void> {
  state.isSaving = true;
  state.error = null;
  state.message = null;
  render(root, state);
  try {
    await operation();
  } catch (error) {
    state.error = errorMessage(error, "No se pudo guardar la configuracion.");
  } finally {
    state.isSaving = false;
    render(root, state);
    bind(root, state);
  }
}

export function readTimeRanges(form: HTMLFormElement) {
  const data = new FormData(form);
  return WEEKDAYS.flatMap((_, weekday) => {
    if (data.get(`enabled-${weekday}`) !== "on") return [];
    return [{
      weekday,
      startTime: String(data.get(`start-${weekday}`) ?? ""),
      endTime: String(data.get(`end-${weekday}`) ?? ""),
    }];
  });
}

function renderOptions(
  items: readonly CatalogItem[],
  selectedId: string,
  emptyLabel: string,
): string {
  const empty = `<option value="">${escapeHtml(emptyLabel)}</option>`;
  return empty + items.map((item) => `
    <option value="${escapeHtml(item.id)}" ${item.id === selectedId ? "selected" : ""}>
      ${escapeHtml(item.fullName ?? item.name ?? item.folio ?? item.id)}
    </option>
  `).join("");
}

function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

function toIsoDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Selecciona un rango de fecha y hora valido.");
  }
  return date.toISOString();
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function blockTargetLabel(
  block: SchedulingBlock,
  state: SchedulingState,
): string {
  if (block.collaboratorId) {
    return `Profesional: ${findCatalogLabel(state.collaborators, block.collaboratorId)}`;
  }
  if (block.roomId) {
    return `Consultorio: ${findCatalogLabel(state.rooms, block.roomId)}`;
  }
  return "Clinica completa";
}

function findCatalogLabel(items: readonly CatalogItem[], id: string): string {
  const item = items.find((candidate) => candidate.id === id);
  return item?.fullName ?? item?.name ?? id;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
