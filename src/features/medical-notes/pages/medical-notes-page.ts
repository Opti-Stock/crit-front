import { listAppointments } from "../../../services/main-api/appointments";
import {
  createMedicalNote,
  listMedicalNotes,
} from "../../../services/main-api/medical-notes";
import type { AppointmentSummary, MedicalNoteSummary } from "../../../types/operational.types";
import { escapeHtml, formatDateTime, todayRange } from "../../../utils/dom";
import type { UserRole } from "../../../types/role.types";
import { sessionService } from "../../auth/services/session.service";

interface MedicalNotesState {
  appointments: AppointmentSummary[];
  notes: MedicalNoteSummary[];
  selectedPatientId: string;
  message: string | null;
  isLoading: boolean;
  currentCollaboratorId: string | null;
}

export function mountMedicalNotesPage(root: HTMLElement, role: UserRole): void {
  if (role !== "medico" && role !== "terapeuta") {
    root.innerHTML = `<p class="inline-alert">No tienes acceso a notas medicas.</p>`;
    return;
  }

  const session = sessionService.getSession();
  const state: MedicalNotesState = {
    appointments: [],
    notes: [],
    selectedPatientId: "",
    message: null,
    isLoading: true,
    currentCollaboratorId: session?.user?.collaboratorId ?? null,
  };
  render(root, state);
  void load(root, state);
}

async function load(root: HTMLElement, state: MedicalNotesState): Promise<void> {
  try {
    const range = todayRange();
    const collaboratorId = state.currentCollaboratorId ?? undefined;
    const [appointments, notes] = await Promise.all([
      listAppointments({ pageSize: 100, from: range.from, to: range.to }),
      listMedicalNotes({ pageSize: 100, collaboratorId }),
    ]);
    state.appointments = appointments.data;
    state.notes = notes.data;
    state.selectedPatientId ||= getPatients(state)[0]?.id ?? "";
    state.message = null;
  } catch (error) {
    state.message = error instanceof Error ? error.message : "No se pudieron cargar notas.";
  } finally {
    state.isLoading = false;
    render(root, state);
  }
}

function render(root: HTMLElement, state: MedicalNotesState): void {
  root.innerHTML = `
    <section class="feature-page">
      <header class="feature-header">
        <div>
          <p class="app-eyebrow">Notas medicas</p>
          <h2>Historial clinico por paciente</h2>
        </div>
      </header>
      ${state.message ? `<p class="inline-alert">${escapeHtml(state.message)}</p>` : ""}
      ${
        state.isLoading
          ? `<p class="empty-state">Cargando notas...</p>`
          : renderMedicalNotesChat(state)
      }
    </section>
  `;
  bindEvents(root, state);
}

function renderMedicalNotesChat(state: MedicalNotesState): string {
  const patients = getPatients(state);

  if (patients.length === 0) {
    return `<p class="empty-state">No hay pacientes visibles para notas medicas.</p>`;
  }

  const patient = patients.find((candidate) => candidate.id === state.selectedPatientId) ?? patients[0];
  const patientNotes = state.notes
    .filter((note) => note.patient.id === patient.id)
    .sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );
  const patientAppointments = state.appointments.filter(
    (appointment) => appointment.patient.id === patient.id,
  );

  return `
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
          ${renderForm(patientAppointments)}
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

function bindEvents(root: HTMLElement, state: MedicalNotesState): void {
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
      });
    },
  );

  root.querySelectorAll<HTMLButtonElement>("[data-select-medical-patient]").forEach(
    (button) => {
      button.addEventListener("click", () => {
        const patientId = button.dataset.selectMedicalPatient;
        if (!patientId) return;

        state.selectedPatientId = patientId;
        render(root, state);
      });
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
): Promise<void> {
  if (!values.appointmentId || !values.summary.trim()) {
    state.message = "Selecciona una cita y captura el resumen.";
    render(root, state);
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
    state.isLoading = true;
    render(root, state);
    await load(root, state);
  } catch (error) {
    state.message = error instanceof Error ? error.message : "No se pudo guardar la nota.";
    render(root, state);
  }
}

function getPatients(state: MedicalNotesState): { id: string; fullName: string }[] {
  const byId = new Map<string, { id: string; fullName: string }>();

  state.appointments.forEach((appointment) =>
    byId.set(appointment.patient.id, appointment.patient),
  );
  state.notes.forEach((note) => byId.set(note.patient.id, note.patient));

  return [...byId.values()].sort((left, right) =>
    left.fullName.localeCompare(right.fullName, "es-MX"),
  );
}
