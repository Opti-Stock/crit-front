import {
  createAttendance,
  listAttendance,
  updateAttendanceStatus,
} from "../../../services/main-api/attendance";
import { listAppointments } from "../../../services/main-api/appointments";
import {
  ATTENDANCE_STATUSES,
  type AppointmentSummary,
  type AttendanceStatus,
  type AttendanceSummary,
} from "../../../types/operational.types";
import { escapeHtml, formatDateTime, todayRange } from "../../../utils/dom";
import type { UserRole } from "../../../types/role.types";

interface AttendanceViewModel {
  appointment: AppointmentSummary;
  attendance: AttendanceSummary | null;
}

interface AttendanceState {
  isLoading: boolean;
  message: string | null;
  rows: AttendanceViewModel[];
}

type AttendanceVisualStatus = AttendanceStatus | "scheduled";

const STATUS_LABELS: Record<AttendanceVisualStatus, string> = {
  scheduled: "Programada",
  present: "Asistencia",
  absent: "Inasistencia",
  cancelled: "Cancelada",
  rescheduled: "Reprogramada",
};

export function mountAttendancePage(root: HTMLElement, role: UserRole): void {
  const state: AttendanceState = {
    isLoading: true,
    message: null,
    rows: [],
  };

  render(root, state, role);
  void load(root, state, role);
}

async function load(
  root: HTMLElement,
  state: AttendanceState,
  role: UserRole,
): Promise<void> {
  const range = todayRange();

  try {
    const [appointments, attendance] = await Promise.all([
      listAppointments({ pageSize: 100, from: range.from, to: range.to }),
      listAttendance({ pageSize: 100, from: range.from, to: range.to }),
    ]);
    const attendanceByAppointment = new Map(
      attendance.data.map((record) => [record.appointmentId, record]),
    );

    state.rows = appointments.data.map((appointment) => ({
      appointment,
      attendance: attendanceByAppointment.get(appointment.id) ?? null,
    }));
    state.message = null;
  } catch (error) {
    state.message = getErrorMessage(error);
  } finally {
    state.isLoading = false;
    render(root, state, role);
  }
}

function render(root: HTMLElement, state: AttendanceState, role: UserRole): void {
  root.innerHTML = `
    <section class="feature-page">
      <header class="feature-header">
        <div>
          <p class="app-eyebrow">Asistencias</p>
          <h2>Citas de hoy</h2>
        </div>
      </header>
      ${state.message ? `<p class="inline-alert">${escapeHtml(state.message)}</p>` : ""}
      ${
        state.isLoading
          ? `<p class="empty-state">Cargando citas y asistencias...</p>`
          : renderRows(state.rows, role)
      }
    </section>
  `;

  bindEvents(root, state, role);
}

function renderRows(rows: AttendanceViewModel[], role: UserRole): string {
  if (rows.length === 0) {
    return `<p class="empty-state">No hay citas visibles para hoy.</p>`;
  }

  return `
    <div class="data-list">
      ${rows.map((row) => renderRow(row, role)).join("")}
    </div>
  `;
}

function renderRow(row: AttendanceViewModel, role: UserRole): string {
  const attendanceStatus: AttendanceVisualStatus =
    row.attendance?.status ?? "scheduled";
  const canRegister = !row.attendance && (role === "medico" || role === "terapeuta");
  const canPrepareEdit = Boolean(row.attendance);

  return `
    <article class="data-card" data-appointment-id="${escapeHtml(row.appointment.id)}" data-attendance-id="${escapeHtml(row.attendance?.id ?? "")}">
      <div class="data-card__header">
        <div>
          <p class="data-card__meta">${formatDateTime(row.appointment.startsAt)}</p>
          <h3>${escapeHtml(row.appointment.patient.fullName)}</h3>
        </div>
        <span class="status-pill status-pill--${attendanceStatus}">
          ${STATUS_LABELS[attendanceStatus]}
        </span>
      </div>
      <dl class="detail-grid">
        <div><dt>Profesional</dt><dd>${escapeHtml(row.appointment.collaborator.fullName)}</dd></div>
        <div><dt>Servicio</dt><dd>${escapeHtml(row.appointment.appointmentType.name)}</dd></div>
        <div><dt>Clinica</dt><dd>${escapeHtml(row.appointment.clinic.name)}</dd></div>
        <div><dt>Cuarto</dt><dd>${escapeHtml(row.appointment.room.name)}</dd></div>
        <div><dt>Estado de cita</dt><dd>${escapeHtml(row.appointment.status)}</dd></div>
        <div><dt>Nota medica</dt><dd>Separada de asistencia</dd></div>
      </dl>
      <div class="form-row">
        <label>
          Estado de asistencia
          <select data-attendance-status>
            ${ATTENDANCE_STATUSES.map(
              (status) => `
                <option value="${status}" ${status === attendanceStatus ? "selected" : ""}>
                  ${STATUS_LABELS[status]}
                </option>
              `,
            ).join("")}
          </select>
        </label>
        <label class="checkbox-row">
          <input type="checkbox" data-notes-required />
          Nota medica requerida
        </label>
      </div>
      <div class="button-row">
        ${
          canRegister
            ? `<button type="button" data-register-attendance>Registrar asistencia</button>`
            : ""
        }
        ${
          canPrepareEdit
            ? `<button type="button" data-edit-attendance>Editar</button>`
            : ""
        }
      </div>
      ${
        canPrepareEdit
          ? `<p class="hint-text">La edicion queda preparada para el futuro PATCH de crit-api; no se enviara una ruta inexistente.</p>`
          : ""
      }
    </article>
  `;
}

function bindEvents(root: HTMLElement, state: AttendanceState, role: UserRole): void {
  root.querySelectorAll<HTMLButtonElement>("[data-register-attendance]").forEach(
    (button) => {
      button.addEventListener("click", () => {
        const card = button.closest<HTMLElement>("[data-appointment-id]");
        if (!card) return;
        void registerAttendance(root, state, role, card);
      });
    },
  );

  root.querySelectorAll<HTMLButtonElement>("[data-edit-attendance]").forEach(
    (button) => {
      button.addEventListener("click", () => {
        const card = button.closest<HTMLElement>("[data-appointment-id]");
        const status = card?.querySelector<HTMLSelectElement>(
          "[data-attendance-status]",
        )?.value as AttendanceStatus | undefined;
        void updateAttendanceStatus().catch((error: unknown) => {
          state.message =
            error instanceof Error
              ? error.message
              : "La edicion de asistencia esta pendiente de API.";
          render(root, state, role);
        });
      });
    },
  );
}

async function registerAttendance(
  root: HTMLElement,
  state: AttendanceState,
  role: UserRole,
  card: HTMLElement,
): Promise<void> {
  const appointmentId = card.dataset.appointmentId;
  const status = card.querySelector<HTMLSelectElement>(
    "[data-attendance-status]",
  )?.value as AttendanceStatus | undefined;
  const notesRequired = Boolean(
    card.querySelector<HTMLInputElement>("[data-notes-required]")?.checked,
  );

  if (!appointmentId || !status) {
    state.message = "Selecciona un estado para registrar asistencia.";
    render(root, state, role);
    return;
  }

  try {
    await createAttendance({ appointmentId, status, notesRequired });
    state.isLoading = true;
    render(root, state, role);
    await load(root, state, role);
  } catch (error) {
    state.message = getErrorMessage(error);
    render(root, state, role);
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "No se pudo completar la operacion de asistencia.";
}
