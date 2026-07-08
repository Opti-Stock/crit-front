import {
  createHandoffNote,
  listHandoffNotes,
  markHandoffNoteAsRead,
} from "../../../services/main-api/handoff-notes";
import { listAppointments } from "../../../services/main-api/appointments";
import { listPatients } from "../../../services/main-api/catalogs";
import { sessionService } from "../../auth/services/session.service";
import type {
  AppointmentSummary,
  CatalogItem,
  HandoffCategory,
  HandoffNoteSummary,
} from "../../../types/operational.types";
import type { UserRole } from "../../../types/role.types";
import {
  canAccessHandoffNotes,
  canCreateHandoffNotes,
  isApRole,
} from "../../../guards/role-guard";
import { escapeHtml, formatDateTime } from "../../../utils/dom";
import {
  HANDOFF_REALTIME_CONTRACT,
  subscribeToHandoffNotesRealtime,
  type HandoffRealtimeStatus,
} from "../services/handoff-notes-realtime.service";
import {
  renderPatientCombobox,
  renderPatientComboboxOptions,
  type PatientComboboxOption,
} from "../../../components/patient-combobox";

interface HandoffFilters {
  patientQuery: string;
  unreadOnly: boolean;
  createdDate: string;
  area: string;
  category: HandoffCategory | "";
}

interface HandoffState {
  notes: HandoffNoteSummary[];
  patients: CatalogItem[];
  relatedPatientIds: Set<string>;
  ownNoteIds: Set<string>;
  selectedPatientId: string;
  focusedNoteId: string;
  message: string | null;
  saveMessage: string | null;
  saveTone: "error" | "success" | "info";
  isLoading: boolean;
  isSaving: boolean;
  realtimeStatus: HandoffRealtimeStatus;
  realtimeMessage: string | null;
  currentUserId: string | null;
  currentUserArea: string | null;
  publishAs: string | null;
  scopeFilter: "all" | "mine" | "area";
  filters: HandoffFilters;
}

const CATEGORY_OPTIONS: readonly {
  value: HandoffCategory;
  label: string;
  title: string;
}[] = [
  { value: "delay", label: "Retraso", title: "Retraso" },
  { value: "cancellation", label: "Cancelacion", title: "Cancelacion" },
  { value: "absence", label: "Inasistencia", title: "Inasistencia" },
  { value: "reschedule", label: "Reprogramacion", title: "Reprogramacion" },
  { value: "general_notice", label: "Aviso general", title: "Aviso general" },
];

let realtimeUnsubscribe: (() => void) | null = null;

export function mountHandoffNotesPage(root: HTMLElement, role: UserRole): void {
  if (realtimeUnsubscribe) {
    realtimeUnsubscribe();
    realtimeUnsubscribe = null;
  }

  const route = readRouteParams();
  const session = sessionService.getSession();
  const state: HandoffState = {
    notes: [],
    patients: [],
    relatedPatientIds: new Set(),
    ownNoteIds: new Set(),
    selectedPatientId: route.patientId,
    focusedNoteId: route.noteId,
    message: null,
    saveMessage: null,
    saveTone: "success",
    isLoading: true,
    isSaving: false,
    realtimeStatus: "unavailable",
    realtimeMessage: null,
    currentUserId: session?.user?.id ?? null,
    currentUserArea: session?.user?.area ?? null,
    publishAs: buildPublishAsLabel(session, role),
    scopeFilter: "all",
    filters: {
      patientQuery: "",
      unreadOnly: false,
      createdDate: "",
      area: "",
      category: "",
    },
  };

  if (!canAccessHandoffNotes(role)) {
    render(root, state, role);
    return;
  }

  render(root, state, role);
  realtimeUnsubscribe = subscribeToHandoffNotesRealtime({
    onNoteCreated: (event) => {
      state.notes = upsertNote(state.notes, event.note);
      if (state.selectedPatientId === event.note.patient.id) {
        state.focusedNoteId = event.note.id;
      }
      state.saveMessage = "Nueva nota recibida.";
      state.saveTone = "info";
      render(root, state, role);
      scheduleScrollToNote(root, state);
      notifyUnreadCountChanged();
    },
    onNoteRead: (event) => {
      state.notes = markNoteLocallyRead(state, event.handoffNoteId);
      render(root, state, role);
      notifyUnreadCountChanged();
    },
    onStatusChange: (status, detail) => {
      state.realtimeStatus = status;
      state.realtimeMessage = detail ?? null;
      render(root, state, role);
    },
  }).unsubscribe;

  void load(root, state, role);
}

