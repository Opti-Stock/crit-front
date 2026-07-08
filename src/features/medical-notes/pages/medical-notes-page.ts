import { listAppointments } from "../../../services/main-api/appointments";
import {
  createMedicalNote,
  listMedicalNotes,
} from "../../../services/main-api/medical-notes";
import type { AppointmentSummary, MedicalNoteSummary } from "../../../types/operational.types";
import { escapeHtml, formatDateTime, todayRange } from "../../../utils/dom";
import type { UserRole } from "../../../types/role.types";
import { sessionService } from "../../auth/services/session.service";
import { canWriteMedicalNotes } from "../../../guards/role-guard";

interface MedicalNotesState {
  appointments: AppointmentSummary[];
  notes: MedicalNoteSummary[];
  selectedPatientId: string;
  patientQuery: string;
  message: string | null;
  messageTone: "success" | "error" | null;
  isLoading: boolean;
  currentCollaboratorId: string | null;
  scopeFilter: "all" | "mine" | "area";
}

export function mountMedicalNotesPage(root: HTMLElement, role: UserRole): void {
  const session = sessionService.getSession();
  const state: MedicalNotesState = {
    appointments: [],
    notes: [],
    selectedPatientId: "",
    patientQuery: "",
    message: null,
    messageTone: null,
    isLoading: true,
    currentCollaboratorId: session?.user?.collaboratorId ?? null,
    scopeFilter: "all",
  };
  render(root, state, role);
  void load(root, state, role);
}

async function load(
  root: HTMLElement,
  state: MedicalNotesState,
  role?: UserRole,
  options: { preserveMessage?: boolean } = {},
): Promise<void> {
  try {
    const range = todayRange();
    const collaboratorId = state.currentCollaboratorId ?? undefined;
    const [appointments, notes] = await Promise.all([
      listAppointments({ pageSize: 100, from: range.from, to: range.to }),
      listMedicalNotes({
        pageSize: 100,
        collaboratorId: canWriteMedicalNotes(role ?? "admin") ? collaboratorId : undefined,
        patientId: state.selectedPatientId || undefined,
      }),
    ]);
    state.appointments = appointments.data;
    state.notes = notes.data;
    state.selectedPatientId ||= getPatients(state)[0]?.id ?? "";
    if (!options.preserveMessage) {
      state.message = null;
      state.messageTone = null;
    }
  } catch (error) {
    state.message = error instanceof Error ? error.message : "No se pudieron cargar notas.";
    state.messageTone = "error";
  } finally {
    state.isLoading = false;
    render(root, state, role ?? "admin");
  }
}

function render(root: HTMLElement, state: MedicalNotesState, role: UserRole): void {
  root.innerHTML = `
    <section class="feature-page medical-notes-page">
      <header class="feature-header">
        <div>
          <p class="app-eyebrow">Notas medicas</p>
          <h2>Historial clinico por paciente</h2>
        </div>
      </header>
      ${renderMedicalNoteAlert(state)}
      ${
        state.isLoading
          ? `<p class="empty-state">Cargando notas...</p>`
          : renderMedicalNotesChat(state, role)
      }
    </section>
  `;
  bindEvents(root, state, role);
}

function renderMedicalNoteAlert(state: MedicalNotesState): string {
  if (!state.message) return "";

  const tone = state.messageTone ?? "error";
  return `
    <p class="medical-note-alert medical-note-alert--${tone}" role="${tone === "error" ? "alert" : "status"}">
      ${escapeHtml(state.message)}
    </p>
  `;
}

