import { listAppointments } from "../../../services/main-api/appointments";
import {
  createMedicalNote,
  listMedicalNotes,
} from "../../../services/main-api/medical-notes";
import type { AppointmentSummary, MedicalNoteSummary } from "../../../types/operational.types";
import { escapeHtml, formatDateTime, todayRange } from "../../../utils/dom";
import type { UserRole } from "../../../types/role.types";

interface MedicalNotesState {
  appointments: AppointmentSummary[];
  notes: MedicalNoteSummary[];
  message: string | null;
  isLoading: boolean;
}

export function mountMedicalNotesPage(root: HTMLElement, role: UserRole): void {
  if (role !== "medico" && role !== "terapeuta") {
    root.innerHTML = `<p class="inline-alert">No tienes acceso a notas medicas.</p>`;
    return;
  }

  const state: MedicalNotesState = {
    appointments: [],
    notes: [],
    message: null,
    isLoading: true,
  };
  render(root, state);
  void load(root, state);
}

async function load(root: HTMLElement, state: MedicalNotesState): Promise<void> {
  try {
    const range = todayRange();
    const [appointments, notes] = await Promise.all([
      listAppointments({ pageSize: 100, from: range.from, to: range.to }),
      listMedicalNotes({ pageSize: 50 }),
    ]);
    state.appointments = appointments.data;
    state.notes = notes.data;
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
          <h2>Captura y PDF</h2>
        </div>
      </header>
      ${state.message ? `<p class="inline-alert">${escapeHtml(state.message)}</p>` : ""}
      ${renderForm(state.appointments)}
      ${state.isLoading ? `<p class="empty-state">Cargando notas...</p>` : renderNotes(state.notes)}
    </section>
  `;
  bindEvents(root, state);
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

function renderNotes(notes: MedicalNoteSummary[]): string {
  if (notes.length === 0) return `<p class="empty-state">No hay notas visibles.</p>`;
  return `
    <div class="data-list">
      ${notes.map((note) => `
        <article class="data-card" data-note-id="${escapeHtml(note.id)}">
          <div class="data-card__header">
            <div>
              <p class="data-card__meta">${formatDateTime(note.createdAt)}</p>
              <h3>${escapeHtml(note.patient.fullName)}</h3>
            </div>
            <button type="button" data-print-note>Generar PDF</button>
          </div>
          <p>${escapeHtml(String(note.content.summary ?? "Sin resumen"))}</p>
        </article>
      `).join("")}
    </div>
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