async function load(
  root: HTMLElement,
  state: HandoffState,
  role: UserRole,
): Promise<void> {
  try {
    const [notes, patients, appointments] = await Promise.all([
      listHandoffNotes({ pageSize: 100 }),
      isApRole(role)
        ? Promise.resolve({ data: [] as CatalogItem[] })
        : listPatients({ pageSize: 100 }),
      isApRole(role)
        ? Promise.resolve({ data: [] as AppointmentSummary[] })
        : listAppointments({ pageSize: 100 }),
    ]);

    const mergedPatients = mergePatients(
      patients.data,
      notes.data,
      appointments.data,
    );

    state.notes = sortNotes(notes.data);
    state.patients = mergedPatients;
    state.relatedPatientIds = getRelatedPatientIds(notes.data, appointments.data);
    state.message = null;

    if (!state.selectedPatientId && mergedPatients.length === 1) {
      state.selectedPatientId = mergedPatients[0]?.id ?? "";
    }
  } catch (error) {
    state.message =
      error instanceof Error
        ? error.message
        : "No se pudieron cargar notas de enlace.";
  } finally {
    state.isLoading = false;
    render(root, state, role);
    scheduleScrollToNote(root, state);

    if (state.selectedPatientId) {
      void markPatientHistoryAsRead(root, state, role, state.selectedPatientId);
    }
  }
}

function render(root: HTMLElement, state: HandoffState, role: UserRole): void {
  const apClass = isApRole(role) ? " handoff-page--ap" : "";
  const selectedClass = state.selectedPatientId ? " handoff-page--has-selection" : "";

  if (!canAccessHandoffNotes(role)) {
    root.innerHTML = `
      <section class="feature-page handoff-page">
        <header class="feature-header">
          <div><p class="app-eyebrow">Notas de enlace</p><h2>Historial operativo</h2></div>
        </header>
        <p class="empty-state">No tienes permisos para visualizar notas de enlace.</p>
      </section>
    `;
    return;
  }

  root.innerHTML = `
    <section class="feature-page handoff-page${apClass}${selectedClass}">
      <header class="feature-header handoff-header">
        <div>
          <p class="app-eyebrow">Notas de enlace</p>
          <h2>Historial operativo por paciente</h2>
        </div>
        ${renderRealtimeStatus(state)}
      </header>
      ${renderMessage(state.message, "error")}
      ${renderMessage(state.saveMessage, state.saveTone)}
      <div class="handoff-shell">
        <aside class="handoff-sidebar">
          ${renderFilters(state, role)}
        </aside>
        <section class="handoff-main" aria-live="polite">
          ${renderConversation(state, role)}
        </section>
      </div>
    </section>
  `;

  bindEvents(root, state, role);
}

function renderRealtimeStatus(state: HandoffState): string {
  const label =
    state.realtimeStatus === "connected"
      ? "Tiempo real activo"
      : state.realtimeStatus === "error"
        ? "Tiempo real con error"
        : "Tiempo real pendiente";

  return `
    <span class="status-pill handoff-realtime" title="${escapeHtml(state.realtimeMessage ?? HANDOFF_REALTIME_CONTRACT)}">
      ${escapeHtml(label)}
    </span>
  `;
}

function renderMessage(message: string | null, tone: "error" | "success" | "info"): string {
  if (!message) return "";

  return `
    <p class="handoff-banner handoff-banner--${tone}" role="${tone === "error" ? "alert" : "status"}">
      ${escapeHtml(message)}
    </p>
  `;
}

function renderFilters(state: HandoffState, role: UserRole): string {
  const { filters } = state;

  return `
    <details class="handoff-filter-panel" open>
      <summary>Filtros</summary>
      <form class="handoff-filter-form" data-handoff-filter-form>
        ${renderHandoffPatientCombobox(filters.patientQuery)}
        ${renderHandoffCoordinatorScopeFilter(state, role)}
        <label>
          Lectura
          <select name="readStatus">
            <option value="" ${filters.unreadOnly ? "" : "selected"}>Todas</option>
            <option value="unread" ${filters.unreadOnly ? "selected" : ""}>No leidas</option>
          </select>
        </label>
        <label>
          Fecha
          <input type="date" name="createdDate" value="${escapeHtml(filters.createdDate)}" />
        </label>
        <label>
          Area
          <select name="area">
            <option value="">Todas</option>
            ${getAreaOptions(state).map((area) => `
              <option value="${escapeHtml(area)}" ${filters.area === area ? "selected" : ""}>
                ${escapeHtml(area)}
              </option>
            `).join("")}
          </select>
        </label>
        <label>
          Categoria
          <select name="category">
            <option value="">Todas</option>
            ${CATEGORY_OPTIONS.map((category) => `
              <option value="${category.value}" ${filters.category === category.value ? "selected" : ""}>
                ${escapeHtml(category.label)}
              </option>
            `).join("")}
          </select>
        </label>
        <div class="button-row handoff-filter-form__actions">
          <button type="submit">Aplicar</button>
          <button type="button" class="secondary-action" data-reset-handoff-filters>Limpiar</button>
        </div>
      </form>
    </details>
  `;
}

