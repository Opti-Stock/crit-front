import {
  createAttendance,
  listAttendance,
  updateAttendanceStatus,
} from "../../../services/main-api/attendance";
import { listAppointments } from "../../../services/main-api/appointments";
import {
  createMedicalNote,
  listMedicalNotes,
} from "../../../services/main-api/medical-notes";
import { sessionService } from "../../auth/services/session.service";
import type {
  AppointmentSummary,
  AttendanceStatus,
  AttendanceSummary,
  MedicalNoteSummary,
} from "../../../types/operational.types";
import type { UserRole } from "../../../types/role.types";
import { escapeHtml, formatDateTime } from "../../../utils/dom";
import {
  ATTENDANCE_REALTIME_CONTRACT,
  subscribeToAttendanceRealtime,
  type AttendanceRealtimeStatus,
} from "../services/attendance-realtime.service";
import {
  ATTENDANCE_SCAN_CONTRACT,
  buildTherapeuticAttendanceScanUrl,
} from "../services/attendance-scan.service";
import {
  PENDING_MEDICAL_NOTE_NOTIFICATION_CONTRACT,
  createPendingMedicalNoteNotification,
  resolvePendingMedicalNoteNotification,
} from "../services/pending-medical-note-notifications.service";

type AttendanceActionStatus = Extract<
  AttendanceStatus,
  "present" | "absent" | "rescheduled"
>;

type AttendanceVisualStatus =
  | AttendanceActionStatus
  | "unregistered"
  | "auto_absent_due";

interface AttendanceViewModel {
  appointment: AppointmentSummary;
  attendance: AttendanceSummary | null;
  medicalNote: MedicalNoteSummary | null;
}

interface QuickMedicalNoteDraft {
  appointmentId: string;
  attendanceRecordId: string | null;
  status: AttendanceActionStatus;
}

interface AttendanceState {
  isLoading: boolean;
  isSaving: boolean;
  message: string | null;
  rows: AttendanceViewModel[];
  search: string;
  selectedDate: string;
  activeNote: QuickMedicalNoteDraft | null;
  realtimeStatus: AttendanceRealtimeStatus;
  realtimeMessage: string | null;
  currentUserId: string | null;
  currentCollaboratorId: string | null;
  scopeFilter: "all" | "mine" | "area";
  page: number;
  pageSize: number;
}

const CLINICAL_ATTENDANCE_ROLES: readonly UserRole[] = ["medico", "terapeuta"];
const DATE_QUERY_ROLES: readonly UserRole[] = ["coordinador", "direccion", "admin"];
const READ_ONLY_ROLES: readonly UserRole[] = ["coordinador", "direccion", "admin"];
const AUTO_ABSENT_TOLERANCE_MINUTES = 15;

const STATUS_CONFIG: Record<
  AttendanceVisualStatus,
  { label: string; icon: string; tone: "success" | "warning" | "muted" | "neutral" }
> = {
  present: { label: "Asistio", icon: "OK", tone: "success" },
  rescheduled: { label: "Reagendada", icon: "R", tone: "warning" },
  absent: { label: "No asistio", icon: "NO", tone: "muted" },
  unregistered: { label: "Sin registrar", icon: "-", tone: "neutral" },
  auto_absent_due: {
    label: "No asistio - auto pendiente",
    icon: "AUTO",
    tone: "muted",
  },
};

let realtimeUnsubscribe: (() => void) | null = null;