function renderMedicalNotesChat(state: MedicalNotesState, role: UserRole): string {
  const allPatients = getPatients(state);
  const patients = getFilteredPatients(state, allPatients);

  if (allPatients.length === 0) {
    return `<p class="empty-state">No hay pacientes visibles para notas medicas.</p>`;
  }

  if (patients.length === 0) {
    return `
      ${renderMedicalPatientFilter(state, role)}
      <p class="empty-state">No hay pacientes que coincidan con la busqueda.</p>
    `;
  }

  const patient = patients.find((candidate) => candidate.id === state.selectedPatientId) ?? patients[0];
  const patientNotes = getScopedNotes(state)
    .filter((note) => note.patient.id === patient.id)
    .sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );
  const patientAppointments = getScopedAppointments(state).filter(
    (appointment) => appointment.patient.id === patient.id,
  );

  return `
    ${renderMedicalPatientFilter(state, role)}
    <div class="handoff-shell">
      <aside class="handoff-sidebar">
        <div class="handoff-patient-list" aria-label="Pacientes con notas medicas">
          ${patients
            .map((candidate) => {
              const activeClass =
                candidate.id === patient.id ? " handoff-patient-button--active" : "";

              return `
                <button class="handoff-patient-button${activeClass}" type="button" data-select-medical-patient="${escapeHtml(candidate.id)}">
                  <span>${escapeHtml(candidate.fullName)}</span>
                </button>
              `;
            })
            .join("")}
        </div>
      </aside>
      <section class="handoff-main">
        <div class="handoff-conversation">
          <div class="handoff-conversation__header">
            <div>
              <p class="app-eyebrow">Paciente</p>
              <h3>${escapeHtml(patient.fullName)}</h3>
            </div>
            <span class="status-pill">${patientNotes.length} notas</span>
          </div>
          ${canWriteMedicalNotes(role) ? renderForm(patientAppointments) : `<p class="hint-text">Vista de solo lectura para este rol.</p>`}
          ${
            patientNotes.length === 0
              ? `<p class="empty-state">Sin notas medicas para este paciente.</p>`
              : `<div class="handoff-thread">${patientNotes.map(renderMedicalNoteBubble).join("")}</div>`
          }
        </div>
      </section>
    </div>
  `;
}

function renderMedicalPatientFilter(state: MedicalNotesState, role: UserRole): string {
  return `
    <section class="attendance-toolbar" aria-label="Filtro de notas medicas">
      <div class="calendar-combobox-field" data-medical-patient-combobox>
        <label for="medical-patient-search">Buscar paciente</label>
        <div class="calendar-combobox">
          <input
            id="medical-patient-search"
            name="medicalPatientQuery"
            type="search"
            value="${escapeHtml(state.patientQuery)}"
            placeholder="Escribe para buscar paciente..."
            autocomplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="false"
            aria-controls="medical-patient-options"
            data-medical-patient-search
          />
          <button class="calendar-combobox__clear" type="button" data-medical-patient-clear aria-label="Limpiar paciente" ${state.patientQuery ? "" : "hidden"}>x</button>
          <div id="medical-patient-options" class="calendar-combobox__list" role="listbox"></div>
        </div>
      </div>
      ${renderMedicalCoordinatorScopeFilter(state, role)}
    </section>
  `;
}

function renderMedicalCoordinatorScopeFilter(state: MedicalNotesState, role: UserRole): string {
  if (role !== "coordinador" || !state.currentCollaboratorId) return "";

  return `
    <label>
      Alcance
      <select name="medicalScopeFilter" data-medical-scope-filter>
        <option value="all" ${state.scopeFilter === "all" ? "selected" : ""}>Todas las notas del area</option>
        <option value="mine" ${state.scopeFilter === "mine" ? "selected" : ""}>Solo mis notas/citas</option>
        <option value="area" ${state.scopeFilter === "area" ? "selected" : ""}>Solo equipo coordinado</option>
      </select>
    </label>
  `;
}

function renderForm(appointments: AppointmentSummary[]): string {
  return `
    <form class="form-panel" data-medical-note-form>
      <label>
        Cita
        <select name="appointmentId" required>
          <option value="">Selecciona una cita</option>
          ${appointments.map((appointment) => `
            <option value="${escapeHtml(appointment.id)}">
              ${escapeHtml(appointment.patient.fullName)} - ${formatDateTime(appointment.startsAt)}
            </option>
          `).join("")}
        </select>
      </label>
      <label>
        Resumen clinico
        <textarea name="summary" rows="4" required></textarea>
      </label>
      <label>
        Indicaciones
        <textarea name="instructions" rows="3"></textarea>
      </label>
      <button type="submit">Guardar nota</button>
    </form>
  `;
}