function renderPatientList(state: HandoffState, role: UserRole): string {
  const patients = getVisiblePatients(state, role);

  if (state.isLoading) {
    return `<p class="empty-state">Cargando pacientes...</p>`;
  }

  if (patients.length === 0) {
    return `<p class="empty-state">No hay pacientes disponibles para los filtros actuales.</p>`;
  }

  return `
    <div class="handoff-patient-list" aria-label="Pacientes">
      ${patients.map((patient) => {
        const selectedClass =
          patient.id === state.selectedPatientId ? " handoff-patient-button--active" : "";
        const unreadCount = getPatientUnreadCount(state, patient.id);
        const relatedClass = state.relatedPatientIds.has(patient.id)
          ? " handoff-patient-button--related"
          : "";

        return `
          <button class="handoff-patient-button${selectedClass}${relatedClass}" type="button" data-select-handoff-patient="${escapeHtml(patient.id)}">
            <span>${escapeHtml(getPatientName(patient))}</span>
            ${unreadCount > 0 ? `<strong>${unreadCount > 9 ? "9+" : unreadCount}</strong>` : ""}
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderHandoffCoordinatorScopeFilter(state: HandoffState, role: UserRole): string {
  if (role !== "coordinador" || !state.currentUserId) return "";

  return `
    <label>
      Alcance
      <select name="handoffScopeFilter" data-handoff-scope-filter>
        <option value="all" ${state.scopeFilter === "all" ? "selected" : ""}>Todas las notas del area</option>
        <option value="mine" ${state.scopeFilter === "mine" ? "selected" : ""}>Solo mis notas</option>
        <option value="area" ${state.scopeFilter === "area" ? "selected" : ""}>Solo equipo coordinado</option>
      </select>
    </label>
  `;
}

function renderHandoffPatientCombobox(query: string): string {
  return renderPatientCombobox({
    id: "handoff-patient-search",
    label: "Paciente",
    query,
    placeholder: "Escribe para buscar paciente",
    isOpen: false,
    options: [],
    searchDataAttribute: "data-handoff-patient-search",
    clearDataAttribute: "data-handoff-patient-clear",
    optionDataAttribute: "data-handoff-patient-option",
    optionIdDataAttribute: "data-handoff-patient-id",
  });
}

function renderConversation(state: HandoffState, role: UserRole): string {
  if (state.isLoading) {
    return `<p class="empty-state">Cargando historial...</p>`;
  }

  if (!state.selectedPatientId && state.filters.patientQuery.trim()) {
    return renderPatientList(state, role);
  }

  if (!state.selectedPatientId) {
    const notes = getFilteredNotes(state, role);
    if (notes.length === 0) {
      return `<p class="empty-state">No hay notas de enlace visibles para los filtros actuales.</p>`;
    }

    return `
      <div class="handoff-conversation">
        <div class="handoff-conversation__header">
          <div>
            <p class="app-eyebrow">Todas las notas permitidas</p>
            <h3>Historial de enlace</h3>
          </div>
          <span class="status-pill">${notes.length} notas</span>
        </div>
        <div class="handoff-thread" data-handoff-thread>${notes.map((note) => renderNote(note, state, role)).join("")}</div>
      </div>
    `;
  }

  const patient = findPatient(state, state.selectedPatientId);
  const notes = getFilteredNotes(state, role).filter(
    (note) => note.patient.id === state.selectedPatientId,
  );

  return `
    <div class="handoff-conversation">
      <div class="handoff-conversation__header">
        ${
          isApRole(role)
            ? `<button class="text-action handoff-mobile-back" type="button" data-handoff-back-to-patients>Volver a pacientes</button>`
            : ""
        }
        <div>
          <p class="app-eyebrow">Paciente</p>
          <h3>${escapeHtml(patient ? getPatientName(patient) : "Paciente seleccionado")}</h3>
        </div>
        <span class="status-pill">${notes.length} notas</span>
      </div>
      ${
        notes.length === 0
          ? `<p class="empty-state">Sin notas para este paciente con los filtros actuales.</p>`
          : `<div class="handoff-thread" data-handoff-thread>${notes.map((note) => renderNote(note, state, role)).join("")}</div>`
      }
      ${canCreateHandoffNotes(role) ? renderCreateForm(state, role) : ""}
    </div>
  `;
}

function renderCreateForm(state: HandoffState, role: UserRole): string {
  const patients = getAllowedPatientsForNewNote(state, role);
  const selectedPatient = state.selectedPatientId ? findPatient(state, state.selectedPatientId) : null;

  if (patients.length === 0) {
    return `<p class="empty-state">No hay pacientes relacionados disponibles para crear una nota.</p>`;
  }

  return `
    <form class="handoff-create-form" data-handoff-form>
      ${state.publishAs ? `<p class="handoff-publish-as">Publicar como: ${escapeHtml(state.publishAs)}</p>` : ""}
      <div class="handoff-create-form__grid">
        ${
          selectedPatient
            ? `
              <label>
                Paciente
                <input value="${escapeHtml(getPatientName(selectedPatient))}" disabled />
                <input type="hidden" name="patientId" value="${escapeHtml(selectedPatient.id)}" />
              </label>
            `
            : `
              <label>
                Paciente
                <select name="patientId" required>
                  <option value="">Selecciona</option>
                  ${patients.map((patient) => `
                    <option value="${escapeHtml(patient.id)}">
                      ${escapeHtml(getPatientName(patient))}
                    </option>
                  `).join("")}
                </select>
              </label>
            `
        }
        <label>
          Categoria
          <select name="category" required>
            <option value="">Selecciona</option>
            ${CATEGORY_OPTIONS.map((category) => `
              <option value="${category.value}">${escapeHtml(category.label)}</option>
            `).join("")}
          </select>
        </label>
      </div>
      <label>
        Texto
        <textarea name="content" maxlength="1200" rows="4" required></textarea>
      </label>
      <button type="submit" ${state.isSaving ? "disabled" : ""}>
        ${state.isSaving ? "Guardando..." : "Guardar nota"}
      </button>
    </form>
  `;
}

function renderNote(
  note: HandoffNoteSummary,
  state: HandoffState,
  role: UserRole,
): string {
  const category = getNoteCategory(note);
  const isOwn = isOwnNote(note, state);
  const unread = isUnreadForCurrentUser(note, state.currentUserId);
  const classes = [
    "handoff-message",
    isOwn ? "handoff-message--own" : "handoff-message--other",
    unread ? "handoff-message--unread" : "",
    state.focusedNoteId === note.id ? "handoff-message--focused" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <article class="${classes}" data-handoff-note-id="${escapeHtml(note.id)}">
      <div class="handoff-message__meta">
        <span>${escapeHtml(category.label)}</span>
        <span>${escapeHtml(formatDateTime(note.createdAt))}</span>
      </div>
      <p class="handoff-message__text">${escapeHtml(note.content)}</p>
      <dl class="handoff-message__details">
        <div><dt>Paciente</dt><dd>${escapeHtml(note.patient.fullName)}</dd></div>
        <div><dt>Autor</dt><dd>${escapeHtml(note.createdBy.fullName)}</dd></div>
        <div><dt>Rol / area</dt><dd>${escapeHtml(getAuthorRoleArea(note, state, role))}</dd></div>
        <div><dt>Lectura</dt><dd>${escapeHtml(unread ? "No leida" : "Leida")}</dd></div>
      </dl>
    </article>
  `;
}

function bindEvents(root: HTMLElement, state: HandoffState, role: UserRole): void {
  root.querySelector<HTMLFormElement>("[data-handoff-filter-form]")?.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget as HTMLFormElement);
      state.filters = readFilters(data, role);
      if (state.selectedPatientId && state.filters.patientQuery.trim()) {
        const selected = findPatient(state, state.selectedPatientId);
        if (selected && !normalizeText(getPatientName(selected)).includes(normalizeText(state.filters.patientQuery))) {
          state.selectedPatientId = "";
          state.focusedNoteId = "";
        }
      }
      render(root, state, role);
      scheduleScrollToNote(root, state);
    },
  );

  root.querySelector<HTMLInputElement>("[data-handoff-patient-search]")?.addEventListener(
    "focus",
    () => syncHandoffPatientOptions(root, state, role, true),
  );

  root.querySelector<HTMLSelectElement>("[data-handoff-scope-filter]")?.addEventListener(
    "change",
    (event) => {
      state.scopeFilter = (event.currentTarget as HTMLSelectElement).value as HandoffState["scopeFilter"];
      state.selectedPatientId = "";
      state.focusedNoteId = "";
      refreshHandoffMain(root, state, role);
    },
  );

  root.querySelector<HTMLInputElement>("[data-handoff-patient-search]")?.addEventListener(
    "input",
    (event) => {
      state.filters.patientQuery = (event.currentTarget as HTMLInputElement).value.trim();
      state.selectedPatientId = "";
      state.focusedNoteId = "";
      syncHandoffPatientOptions(root, state, role);
      refreshHandoffMain(root, state, role);
    },
  );

  root.querySelector<HTMLElement>("[data-handoff-patient-combobox]")?.addEventListener(
    "focusout",
    (event) => {
      const wrapper = event.currentTarget as HTMLElement;
      window.setTimeout(() => {
        if (!wrapper.contains(document.activeElement)) {
          syncHandoffPatientOptions(root, state, role, false);
        }
      });
    },
  );

  root.querySelector<HTMLElement>("[data-handoff-patient-combobox]")?.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const option = target.closest<HTMLButtonElement>("[data-handoff-patient-option]");
      if (option) {
        const patientId = option.dataset.handoffPatientId;
        const patientName = option.dataset.patientOptionLabel ?? "";
        if (!patientId) return;
        state.filters.patientQuery = patientName;
        state.selectedPatientId = patientId;
        state.focusedNoteId = "";
        const input = root.querySelector<HTMLInputElement>("[data-handoff-patient-search]");
        if (input) input.value = patientName;
        syncHandoffPatientOptions(root, state, role, false);
        refreshHandoffMain(root, state, role);
        void markPatientHistoryAsRead(root, state, role, patientId);
        return;
      }
      const clear = target.closest<HTMLButtonElement>("[data-handoff-patient-clear]");
      if (clear) {
        state.filters.patientQuery = "";
        state.selectedPatientId = "";
        state.focusedNoteId = "";
        const input = root.querySelector<HTMLInputElement>("[data-handoff-patient-search]");
        if (input) input.value = "";
        syncHandoffPatientOptions(root, state, role, false);
        refreshHandoffMain(root, state, role);
      }
    },
  );

  root.querySelector<HTMLFormElement>("[data-handoff-filter-form]")?.addEventListener(
    "change",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
        return;
      }
      const form = target.form;
      if (!form) return;
      state.filters = readFilters(new FormData(form), role);
      render(root, state, role);
    },
  );

  root.querySelector<HTMLButtonElement>("[data-reset-handoff-filters]")?.addEventListener(
    "click",
    () => {
      state.filters = {
        patientQuery: "",
        unreadOnly: false,
        createdDate: "",
        area: "",
        category: "",
      };
      render(root, state, role);
      scheduleScrollToNote(root, state);
    },
  );

  root.querySelectorAll<HTMLButtonElement>("[data-select-handoff-patient]").forEach(
    (button) => {
      button.addEventListener("click", () => {
        const patientId = button.dataset.selectHandoffPatient;
        if (!patientId) return;

        state.selectedPatientId = patientId;
        state.focusedNoteId = "";
        state.saveMessage = null;
        state.saveTone = "success";
        render(root, state, role);
        scheduleScrollToNote(root, state);
        void markPatientHistoryAsRead(root, state, role, patientId);
      });
    },
  );

  root.querySelector<HTMLButtonElement>("[data-handoff-back-to-patients]")?.addEventListener(
    "click",
    () => {
      state.selectedPatientId = "";
      state.focusedNoteId = "";
      state.saveMessage = null;
      state.saveTone = "success";
      render(root, state, role);
    },
  );

  root.querySelector<HTMLFormElement>("[data-handoff-form]")?.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget as HTMLFormElement);
      void submitHandoff(root, state, role, data);
    },
  );
}

function refreshHandoffMain(root: HTMLElement, state: HandoffState, role: UserRole): void {
  const main = root.querySelector<HTMLElement>(".handoff-main");
  if (!main) return;
  main.innerHTML = renderConversation(state, role);
  bindHandoffConversationEvents(root, state, role);
  scheduleScrollToNote(root, state);
}

function bindHandoffConversationEvents(root: HTMLElement, state: HandoffState, role: UserRole): void {
  root.querySelectorAll<HTMLButtonElement>("[data-select-handoff-patient]").forEach(
    (button) => {
      button.addEventListener("click", () => {
        const patientId = button.dataset.selectHandoffPatient;
        if (!patientId) return;
        const patient = findPatient(state, patientId);
        state.selectedPatientId = patientId;
        state.filters.patientQuery = patient ? getPatientName(patient) : state.filters.patientQuery;
        state.focusedNoteId = "";
        state.saveMessage = null;
        state.saveTone = "success";
        const input = root.querySelector<HTMLInputElement>("[data-handoff-patient-search]");
        if (input) input.value = state.filters.patientQuery;
        refreshHandoffMain(root, state, role);
        void markPatientHistoryAsRead(root, state, role, patientId);
      });
    },
  );

  root.querySelector<HTMLButtonElement>("[data-handoff-back-to-patients]")?.addEventListener(
    "click",
    () => {
      state.selectedPatientId = "";
      state.focusedNoteId = "";
      state.saveMessage = null;
      state.saveTone = "success";
      refreshHandoffMain(root, state, role);
    },
  );

  root.querySelector<HTMLFormElement>("[data-handoff-form]")?.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget as HTMLFormElement);
      void submitHandoff(root, state, role, data);
    },
  );
}

async function submitHandoff(
  root: HTMLElement,
  state: HandoffState,
  role: UserRole,
  data: FormData,
): Promise<void> {
  const patientId = String(data.get("patientId") ?? "");
  const category = String(data.get("category") ?? "") as HandoffCategory;
  const content = String(data.get("content") ?? "").trim();
  const validationMessage = validateNewNote(state, role, patientId, category, content);

  if (validationMessage) {
    state.saveMessage = validationMessage;
    state.saveTone = "error";
    render(root, state, role);
    return;
  }

  state.isSaving = true;
  state.saveMessage = null;
  render(root, state, role);

  try {
    const created = await createHandoffNote({
      patientId,
      title: getCategoryTitle(category),
      content,
      recipientUserIds: resolveRecipientUserIds(state, patientId),
    });

    state.notes = sortNotes(upsertNote(state.notes, created));
    state.ownNoteIds.add(created.id);
    state.selectedPatientId = patientId;
    state.focusedNoteId = created.id;
    state.saveMessage = "Nota guardada correctamente.";
    state.saveTone = "success";
    notifyUnreadCountChanged();
  } catch (error) {
    state.saveMessage =
      error instanceof Error ? error.message : "No se pudo guardar la nota.";
    state.saveTone = "error";
  } finally {
    state.isSaving = false;
    render(root, state, role);
    scheduleScrollToNote(root, state);
  }
}

async function markPatientHistoryAsRead(
  root: HTMLElement,
  state: HandoffState,
  role: UserRole,
  patientId: string,
): Promise<void> {
  const unreadNotes = state.notes.filter(
    (note) =>
      note.patient.id === patientId &&
      isUnreadForCurrentUser(note, state.currentUserId),
  );

  if (unreadNotes.length === 0) {
    return;
  }

  const results = await Promise.allSettled(
    unreadNotes.map((note) => markHandoffNoteAsRead(note.id)),
  );
  const updatedNotes = results
    .map((result) => (result.status === "fulfilled" ? result.value : null))
    .filter((note): note is HandoffNoteSummary => Boolean(note));

  if (updatedNotes.length > 0) {
    const updatedById = new Map(updatedNotes.map((note) => [note.id, note]));

    state.notes = sortNotes(
      state.notes.map((note) => {
        return updatedById.get(note.id) ?? note;
      }),
    );
    notifyUnreadCountChanged();
  }

  if (results.some((result) => result.status === "rejected")) {
    state.message = "No se pudieron marcar todas las notas como leidas.";
  }

  render(root, state, role);
  scheduleScrollToNote(root, state);
}

function readFilters(data: FormData, role: UserRole): HandoffFilters {
  return {
    patientQuery: String(data.get("patientQuery") ?? "").trim(),
    unreadOnly: String(data.get("readStatus") ?? "") === "unread",
    createdDate: String(data.get("createdDate") ?? "").trim(),
    area: String(data.get("area") ?? "").trim(),
    category: String(data.get("category") ?? "") as HandoffCategory | "",
  };
}

function validateNewNote(
  state: HandoffState,
  role: UserRole,
  patientId: string,
  category: HandoffCategory,
  content: string,
): string | null {
  const allowedPatientIds = new Set(
    getAllowedPatientsForNewNote(state, role).map((patient) => patient.id),
  );

  if (!patientId || !allowedPatientIds.has(patientId)) {
    return "Selecciona un paciente permitido.";
  }

  if (!CATEGORY_OPTIONS.some((option) => option.value === category)) {
    return "Selecciona una categoria valida.";
  }

  if (!content) {
    return "Escribe el texto de la nota.";
  }

  return null;
}

function getVisiblePatients(state: HandoffState, role: UserRole): CatalogItem[] {
  const query = normalizeText(state.filters.patientQuery);
  const allowedPatients = isApRole(role) ? getAllowedPatientsForNewNote(state, role) : state.patients;
  const filteredPatientIds = hasNoteScopedFilters(state)
    ? new Set(getFilteredNotes(state, role).map((note) => note.patient.id))
    : null;

  return allowedPatients.filter((patient) => {
    const patientName = normalizeText(getPatientName(patient));
    const patientFolio = normalizeText(patient.folio ?? "");
    const matchesQuery =
      !query ||
      patientName.includes(query) ||
      patientFolio.includes(query) ||
      normalizeText(patient.id).includes(query);
    const matchesNoteFilters = !filteredPatientIds || filteredPatientIds.has(patient.id);
    return matchesQuery && matchesNoteFilters;
  });
}

function syncHandoffPatientOptions(
  root: HTMLElement,
  state: HandoffState,
  role: UserRole,
  forceOpen?: boolean,
): void {
  const input = root.querySelector<HTMLInputElement>("[data-handoff-patient-search]");
  const list = root.querySelector<HTMLElement>("#handoff-patient-search-options");
  const clear = root.querySelector<HTMLButtonElement>("[data-handoff-patient-clear]");
  if (!input || !list) return;

  const isOpen = forceOpen ?? document.activeElement === input;
  input.setAttribute("aria-expanded", String(isOpen));
  clear?.toggleAttribute("hidden", !state.filters.patientQuery);
  list.classList.toggle("calendar-combobox__list--open", isOpen);

  if (!isOpen) {
    list.innerHTML = "";
    return;
  }

  const patients: PatientComboboxOption[] = getVisiblePatients(state, role)
    .slice(0, 8)
    .map((patient) => ({
      ...patient,
      badge: state.relatedPatientIds.has(patient.id) ? "Relacionado" : "Paciente",
    }));

  list.innerHTML = renderPatientComboboxOptions({
    id: "handoff-patient-search",
    label: "Paciente",
    query: state.filters.patientQuery,
    placeholder: "Escribe para buscar paciente",
    isOpen,
    options: patients,
    searchDataAttribute: "data-handoff-patient-search",
    clearDataAttribute: "data-handoff-patient-clear",
    optionDataAttribute: "data-handoff-patient-option",
    optionIdDataAttribute: "data-handoff-patient-id",
  }, "handoff-patient-search-options");
}

function getAllowedPatientsForNewNote(
  state: HandoffState,
  role: UserRole,
): CatalogItem[] {
  if (isApRole(role)) {
    return state.patients.filter((patient) => state.relatedPatientIds.has(patient.id));
  }

  if (state.relatedPatientIds.size === 0) {
    return state.patients;
  }

  return state.patients.filter((patient) => state.relatedPatientIds.has(patient.id));
}

function getFilteredNotes(
  state: HandoffState,
  role: UserRole,
): HandoffNoteSummary[] {
  return state.notes.filter((note) => {
    if (state.scopeFilter === "mine" && !isOwnNote(note, state)) {
      return false;
    }

    if (state.scopeFilter === "area" && isOwnNote(note, state)) {
      return false;
    }

    if (state.filters.unreadOnly && !isUnreadForCurrentUser(note, state.currentUserId)) {
      return false;
    }

    if (state.filters.category && getNoteCategory(note).value !== state.filters.category) {
      return false;
    }

    if (
      state.filters.area &&
      normalizeText(getNoteArea(note, state)) !== normalizeText(state.filters.area)
    ) {
      return false;
    }

    if (
      state.filters.createdDate &&
      toDateInputKey(note.createdAt) !== state.filters.createdDate
    ) {
      return false;
    }

    return true;
  });
}

function hasNoteScopedFilters(state: HandoffState): boolean {
  return Boolean(
    state.filters.unreadOnly ||
      state.filters.createdDate ||
      state.filters.area ||
      state.filters.category,
  );
}

function toDateInputKey(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mergePatients(
  patients: readonly CatalogItem[],
  notes: readonly HandoffNoteSummary[],
  appointments: readonly AppointmentSummary[],
): CatalogItem[] {
  const byId = new Map<string, CatalogItem>();

  patients.forEach((patient) => byId.set(patient.id, patient));
  notes.forEach((note) =>
    byId.set(note.patient.id, {
      id: note.patient.id,
      fullName: note.patient.fullName,
    }),
  );
  appointments.forEach((appointment) =>
    byId.set(appointment.patient.id, {
      id: appointment.patient.id,
      fullName: appointment.patient.fullName,
    }),
  );

  return [...byId.values()].sort((left, right) =>
    getPatientName(left).localeCompare(getPatientName(right), "es-MX"),
  );
}

function getRelatedPatientIds(
  notes: readonly HandoffNoteSummary[],
  appointments: readonly AppointmentSummary[],
): Set<string> {
  return new Set([
    ...notes.map((note) => note.patient.id),
    ...appointments.map((appointment) => appointment.patient.id),
  ]);
}

function getPatientUnreadCount(state: HandoffState, patientId: string): number {
  return state.notes.filter(
    (note) =>
      note.patient.id === patientId &&
      isUnreadForCurrentUser(note, state.currentUserId),
  ).length;
}

function isUnreadForCurrentUser(
  note: HandoffNoteSummary,
  currentUserId: string | null,
): boolean {
  if (currentUserId) {
    const currentRecipient = note.recipients.find(
      (recipient) => recipient.userId === currentUserId,
    );

    if (currentRecipient) {
      return !currentRecipient.readAt;
    }

    return false;
  }

  return note.status === "pending";
}

function isOwnNote(note: HandoffNoteSummary, state: HandoffState): boolean {
  return (
    state.ownNoteIds.has(note.id) ||
    Boolean(state.currentUserId && note.createdBy.id === state.currentUserId)
  );
}

function markNoteLocallyRead(
  state: HandoffState,
  handoffNoteId: string,
): HandoffNoteSummary[] {
  return state.notes.map((note) =>
    note.id === handoffNoteId ? markNoteReadFallback(state, note) : note,
  );
}

function markNoteReadFallback(
  state: HandoffState,
  note: HandoffNoteSummary,
): HandoffNoteSummary {
  return {
    ...note,
    status: "read",
    recipients: note.recipients.map((recipient) =>
      recipient.userId === state.currentUserId
        ? { ...recipient, readAt: recipient.readAt ?? new Date().toISOString() }
        : recipient,
    ),
  };
}

function resolveRecipientUserIds(state: HandoffState, patientId: string): string[] {
  const recipientIds = new Set<string>();

  state.notes
    .filter((note) => note.patient.id === patientId)
    .forEach((note) => {
      note.recipients.forEach((recipient) => recipientIds.add(recipient.userId));

      if (note.createdBy.id !== state.currentUserId) {
        recipientIds.add(note.createdBy.id);
      }
    });

  if (state.currentUserId) {
    recipientIds.delete(state.currentUserId);
  }

  return [...recipientIds];
}

function upsertNote(
  notes: readonly HandoffNoteSummary[],
  incoming: HandoffNoteSummary,
): HandoffNoteSummary[] {
  const existingIndex = notes.findIndex((note) => note.id === incoming.id);

  if (existingIndex === -1) {
    return sortNotes([...notes, incoming]);
  }

  return sortNotes(
    notes.map((note) => (note.id === incoming.id ? incoming : note)),
  );
}

function sortNotes(notes: readonly HandoffNoteSummary[]): HandoffNoteSummary[] {
  return [...notes].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
}

function getNoteCategory(note: HandoffNoteSummary): {
  value: HandoffCategory;
  label: string;
} {
  if (note.category) {
    const category = CATEGORY_OPTIONS.find((option) => option.value === note.category);

    if (category) {
      return { value: category.value, label: category.label };
    }
  }

  const normalizedTitle = normalizeText(note.title);
  const category =
    CATEGORY_OPTIONS.find((option) =>
      normalizedTitle.includes(normalizeText(option.title)),
    ) ?? CATEGORY_OPTIONS[CATEGORY_OPTIONS.length - 1];

  return {
    value: category.value,
    label: category.label,
  };
}

function getCategoryTitle(category: HandoffCategory): string {
  return (
    CATEGORY_OPTIONS.find((option) => option.value === category)?.title ??
    "Aviso general"
  );
}

function getAuthorRoleArea(
  note: HandoffNoteSummary,
  state: HandoffState,
  role: UserRole,
): string {
  const authorRole = note.createdBy.role
    ? formatRoleLabel(note.createdBy.role)
    : isOwnNote(note, state)
      ? formatRoleLabel(role)
      : "Rol no disponible";
  const area = getNoteArea(note, state) || "Area no disponible";
  return `${authorRole} / ${area}`;
}

function getNoteArea(note: HandoffNoteSummary, state?: HandoffState): string {
  return (
    note.area ??
    note.createdBy.area ??
    (state && isOwnNote(note, state) ? state.currentUserArea ?? "" : "")
  );
}

function getAreaOptions(state: HandoffState): string[] {
  const areas = new Set<string>();

  if (state.currentUserArea) {
    areas.add(state.currentUserArea);
  }

  state.notes.forEach((note) => {
    const area = getNoteArea(note, state);

    if (area) {
      areas.add(area);
    }
  });

  return [...areas].sort((left, right) => left.localeCompare(right, "es-MX"));
}

function buildPublishAsLabel(
  session: ReturnType<typeof sessionService.getSession>,
  role: UserRole,
): string | null {
  if (!session?.user?.id) {
    return null;
  }

  const name = session.user.fullName ?? session.user.email ?? session.user.id;
  const roleArea = [formatRoleLabel(role), session.user.area]
    .filter((value): value is string => Boolean(value))
    .join("/");

  return roleArea ? `${name} - ${roleArea}` : name;
}

function formatRoleLabel(role: string): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "direccion":
      return "Direccion";
    case "recepcion":
      return "Recepcion";
    case "coordinador":
      return "Coordinador";
    case "medico":
      return "Medico";
    case "terapeuta":
      return "Terapeuta";
    case "personal_acompanamiento":
      return "Personal de acompanamiento";
    case "paciente_familia":
      return "Paciente/familia";
    default:
      return role;
  }
}

function getPatientName(patient: CatalogItem): string {
  return patient.fullName ?? patient.name ?? patient.id;
}

function findPatient(state: HandoffState, patientId: string): CatalogItem | null {
  return state.patients.find((patient) => patient.id === patientId) ?? null;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function readRouteParams(): { patientId: string; noteId: string } {
  const [, query = ""] = window.location.hash.split("?");
  const params = new URLSearchParams(query);

  return {
    patientId: params.get("patientId") ?? "",
    noteId: params.get("noteId") ?? params.get("handoffNoteId") ?? "",
  };
}

function scheduleScrollToNote(root: HTMLElement, state: HandoffState): void {
  window.requestAnimationFrame(() => {
    const thread = root.querySelector<HTMLElement>("[data-handoff-thread]");
    const target = state.focusedNoteId
      ? [...root.querySelectorAll<HTMLElement>("[data-handoff-note-id]")].find(
          (element) => element.dataset.handoffNoteId === state.focusedNoteId,
        )
      : null;

    if (target) {
      target.scrollIntoView({ block: "center" });
      return;
    }

    if (thread) {
      thread.scrollTop = thread.scrollHeight;
    }
  });
}

function notifyUnreadCountChanged(): void {
  window.dispatchEvent(new CustomEvent("handoff-notes:unread-count-changed"));
}