export function mountAttendancePage(root: HTMLElement, role: UserRole): void {
  if (realtimeUnsubscribe) {
    realtimeUnsubscribe();
    realtimeUnsubscribe = null;
  }

  const session = sessionService.getSession();
  const state: AttendanceState = {
    isLoading: true,
    isSaving: false,
    message: null,
    rows: [],
    search: "",
    selectedDate: toInputDate(new Date()),
    activeNote: null,
    realtimeStatus: "unavailable",
    realtimeMessage: null,
    currentUserId: session?.user?.id ?? null,
    currentCollaboratorId: session?.user?.collaboratorId ?? null,
    scopeFilter: "all",
    page: 1,
    pageSize: 20,
  };

  render(root, state, role);

  realtimeUnsubscribe = subscribeToAttendanceRealtime({
    onAppointmentChanged: () => {
      void load(root, state, role);
    },
    onAttendanceChanged: () => {
      void load(root, state, role);
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
  state: AttendanceState,
  role: UserRole,
): Promise<void> {
  state.isLoading = true;

  if (isClinicalAttendanceRole(role) && !state.currentCollaboratorId) {
    state.rows = [];
    state.message =
      "Sin permisos: la sesion debe incluir collaboratorId para mostrar solo pacientes asignados.";
    state.isLoading = false;
    render(root, state, role);
    return;
  }

  const range = dayRange(state.selectedDate);
  const collaboratorId =
    isClinicalAttendanceRole(role)
      ? state.currentCollaboratorId ?? undefined
      : undefined;

  try {
    const [appointments, attendance, notes] = await Promise.all([
      listAppointments({
        pageSize: 100,
        from: range.from,
        to: range.to,
        collaboratorId,
      }),
      listAttendance({
        pageSize: 100,
        from: range.from,
        to: range.to,
        collaboratorId,
      }),
      listMedicalNotes({
        pageSize: 100,
        collaboratorId,
      }),
    ]);

    const attendanceByAppointment = new Map(
      attendance.data.map((record) => [record.appointmentId, record]),
    );
    const noteByAppointment = new Map(
      notes.data.map((note) => [note.appointmentId, note]),
    );

    state.rows = appointments.data
      .filter((appointment) => appointment.status !== "cancelled")
      .map((appointment) => ({
        appointment,
        attendance: attendanceByAppointment.get(appointment.id) ?? null,
        medicalNote: noteByAppointment.get(appointment.id) ?? null,
      }))
      .filter((row) => isRowVisibleForRole(row, state, role))
      .sort(
        (left, right) =>
          new Date(left.appointment.startsAt).getTime() -
          new Date(right.appointment.startsAt).getTime(),
      );
    state.message = buildScopeMessage(state, role);
  } catch (error) {
    state.message = getErrorMessage(error);
  } finally {
    state.isLoading = false;
    render(root, state, role);
  }
}

function render(root: HTMLElement, state: AttendanceState, role: UserRole): void {
  const rows = getFilteredRows(state);

  root.innerHTML = `
    <section class="feature-page attendance-page">
      <header class="feature-header attendance-header">
        <div>
          <p class="app-eyebrow">Registro de asistencias</p>
          <h2>Asistencia terapeutica del dia</h2>
        </div>
        ${renderRealtimeStatus(state)}
      </header>
      ${state.message ? `<p class="inline-alert attendance-alert">${escapeHtml(state.message)}</p>` : ""}
      ${renderToolbar(state, role)}
      ${
        state.isLoading
          ? `<p class="empty-state">Cargando citas y asistencias...</p>`
          : `<div data-attendance-results>${renderRows(rows, state, role)}</div>`
      }
      ${state.activeNote ? renderQuickMedicalNote(state) : ""}
      <button class="attendance-scan-button" type="button" title="${escapeHtml(ATTENDANCE_SCAN_CONTRACT)}" data-attendance-scan>
        Escanear gafete
      </button>
    </section>
  `;

  bindEvents(root, state, role);
}

function renderRealtimeStatus(state: AttendanceState): string {
  const label =
    state.realtimeStatus === "connected"
      ? "Tiempo real activo"
      : state.realtimeStatus === "error"
        ? "Tiempo real con error"
        : "Tiempo real pendiente";

  return `
    <span class="status-pill attendance-realtime" title="${escapeHtml(state.realtimeMessage ?? ATTENDANCE_REALTIME_CONTRACT)}">
      ${escapeHtml(label)}
    </span>
  `;
}

function renderToolbar(state: AttendanceState, role: UserRole): string {
  const canQueryDates = canQueryOtherDates(role);

  return `
    <section class="attendance-toolbar" aria-label="Filtros de asistencias">
      ${renderPatientSearchCombobox(state)}
      ${renderCoordinatorScopeFilter(state, role)}
      ${
        canQueryDates
          ? `
            <label>
              Fecha
              <input name="selectedDate" type="date" value="${escapeHtml(state.selectedDate)}" data-attendance-date />
            </label>
          `
          : `<p class="hint-text">Mostrando solamente citas del dia actual asignadas al usuario autenticado.</p>`
      }
    </section>
  `;
}

function renderRows(
  rows: AttendanceViewModel[],
  state: AttendanceState,
  role: UserRole,
): string {
  if (rows.length === 0) {
    return `<p class="empty-state">No hay citas visibles para los filtros actuales.</p>`;
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize));
  const safePage = Math.min(Math.max(state.page, 1), totalPages);
  const pageRows = rows.slice((safePage - 1) * state.pageSize, safePage * state.pageSize);

  return `
    <div class="attendance-list">
      ${pageRows.map((row) => renderRow(row, state, role)).join("")}
    </div>
    ${renderAttendancePagination(rows.length, safePage, totalPages)}
  `;
}

function renderAttendancePagination(total: number, page: number, totalPages: number): string {
  if (totalPages <= 1) {
    return `<p class="hint-text">Mostrando ${total} asistencias visibles.</p>`;
  }

  return `
    <div class="button-row attendance-pagination" aria-label="Paginacion de asistencias">
      <button class="secondary-action" type="button" data-attendance-page="previous" ${page <= 1 ? "disabled" : ""}>Anterior</button>
      <span class="hint-text">Pagina ${page} de ${totalPages} - ${total} asistencias</span>
      <button class="secondary-action" type="button" data-attendance-page="next" ${page >= totalPages ? "disabled" : ""}>Siguiente</button>
    </div>
  `;
}

function renderRow(
  row: AttendanceViewModel,
  state: AttendanceState,
  role: UserRole,
): string {
  const status = getVisualStatus(row);
  const config = STATUS_CONFIG[status];
  const appointment = row.appointment;
  const canRegister = canRegisterClinicalAttendance(row, state, role);
  const canAddNote = canWriteMedicalNote(row, role);
  const noteLabel = row.medicalNote ? "Nota guardada" : "Agregar nota médica";

  return `
    <article class="attendance-card attendance-card--${config.tone}" data-appointment-id="${escapeHtml(appointment.id)}">
      <div class="attendance-card__status-bar" aria-hidden="true"></div>
      <div class="attendance-card__content">
        <div class="attendance-card__header">
          <div>
            <p class="attendance-card__time">${escapeHtml(formatTime(appointment.startsAt))} - ${escapeHtml(formatTime(appointment.endsAt))}</p>
            <h3 class="attendance-card__patient">${escapeHtml(appointment.patient.fullName)}</h3>
          </div>
          <span class="attendance-status-badge attendance-status-badge--${config.tone}">
            <span aria-hidden="true">${escapeHtml(config.icon)}</span>
            ${escapeHtml(config.label)}
          </span>
        </div>
        <dl class="attendance-card__details">
          <div><dt>Terapia</dt><dd>${escapeHtml(appointment.appointmentType.name)}</dd></div>
          <div><dt>Area</dt><dd>${escapeHtml(appointment.clinic.name)}</dd></div>
          <div><dt>Sala</dt><dd>${escapeHtml(appointment.room.name)}</dd></div>
          <div><dt>Terapeuta</dt><dd>${escapeHtml(appointment.collaborator.fullName)}</dd></div>
          <div><dt>Check-in</dt><dd>${escapeHtml(getCheckInLabel(row))}</dd></div>
          <div><dt>Nota medica</dt><dd>${escapeHtml(row.medicalNote ? "Registrada" : "Pendiente")}</dd></div>
        </dl>
        ${status === "auto_absent_due" ? `<p class="hint-text">La inasistencia automatica requiere trazabilidad backend antes de registrarse.</p>` : ""}
        ${renderReadOnlyHint(row, role)}
        <div class="attendance-card__actions" role="group" aria-label="Acciones de asistencia">
          ${
            canRegister
              ? `
                <button class="attendance-action attendance-action--present" type="button" data-attendance-action="present" aria-label="Registrar asistencia" ${state.isSaving ? "disabled" : ""}>
                  <span class="attendance-action__icon" aria-hidden="true">&#9989;</span>
                  <span class="attendance-action__label">Asistencia</span>
                </button>
                <button class="attendance-action attendance-action--absent" type="button" data-attendance-action="absent" aria-label="Registrar inasistencia" ${state.isSaving ? "disabled" : ""}>
                  <span class="attendance-action__icon" aria-hidden="true">&#10060;</span>
                  <span class="attendance-action__label">Inasistencia</span>
                </button>
                <button class="attendance-action attendance-action--reschedule" type="button" data-attendance-action="rescheduled" aria-label="Reagendar cita" ${state.isSaving ? "disabled" : ""}>
                  <span class="attendance-action__icon" aria-hidden="true">&#128197;</span>
                  <span class="attendance-action__label">Reagendar</span>
                </button>
              `
              : ""
          }
          <button class="attendance-action attendance-action--note" type="button" data-medical-note-action aria-label="${escapeHtml(noteLabel)}" ${canAddNote ? "" : "disabled"}>
            <span class="attendance-action__icon" aria-hidden="true">&#128221;</span>
            <span class="attendance-action__label">${escapeHtml(noteLabel)}</span>
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderReadOnlyHint(row: AttendanceViewModel, role: UserRole): string {
  if (!READ_ONLY_ROLES.includes(role)) return "";

  return `<p class="hint-text">Vista de solo lectura para este rol. El registro clinico lo realizan medico o terapeuta responsable.</p>`;
}

function renderPatientSearchCombobox(state: AttendanceState): string {
  return `
    <div class="calendar-combobox-field" data-attendance-patient-combobox>
      <label for="attendance-patient-search">Buscar paciente o folio</label>
      <div class="calendar-combobox">
        <input
          id="attendance-patient-search"
          name="search"
          type="search"
          value="${escapeHtml(state.search)}"
          placeholder="Escribe para buscar paciente..."
          autocomplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="false"
          aria-controls="attendance-patient-options"
          data-attendance-search
        />
        <button class="calendar-combobox__clear" type="button" data-attendance-patient-clear aria-label="Limpiar paciente" ${state.search ? "" : "hidden"}>x</button>
        <div id="attendance-patient-options" class="calendar-combobox__list" role="listbox"></div>
      </div>
    </div>
  `;
}

function renderCoordinatorScopeFilter(state: AttendanceState, role: UserRole): string {
  if (role !== "coordinador") return "";

  return `
    <label>
      Alcance
      <select name="scopeFilter" data-attendance-scope-filter>
        <option value="all" ${state.scopeFilter === "all" ? "selected" : ""}>Todas las citas del area</option>
        <option value="mine" ${state.scopeFilter === "mine" ? "selected" : ""}>Solo mis citas</option>
        <option value="area" ${state.scopeFilter === "area" ? "selected" : ""}>Solo equipo coordinado</option>
      </select>
    </label>
  `;
}

function renderQuickMedicalNote(state: AttendanceState): string {
  const row = state.rows.find(
    (candidate) => candidate.appointment.id === state.activeNote?.appointmentId,
  );

  if (!row || !state.activeNote) return "";

  const appointment = row.appointment;
  const status = STATUS_CONFIG[state.activeNote.status].label;

  return `
    <section class="attendance-note-panel" role="dialog" aria-label="Nota medica rapida">
      <form class="attendance-note-form" data-attendance-note-form>
        <div class="attendance-note-form__header">
          <div>
            <p class="app-eyebrow">Nota medica rapida</p>
            <h3>${escapeHtml(appointment.patient.fullName)}</h3>
          </div>
          <span class="status-pill">${escapeHtml(status)}</span>
        </div>
        <dl class="detail-grid">
          <div><dt>Cita</dt><dd>${escapeHtml(formatDateTime(appointment.startsAt))}</dd></div>
          <div><dt>Area</dt><dd>${escapeHtml(appointment.clinic.name)}</dd></div>
          <div><dt>Terapia</dt><dd>${escapeHtml(appointment.appointmentType.name)}</dd></div>
          <div><dt>Terapeuta</dt><dd>${escapeHtml(appointment.collaborator.fullName)}</dd></div>
        </dl>
        <label>
          Descripcion o resumen
          <textarea name="summary" rows="4" required></textarea>
        </label>
        <label>
          Observaciones
          <textarea name="observations" rows="3"></textarea>
        </label>
        <label>
          Incidencias
          <textarea name="incidents" rows="3"></textarea>
        </label>
        <label>
          Seguimiento o accion posterior
          <textarea name="followUp" rows="3"></textarea>
        </label>
        <div class="button-row">
          <button type="submit" ${state.isSaving ? "disabled" : ""}>Guardar nota</button>
          <button class="secondary-action" type="button" data-defer-medical-note>Capturar despues</button>
        </div>
      </form>
    </section>
  `;
}

function bindEvents(root: HTMLElement, state: AttendanceState, role: UserRole): void {
  root.querySelector<HTMLInputElement>("[data-attendance-search]")?.addEventListener(
    "input",
    (event) => {
      state.search = (event.currentTarget as HTMLInputElement).value;
      state.page = 1;
      syncAttendancePatientOptions(root, state);
      updateAttendanceResults(root, state, role);
    },
  );

  root.querySelector<HTMLInputElement>("[data-attendance-search]")?.addEventListener(
    "focus",
    () => {
      syncAttendancePatientOptions(root, state, true);
    },
  );

  root.querySelector<HTMLElement>("[data-attendance-patient-combobox]")?.addEventListener(
    "focusout",
    (event) => {
      const wrapper = event.currentTarget as HTMLElement;
      window.setTimeout(() => {
        if (!wrapper.contains(document.activeElement)) {
          syncAttendancePatientOptions(root, state, false);
        }
      });
    },
  );

  root.querySelector<HTMLElement>("[data-attendance-patient-combobox]")?.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const option = target.closest<HTMLButtonElement>("[data-attendance-patient-option]");
      if (option) {
        state.search = option.dataset.attendancePatientOption ?? "";
        state.page = 1;
        const input = root.querySelector<HTMLInputElement>("[data-attendance-search]");
        if (input) input.value = state.search;
        syncAttendancePatientOptions(root, state, false);
        updateAttendanceResults(root, state, role);
        return;
      }
      const clear = target.closest<HTMLButtonElement>("[data-attendance-patient-clear]");
      if (clear) {
        state.search = "";
        state.page = 1;
        const input = root.querySelector<HTMLInputElement>("[data-attendance-search]");
        if (input) input.value = "";
        syncAttendancePatientOptions(root, state, false);
        updateAttendanceResults(root, state, role);
      }
    },
  );

  root.querySelector<HTMLSelectElement>("[data-attendance-scope-filter]")?.addEventListener(
    "change",
    (event) => {
      state.scopeFilter = (event.currentTarget as HTMLSelectElement).value as AttendanceState["scopeFilter"];
      state.page = 1;
      updateAttendanceResults(root, state, role);
    },
  );

  root.querySelector<HTMLInputElement>("[data-attendance-date]")?.addEventListener(
    "change",
    (event) => {
      if (!canQueryOtherDates(role)) return;

      state.selectedDate = (event.currentTarget as HTMLInputElement).value;
      state.page = 1;
      state.isLoading = true;
      render(root, state, role);
      void load(root, state, role);
    },
  );

  root.querySelector<HTMLButtonElement>("[data-attendance-scan]")?.addEventListener(
    "click",
    () => {
      window.location.assign(buildTherapeuticAttendanceScanUrl());
    },
  );

  bindAttendanceCardEvents(root, state, role);
}

function bindAttendanceCardEvents(root: HTMLElement, state: AttendanceState, role: UserRole): void {
  root.querySelectorAll<HTMLButtonElement>("[data-attendance-page]").forEach((button) => {
    button.addEventListener("click", () => {
      const direction = button.dataset.attendancePage;
      const totalPages = Math.max(1, Math.ceil(getFilteredRows(state).length / state.pageSize));
      state.page =
        direction === "next"
          ? Math.min(state.page + 1, totalPages)
          : Math.max(state.page - 1, 1);
      updateAttendanceResults(root, state, role);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-attendance-action]").forEach(
    (button) => {
      button.addEventListener("click", () => {
        const card = button.closest<HTMLElement>("[data-appointment-id]");
        const appointmentId = card?.dataset.appointmentId;
        const status = button.dataset.attendanceAction as AttendanceActionStatus;

        if (appointmentId) {
          void registerAttendanceStatus(root, state, role, appointmentId, status);
        }
      });
    },
  );

  root.querySelectorAll<HTMLButtonElement>("[data-medical-note-action]").forEach(
    (button) => {
      button.addEventListener("click", () => {
        const card = button.closest<HTMLElement>("[data-appointment-id]");
        const appointmentId = card?.dataset.appointmentId;
        const row = state.rows.find(
          (candidate) => candidate.appointment.id === appointmentId,
        );

        if (!row || row.medicalNote) return;

        if (!row.attendance) {
          state.message = "Primero registra Asistio, Reagendar o No asistio.";
          render(root, state, role);
          return;
        }

        state.activeNote = {
          appointmentId: row.appointment.id,
          attendanceRecordId: row.attendance.id,
          status: toActionStatus(row.attendance.status),
        };
        render(root, state, role);
      });
    },
  );

  root.querySelector<HTMLFormElement>("[data-attendance-note-form]")?.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget as HTMLFormElement);
      void saveQuickMedicalNote(root, state, role, data);
    },
  );

  root.querySelector<HTMLButtonElement>("[data-defer-medical-note]")?.addEventListener(
    "click",
    () => {
      void deferMedicalNote(root, state, role);
    },
  );

}

async function registerAttendanceStatus(
  root: HTMLElement,
  state: AttendanceState,
  role: UserRole,
  appointmentId: string,
  status: AttendanceActionStatus,
): Promise<void> {
  const row = state.rows.find((candidate) => candidate.appointment.id === appointmentId);

  if (!row || !canRegisterClinicalAttendance(row, state, role)) {
    state.message = "No tienes permisos para registrar esta asistencia.";
    render(root, state, role);
    return;
  }

  if (row.attendance) {
    try {
      state.isSaving = true;
      render(root, state, role);
      const attendance = await updateAttendanceStatus(row.attendance.id, {
        status,
        notesRequired: true,
      });

      state.rows = state.rows.map((candidate) =>
        candidate.appointment.id === appointmentId
          ? { ...candidate, attendance }
          : candidate,
      );
      state.activeNote = {
        appointmentId,
        attendanceRecordId: attendance.id,
        status,
      };
      state.message = "Asistencia actualizada.";
    } catch (error) {
      state.message = getErrorMessage(error);
    } finally {
      state.isSaving = false;
      render(root, state, role);
    }
    return;
  }

  try {
    state.isSaving = true;
    render(root, state, role);
    const attendance = await createAttendance({
      appointmentId,
      status,
      notesRequired: true,
    });

    state.rows = state.rows.map((candidate) =>
      candidate.appointment.id === appointmentId
        ? { ...candidate, attendance }
        : candidate,
    );
    state.activeNote = {
      appointmentId,
      attendanceRecordId: attendance.id,
      status,
    };
    state.message =
      "Asistencia registrada. Captura la nota medica o dejala pendiente.";
  } catch (error) {
    state.message = getErrorMessage(error);
  } finally {
    state.isSaving = false;
    render(root, state, role);
  }
}

async function saveQuickMedicalNote(
  root: HTMLElement,
  state: AttendanceState,
  role: UserRole,
  data: FormData,
): Promise<void> {
  if (!state.activeNote) return;

  const row = state.rows.find(
    (candidate) => candidate.appointment.id === state.activeNote?.appointmentId,
  );
  const summary = String(data.get("summary") ?? "").trim();

  if (!row || !summary) {
    state.message = "Captura la descripcion o resumen de la nota.";
    render(root, state, role);
    return;
  }

  try {
    state.isSaving = true;
    render(root, state, role);
    const note = await createMedicalNote({
      appointmentId: row.appointment.id,
      content: {
        summary,
        observations: String(data.get("observations") ?? "").trim(),
        incidents: String(data.get("incidents") ?? "").trim(),
        followUp: String(data.get("followUp") ?? "").trim(),
        attendanceRecordId: state.activeNote.attendanceRecordId,
        patientId: row.appointment.patient.id,
        patientName: row.appointment.patient.fullName,
        collaboratorId: row.appointment.collaborator.id,
        collaboratorName: row.appointment.collaborator.fullName,
        appointmentDateTime: row.appointment.startsAt,
        area: row.appointment.clinic.name,
        room: row.appointment.room.name,
        therapy: row.appointment.appointmentType.name,
        createdFrom: "attendance-register",
      },
      formatVersion: "attendance-quick-note.v1",
    });

    state.rows = state.rows.map((candidate) =>
      candidate.appointment.id === row.appointment.id
        ? { ...candidate, medicalNote: note }
        : candidate,
    );

    try {
      await resolvePendingMedicalNoteNotification({ appointment: row.appointment });
    } catch {
      // Notification resolution is pending backend support.
    }

    state.activeNote = null;
    state.message = "Nota medica guardada.";
  } catch (error) {
    state.message = getErrorMessage(error);
  } finally {
    state.isSaving = false;
    render(root, state, role);
  }
}

async function deferMedicalNote(
  root: HTMLElement,
  state: AttendanceState,
  role: UserRole,
): Promise<void> {
  const row = state.rows.find(
    (candidate) => candidate.appointment.id === state.activeNote?.appointmentId,
  );

  if (!row) {
    state.activeNote = null;
    render(root, state, role);
    return;
  }

  try {
    await createPendingMedicalNoteNotification({
      appointment: row.appointment,
      attendanceRecordId: state.activeNote?.attendanceRecordId ?? undefined,
    });
    state.message = "Nota medica pendiente notificada al terapeuta responsable.";
  } catch {
    state.message = PENDING_MEDICAL_NOTE_NOTIFICATION_CONTRACT;
  } finally {
    state.activeNote = null;
    render(root, state, role);
  }
}

function getFilteredRows(state: AttendanceState): AttendanceViewModel[] {
  const search = state.search.trim().toLowerCase();

  return state.rows.filter((row) => {
    const appointment = row.appointment;
    if (state.scopeFilter === "mine" && state.currentCollaboratorId) {
      if (appointment.collaborator.id !== state.currentCollaboratorId) return false;
    }
    if (state.scopeFilter === "area" && state.currentCollaboratorId) {
      if (appointment.collaborator.id === state.currentCollaboratorId) return false;
    }
    if (!search) return true;
    const haystack = [
      appointment.id,
      appointment.patient.fullName,
      appointment.appointmentType.name,
      appointment.clinic.name,
      appointment.room.name,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(search);
  });
}

function isRowVisibleForRole(
  row: AttendanceViewModel,
  state: AttendanceState,
  role: UserRole,
): boolean {
  if (isClinicalAttendanceRole(role) && state.currentCollaboratorId) {
    return row.appointment.collaborator.id === state.currentCollaboratorId;
  }

  return true;
}

function canRegisterClinicalAttendance(
  row: AttendanceViewModel,
  state: AttendanceState,
  role: UserRole,
): boolean {
  if (!isClinicalAttendanceRole(role)) return false;
  if (row.medicalNote) return false;
  if (!state.currentCollaboratorId) return false;

  return row.appointment.collaborator.id === state.currentCollaboratorId;
}

function canWriteMedicalNote(row: AttendanceViewModel, role: UserRole): boolean {
  return isClinicalAttendanceRole(role) && Boolean(row.attendance) && !row.medicalNote;
}

function isClinicalAttendanceRole(role: UserRole): boolean {
  return CLINICAL_ATTENDANCE_ROLES.includes(role);
}

function canQueryOtherDates(role: UserRole): boolean {
  return DATE_QUERY_ROLES.includes(role);
}

function getVisualStatus(row: AttendanceViewModel): AttendanceVisualStatus {
  if (row.attendance?.status === "present") return "present";
  if (row.attendance?.status === "rescheduled") return "rescheduled";
  if (row.attendance?.status === "absent") return "absent";
  if (row.appointment.status === "rescheduled") return "rescheduled";
  if (isAutoAbsentDue(row)) return "auto_absent_due";
  return "unregistered";
}

function isAutoAbsentDue(row: AttendanceViewModel): boolean {
  if (row.attendance || row.appointment.status === "rescheduled") return false;

  const endsAt = new Date(row.appointment.endsAt).getTime();
  const toleranceMs = AUTO_ABSENT_TOLERANCE_MINUTES * 60 * 1000;

  return Number.isFinite(endsAt) && Date.now() > endsAt + toleranceMs;
}

function toActionStatus(status: AttendanceStatus): AttendanceActionStatus {
  if (status === "present" || status === "absent" || status === "rescheduled") {
    return status;
  }

  return "present";
}

function getCheckInLabel(row: AttendanceViewModel): string {
  return row.appointment.isCheckedIn ? "Con check-in general" : "Sin check-in general";
}

function buildScopeMessage(state: AttendanceState, role: UserRole): string | null {
  if (isClinicalAttendanceRole(role) && !state.currentCollaboratorId) {
    return "La sesion actual no incluye collaboratorId; el filtro de terapeuta depende del backend.";
  }

  return null;
}

function getAttendancePatientOptions(state: AttendanceState): string[] {
  const patients = new Map<string, string>();

  state.rows.forEach((row) => {
    patients.set(row.appointment.patient.id, row.appointment.patient.fullName);
  });

  const query = state.search.trim().toLowerCase();
  return [...patients.values()]
    .filter((patientName) => !query || patientName.toLowerCase().includes(query))
    .sort((left, right) => left.localeCompare(right, "es-MX"))
    .slice(0, 8);
}

function syncAttendancePatientOptions(
  root: HTMLElement,
  state: AttendanceState,
  forceOpen?: boolean,
): void {
  const input = root.querySelector<HTMLInputElement>("[data-attendance-search]");
  const list = root.querySelector<HTMLElement>("#attendance-patient-options");
  const clear = root.querySelector<HTMLButtonElement>("[data-attendance-patient-clear]");
  if (!input || !list) return;

  const isOpen = forceOpen ?? document.activeElement === input;
  input.setAttribute("aria-expanded", String(isOpen));
  clear?.toggleAttribute("hidden", !state.search);
  list.classList.toggle("calendar-combobox__list--open", isOpen);

  if (!isOpen) {
    list.innerHTML = "";
    return;
  }

  const options = getAttendancePatientOptions(state);
  if (!state.search.trim()) {
    list.innerHTML = `<div class="calendar-combobox__state">Escribe para buscar pacientes.</div>`;
    return;
  }
  if (options.length === 0) {
    list.innerHTML = `<div class="calendar-combobox__state">Sin resultados.</div>`;
    return;
  }
  list.innerHTML = options
    .map((patientName) => `
      <button class="calendar-combobox__option" type="button" role="option" data-attendance-patient-option="${escapeHtml(patientName)}">
        <strong>${escapeHtml(patientName)}</strong>
        <span>Paciente</span>
      </button>
    `)
    .join("");
}

function updateAttendanceResults(root: HTMLElement, state: AttendanceState, role: UserRole): void {
  const results = root.querySelector<HTMLElement>("[data-attendance-results]");
  if (!results) return;
  results.innerHTML = renderRows(getFilteredRows(state), state, role);
  bindAttendanceCardEvents(root, state, role);
}

function dayRange(inputDate: string): { from: string; to: string } {
  const [year, month, day] = inputDate.split("-").map(Number);
  const date =
    year && month && day ? new Date(year, month - 1, day) : new Date();

  date.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setDate(end.getDate() + 1);

  return {
    from: date.toISOString(),
    to: end.toISOString(),
  };
}

function toInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "No se pudo completar la operacion de asistencia.";
}