function renderMedicalNoteBubble(note: MedicalNoteSummary): string {
  return `
    <article class="handoff-message handoff-message--own" data-note-id="${escapeHtml(note.id)}">
      <div class="handoff-message__meta">
        <span>${escapeHtml(note.collaborator.fullName)}</span>
        <span>${escapeHtml(formatDateTime(note.createdAt))}</span>
      </div>
      <p class="handoff-message__text">${escapeHtml(String(note.content.summary ?? "Sin resumen"))}</p>
      <dl class="handoff-message__details">
        <div><dt>Indicaciones</dt><dd>${escapeHtml(String(note.content.instructions ?? note.content.followUp ?? "-"))}</dd></div>
        <div><dt>Formato</dt><dd>${escapeHtml(note.formatVersion)}</dd></div>
      </dl>
      <button class="secondary-action" type="button" data-print-note>Generar PDF</button>
    </article>
  `;
}

function bindEvents(root: HTMLElement, state: MedicalNotesState, role: UserRole): void {
  root.querySelector<HTMLFormElement>("[data-medical-note-form]")?.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const data = new FormData(form);
      void createNote(root, state, {
        appointmentId: String(data.get("appointmentId") ?? ""),
        summary: String(data.get("summary") ?? ""),
        instructions: String(data.get("instructions") ?? ""),
      }, role);
    },
  );

  root.querySelectorAll<HTMLButtonElement>("[data-select-medical-patient]").forEach(
    (button) => {
      button.addEventListener("click", () => {
        const patientId = button.dataset.selectMedicalPatient;
        if (!patientId) return;

        state.selectedPatientId = patientId;
        render(root, state, role);
      });
    },
  );

  root.querySelector<HTMLInputElement>("[data-medical-patient-search]")?.addEventListener(
    "input",
    (event) => {
      state.patientQuery = (event.currentTarget as HTMLInputElement).value;
      syncMedicalPatientOptions(root, state, true);
    },
  );

  root.querySelector<HTMLInputElement>("[data-medical-patient-search]")?.addEventListener(
    "focus",
    () => {
      syncMedicalPatientOptions(root, state, true);
    },
  );

  root.querySelector<HTMLElement>("[data-medical-patient-combobox]")?.addEventListener(
    "focusout",
    (event) => {
      const wrapper = event.currentTarget as HTMLElement;
      window.setTimeout(() => {
        if (!wrapper.contains(document.activeElement)) {
          syncMedicalPatientOptions(root, state, false);
        }
      });
    },
  );

  root.querySelector<HTMLSelectElement>("[data-medical-scope-filter]")?.addEventListener(
    "change",
    (event) => {
      state.scopeFilter = (event.currentTarget as HTMLSelectElement).value as MedicalNotesState["scopeFilter"];
      state.selectedPatientId = "";
      render(root, state, role);
    },
  );

  root.querySelector<HTMLElement>("[data-medical-patient-combobox]")?.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const option = target.closest<HTMLButtonElement>("[data-medical-patient-option]");
      if (option) {
        state.selectedPatientId = option.dataset.medicalPatientId ?? "";
        state.patientQuery = option.dataset.medicalPatientName ?? "";
        render(root, state, role);
        return;
      }

      const clear = target.closest<HTMLButtonElement>("[data-medical-patient-clear]");
      if (clear) {
        state.patientQuery = "";
        state.selectedPatientId = getPatients(state)[0]?.id ?? "";
        render(root, state, role);
      }
    },
  );

  root.querySelectorAll<HTMLButtonElement>("[data-print-note]").forEach((button) => {
    button.addEventListener("click", () => window.print());
  });
}

