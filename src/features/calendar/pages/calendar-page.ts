import {
  createAppointment,
  listAppointments,
} from "../../../services/main-api/appointments";
import {
  listClinics,
  listCollaborators,
  listPatients,
  listRooms,
} from "../../../services/main-api/catalogs";
import { listAppointmentTypes } from "../../../services/main-api/calendar";
import type {
  AppointmentSummary,
  AppointmentTypeSummary,
  CatalogItem,
} from "../../../types/operational.types";
import { escapeHtml, formatDateTime, todayRange } from "../../../utils/dom";

interface CalendarState {
  appointments: AppointmentSummary[];
  patients: CatalogItem[];
  collaborators: CatalogItem[];
  clinics: CatalogItem[];
  rooms: CatalogItem[];
  appointmentTypes: AppointmentTypeSummary[];
  message: string | null;
  isLoading: boolean;
}

export function mountCalendarPage(root: HTMLElement): void {
  const state: CalendarState = {
    appointments: [],
    patients: [],
    collaborators: [],
    clinics: [],
    rooms: [],
    appointmentTypes: [],
    message: null,
    isLoading: true,
  };
  render(root, state);
  void load(root, state);
}

async function load(root: HTMLElement, state: CalendarState): Promise<void> {
  try {
    const range = todayRange();
    const [appointments, patients, collaborators, clinics, rooms, appointmentTypes] =
      await Promise.all([
        listAppointments({ pageSize: 100, from: range.from, to: range.to }),
        listPatients({ pageSize: 100 }),
        listCollaborators({ pageSize: 100 }),
        listClinics({ pageSize: 100 }),
        listRooms({ pageSize: 100 }),
        listAppointmentTypes(),
      ]);
    state.appointments = appointments.data;
    state.patients = patients.data;
    state.collaborators = collaborators.data;
    state.clinics = clinics.data;
    state.rooms = rooms.data;
    state.appointmentTypes = appointmentTypes;
    state.message = null;
  } catch (error) {
    state.message = error instanceof Error ? error.message : "No se pudo cargar agenda.";
  } finally {
    state.isLoading = false;
    render(root, state);
  }
}

function render(root: HTMLElement, state: CalendarState): void {
  root.innerHTML = `
    <section class="feature-page">
      <header class="feature-header">
        <div><p class="app-eyebrow">Calendario</p><h2>Agenda operativa</h2></div>
      </header>
      ${state.message ? `<p class="inline-alert">${escapeHtml(state.message)}</p>` : ""}
      ${renderForm(state)}
      ${state.isLoading ? `<p class="empty-state">Cargando agenda...</p>` : renderAppointments(state.appointments)}
      <p class="hint-text">Autosugerido de horarios queda fuera del MVP.</p>
    </section>
  `;
  bindEvents(root, state);
}

function renderForm(state: CalendarState): string {
  return `
    <form class="form-panel form-grid" data-appointment-form>
      ${selectField("patientId", "Paciente", state.patients)}
      ${selectField("collaboratorId", "Profesional", state.collaborators)}
      ${selectField("clinicId", "Clinica", state.clinics)}
      ${selectField("roomId", "Cuarto", state.rooms)}
      ${selectField("appointmentTypeId", "Tipo", state.appointmentTypes)}
      <label>Inicio<input name="startsAt" type="datetime-local" required /></label>
      <label>Fin<input name="endsAt" type="datetime-local" required /></label>
      <label>Pre sesion<input name="preSessionMinutes" type="number" min="0" value="0" /></label>
      <label>Post sesion<input name="postSessionMinutes" type="number" min="0" value="0" /></label>
      <button type="submit">Crear cita</button>
    </form>
  `;
}

function selectField(name: string, label: string, items: readonly CatalogItem[]): string {
  return `
    <label>
      ${label}
      <select name="${name}" required>
        <option value="">Selecciona</option>
        ${items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.fullName ?? item.name ?? item.id)}</option>`).join("")}
      </select>
    </label>
  `;
}

function renderAppointments(appointments: AppointmentSummary[]): string {
  if (appointments.length === 0) return `<p class="empty-state">No hay citas para hoy.</p>`;
  return `<div class="data-list">${appointments.map((appointment) => `
    <article class="data-card">
      <div class="data-card__header">
        <div><p class="data-card__meta">${formatDateTime(appointment.startsAt)}</p><h3>${escapeHtml(appointment.patient.fullName)}</h3></div>
        <span class="status-pill">${escapeHtml(appointment.status)}</span>
      </div>
      <p>${escapeHtml(appointment.collaborator.fullName)} - ${escapeHtml(appointment.clinic.name)} / ${escapeHtml(appointment.room.name)}</p>
    </article>
  `).join("")}</div>`;
}

function bindEvents(root: HTMLElement, state: CalendarState): void {
  root.querySelector<HTMLFormElement>("[data-appointment-form]")?.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget as HTMLFormElement);
      void createAppointmentFromForm(root, state, data);
    },
  );
}

async function createAppointmentFromForm(
  root: HTMLElement,
  state: CalendarState,
  data: FormData,
): Promise<void> {
  try {
    await createAppointment({
      patientId: String(data.get("patientId")),
      collaboratorId: String(data.get("collaboratorId")),
      clinicId: String(data.get("clinicId")),
      roomId: String(data.get("roomId")),
      appointmentTypeId: String(data.get("appointmentTypeId")),
      startsAt: new Date(String(data.get("startsAt"))).toISOString(),
      endsAt: new Date(String(data.get("endsAt"))).toISOString(),
      preSessionMinutes: Number(data.get("preSessionMinutes") ?? 0),
      postSessionMinutes: Number(data.get("postSessionMinutes") ?? 0),
    });
    state.isLoading = true;
    render(root, state);
    await load(root, state);
  } catch (error) {
    state.message = error instanceof Error ? error.message : "No se pudo crear la cita.";
    render(root, state);
  }
}