async function createNote(
  root: HTMLElement,
  state: MedicalNotesState,
  values: { appointmentId: string; summary: string; instructions: string },
  role: UserRole,
): Promise<void> {
  if (!values.appointmentId || !values.summary.trim()) {
    state.message = "Selecciona una cita y captura el resumen.";
    state.messageTone = "error";
    render(root, state, role);
    return;
  }
  try {
    await createMedicalNote({
      appointmentId: values.appointmentId,
      content: {
        summary: values.summary.trim(),
        instructions: values.instructions.trim(),
      },
      formatVersion: "1.0",
    });
    state.message = "Nota médica guardada correctamente.";
    state.messageTone = "success";
    state.isLoading = true;
    render(root, state, role);
    await load(root, state, role, { preserveMessage: true });
  } catch (error) {
    state.message = error instanceof Error ? error.message : "No se pudo guardar la nota.";
    state.messageTone = "error";
    render(root, state, role);
  }
}

function getPatients(state: MedicalNotesState): { id: string; fullName: string }[] {
  const byId = new Map<string, { id: string; fullName: string }>();

  getScopedAppointments(state).forEach((appointment) =>
    byId.set(appointment.patient.id, appointment.patient),
  );
  getScopedNotes(state).forEach((note) => byId.set(note.patient.id, note.patient));

  return [...byId.values()].sort((left, right) =>
    left.fullName.localeCompare(right.fullName, "es-MX"),
  );
}

function getFilteredPatients(
  state: MedicalNotesState,
  patients: { id: string; fullName: string }[],
): { id: string; fullName: string }[] {
  const query = normalizeText(state.patientQuery);

  if (!query) return patients;

  return patients.filter(
    (patient) =>
      normalizeText(patient.fullName).includes(query) ||
      patient.id.toLowerCase().includes(query),
  );
}

function getScopedAppointments(state: MedicalNotesState): AppointmentSummary[] {
  if (!state.currentCollaboratorId || state.scopeFilter === "all") return state.appointments;

  return state.appointments.filter((appointment) => {
    const isMine = appointment.collaborator.id === state.currentCollaboratorId;
    return state.scopeFilter === "mine" ? isMine : !isMine;
  });
}

function getScopedNotes(state: MedicalNotesState): MedicalNoteSummary[] {
  if (!state.currentCollaboratorId || state.scopeFilter === "all") return state.notes;

  return state.notes.filter((note) => {
    const isMine = note.collaborator.id === state.currentCollaboratorId;
    return state.scopeFilter === "mine" ? isMine : !isMine;
  });
}

function syncMedicalPatientOptions(root: HTMLElement, state: MedicalNotesState, forceOpen?: boolean): void {
  const input = root.querySelector<HTMLInputElement>("[data-medical-patient-search]");
  const list = root.querySelector<HTMLElement>("#medical-patient-options");
  const clear = root.querySelector<HTMLButtonElement>("[data-medical-patient-clear]");
  if (!input || !list) return;

  const isOpen = forceOpen ?? document.activeElement === input;
  input.setAttribute("aria-expanded", String(isOpen));
  clear?.toggleAttribute("hidden", !state.patientQuery);
  list.classList.toggle("calendar-combobox__list--open", isOpen);

  if (!isOpen) {
    list.innerHTML = "";
    return;
  }

  if (!state.patientQuery.trim()) {
    list.innerHTML = `<div class="calendar-combobox__state">Escribe para buscar pacientes.</div>`;
    return;
  }

  const patients = getFilteredPatients(state, getPatients(state)).slice(0, 8);
  if (patients.length === 0) {
    list.innerHTML = `<div class="calendar-combobox__state">Sin resultados.</div>`;
    return;
  }

  list.innerHTML = patients
    .map((patient) => `
      <button
        class="calendar-combobox__option"
        type="button"
        role="option"
        data-medical-patient-option
        data-medical-patient-id="${escapeHtml(patient.id)}"
        data-medical-patient-name="${escapeHtml(patient.fullName)}"
      >
        <strong>${escapeHtml(patient.fullName)}</strong>
        <span>Paciente</span>
      </button>
    `)
    .join("");
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
