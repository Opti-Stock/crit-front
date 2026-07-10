import {
  createAppointment,
  listAppointments,
  updateAppointment,
} from "../../../services/main-api/appointments";
import { listAttendance } from "../../../services/main-api/attendance";
import { checkInAppointment } from "../../../services/checkin-api/appointments";
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
  AttendanceStatus,
  AttendanceSummary,
  CatalogItem,
} from "../../../types/operational.types";
import type { UserRole } from "../../../types/role.types";
import { escapeHtml, formatDateTime } from "../../../utils/dom";
import {
  CalendarAppointment,
  toCalendarAppointments,
} from "../utils/calendar-adapter";
import {
  CalendarViewMode,
  WORKDAY_END_HOUR,
  WORKDAY_START_HOUR,
  addDays,
  formatDayHeader,
  formatInputDateTime,
  formatRangeLabel,
  formatTime,
  getRangeForView,
  getVisibleDays,
  isMinuteStep,
  moveAnchorDate,
  toDateKey,
} from "../utils/calendar-date";
import type { CalendarLayoutBlock } from "../utils/calendar-layout";
import { layoutCalendarAppointments } from "../utils/calendar-layout";
import {
  CalendarVisualState,
  getCalendarStatusConfig,
} from "../config/calendar-status.config";
import { canWriteAppointments } from "../../../guards/role-guard";

const CALENDAR_VIEW_LABELS: Record<CalendarViewMode, string> = {
  day: "Día",
  "work-week": "Lun–Vie",
  week: "Semana",
  month: "Mes",
  agenda: "Agenda",
};

const CALENDAR_VIEW_OPTIONS: readonly CalendarViewMode[] = [
  "day",
  "work-week",
  "month",
  "agenda",
];

const PIXELS_PER_MINUTE = 1.2;
const APPOINTMENT_TIME_STEP_MINUTES = 5;
const APPOINTMENT_TIME_STEP_SECONDS = APPOINTMENT_TIME_STEP_MINUTES * 60;
const APPOINTMENT_START_HOUR = 7;
const APPOINTMENT_END_HOUR = 18;
const DEFAULT_PRE_SESSION_MINUTES = 5;
const DEFAULT_POST_SESSION_MINUTES = 40;
const PATIENT_SEARCH_DEBOUNCE_MS = 300;
const PATIENT_SEARCH_PAGE_SIZE = 10;

type PatientComboboxKind = "filter" | "form";
type PatientSearchStatus = "idle" | "loading" | "loaded" | "error";

interface PatientComboboxState {
  query: string;
  selected: CatalogItem | null;
  options: CatalogItem[];
  status: PatientSearchStatus;
  error: string | null;
  isOpen: boolean;
  activeIndex: number;
  requestId: number;
  debounceTimer: number | null;
}

interface CalendarState {
  role: UserRole;
  view: CalendarViewMode;
  anchorDate: Date;
  appointments: AppointmentSummary[];
  attendance: AttendanceSummary[];
  collaborators: CatalogItem[];
  clinics: CatalogItem[];
  rooms: CatalogItem[];
  appointmentTypes: AppointmentTypeSummary[];
  filters: CalendarFilters;
  patientComboboxes: Record<PatientComboboxKind, PatientComboboxState>;
  selectedAppointmentId: string | null;
  showCreateForm: boolean;
  editingAppointmentId: string | null;
  formClinicId: string;
  isFiltersCollapsed: boolean;
  showMoreFilters: boolean;
  draftStartsAt: Date | null;
  message: string | null;
  isLoading: boolean;
  isSaving: boolean;
  isCheckingIn: boolean;
}

interface CalendarFilters {
  patientId: string;
  clinicId: string;
  collaboratorId: string;
  roomId: string;
  appointmentTypeId: string;
  appointmentStatus: string;
  attendanceStatus: string;
}

export function mountCalendarPage(root: HTMLElement, role: UserRole): void {
  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  const state: CalendarState = {
    role,
    view: isMobile ? "day" : "work-week",
    anchorDate: new Date(),
    appointments: [],
    attendance: [],
    collaborators: [],
    clinics: [],
    rooms: [],
    appointmentTypes: [],
    filters: {
      patientId: "",
      clinicId: "",
      collaboratorId: "",
      roomId: "",
      appointmentTypeId: "",
      appointmentStatus: "",
      attendanceStatus: "",
    },
    patientComboboxes: {
      filter: createPatientComboboxState(),
      form: createPatientComboboxState(),
    },
    selectedAppointmentId: null,
    showCreateForm: false,
    editingAppointmentId: null,
    formClinicId: "",
    isFiltersCollapsed: isMobile,
    showMoreFilters: false,
    draftStartsAt: null,
    message: null,
    isLoading: true,
    isSaving: false,
    isCheckingIn: false,
  };
  render(root, state);
  void load(root, state);
}

async function load(root: HTMLElement, state: CalendarState): Promise<void> {
  try {
    const range = getRangeForView(state.anchorDate, state.view);
    const [appointments, attendance, collaborators, clinics, rooms, appointmentTypes] =
      await Promise.all([
        listAppointments({
          pageSize: 100,
          from: range.from,
          to: range.to,
          patientId: state.filters.patientId || undefined,
          clinicId: state.filters.clinicId || undefined,
          collaboratorId: state.filters.collaboratorId || undefined,
          status: state.filters.appointmentStatus || undefined,
        }),
        listAttendance({
          pageSize: 100,
          from: range.from,
          to: range.to,
          patientId: state.filters.patientId || undefined,
          clinicId: state.filters.clinicId || undefined,
          collaboratorId: state.filters.collaboratorId || undefined,
          status: (state.filters.attendanceStatus || undefined) as
            | AttendanceStatus
            | undefined,
        }),
        listCollaborators({ pageSize: 100, status: "active" }),
        listClinics({ pageSize: 100 }),
        listRooms({ pageSize: 100 }),
        listAppointmentTypes(),
    ]);
    state.appointments = appointments.data;
    state.attendance = attendance.data;
    state.collaborators = collaborators.data.filter(isClinicalProfessional);
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
  const calendarAppointments = getFilteredCalendarAppointments(state);
  const selectedAppointment =
    calendarAppointments.find(
      (item) => item.appointment.id === state.selectedAppointmentId,
    ) ?? null;

  root.innerHTML = `
    <section class="feature-page">
      <header class="feature-header calendar-page-header">
        <div>
          <p class="app-eyebrow">Calendario</p>
          <h2>Agenda operativa</h2>
        </div>
        <div class="calendar-page-header__actions">
          <button class="secondary-action" type="button" data-calendar-action="toggle-filters">${state.isFiltersCollapsed ? "Mostrar filtros" : "Ocultar filtros"}</button>
        </div>
      </header>
      ${renderToolbar(state)}
      ${state.message ? renderCalendarAlert(state.message) : ""}
      <div class="calendar-workspace${state.isFiltersCollapsed ? " calendar-workspace--full" : ""}">
        ${state.isFiltersCollapsed ? "" : renderSidebar(state, calendarAppointments)}
        <div class="calendar-main${state.showCreateForm ? " calendar-main--with-form" : ""}">
          ${state.showCreateForm ? renderCreateAppointmentPanel(state) : ""}
          ${state.isLoading ? `<p class="empty-state">Cargando agenda...</p>` : renderCalendarSurface(state, calendarAppointments)}
        </div>
      </div>
      ${selectedAppointment ? renderDetailPanel(selectedAppointment, state.role) : ""}
    </section>
  `;
  bindEvents(root, state);
}

function renderCalendarAlert(message: string): string {
  return `
    <div class="inline-alert calendar-alert" role="status">
      <span>${escapeHtml(message)}</span>
      <button class="secondary-action" type="button" data-calendar-action="refresh">Reintentar</button>
    </div>
  `;
}

function renderCreateAppointmentPanel(state: CalendarState): string {
  return `
    <div class="calendar-create-panel" role="dialog" aria-label="Nueva cita">
      ${renderForm(state)}
      <aside class="calendar-availability" aria-label="Disponibilidad de terapeuta y sala">
        <div>
          <p class="app-eyebrow">Disponibilidad</p>
          <h3>Terapeuta y sala</h3>
        </div>
        <p>La agenda muestra el contexto visible. La validacion de conflictos, disponibilidad real y reglas de area dependen del backend.</p>
        <dl>
          <div><dt>Terapeuta</dt><dd>Selecciona profesional para cruzar horarios.</dd></div>
          <div><dt>Sala</dt><dd>Selecciona sala para revisar ocupacion.</dd></div>
          <div><dt>Conflictos</dt><dd>Pendiente de endpoint dedicado.</dd></div>
        </dl>
      </aside>
    </div>
  `;
}

function renderForm(state: CalendarState): string {
  const editingAppointment = getEditingAppointment(state);
  const defaultStart = editingAppointment
    ? new Date(editingAppointment.startsAt)
    : state.draftStartsAt ?? nextBusinessStart();
  const defaultEnd = new Date(defaultStart);
  if (editingAppointment) {
    defaultEnd.setTime(new Date(editingAppointment.endsAt).getTime());
  } else {
    defaultEnd.setMinutes(defaultEnd.getMinutes() + 45);
  }
  const selectedClinicId = state.formClinicId || editingAppointment?.clinic.id || "";
  const selectedRoomId =
    editingAppointment && editingAppointment.clinic.id === selectedClinicId
      ? editingAppointment.room.id
      : "";
  const selectedCollaboratorId = editingAppointment?.collaborator.id ?? "";
  const selectedAppointmentTypeId = editingAppointment?.appointmentType.id ?? "";
  const title = editingAppointment ? "Reagendar cita" : "Nueva cita";

  if (
    defaultEnd.getHours() > APPOINTMENT_END_HOUR ||
    (defaultEnd.getHours() === APPOINTMENT_END_HOUR &&
      defaultEnd.getMinutes() > 0)
  ) {
    defaultEnd.setHours(APPOINTMENT_END_HOUR, 0, 0, 0);
  }

  return `
    <form class="form-panel form-grid calendar-form calendar-form--panel" data-appointment-form>
      <div class="calendar-form__title">
        <div>
          <h3>${title}</h3>
          <p>Selecciona el nuevo horario, profesional, clinica y consultorio.</p>
        </div>
        <button class="icon-button icon-button--danger" type="button" data-calendar-action="toggle-form" aria-label="Cerrar formulario">x</button>
      </div>
      ${renderPatientCombobox("form", "Paciente", state.patientComboboxes.form, {
        hiddenName: "patientId",
        placeholder: "Escribe el nombre del paciente",
        required: true,
      })}
      ${selectField("collaboratorId", "Profesional", state.collaborators, selectedCollaboratorId)}
      ${selectField("clinicId", "Clinica", state.clinics, selectedClinicId)}
      ${selectField("roomId", "Cuarto", getRoomsForClinic(state, selectedClinicId), selectedRoomId)}
      ${selectField("appointmentTypeId", "Tipo", state.appointmentTypes, selectedAppointmentTypeId)}
      <label>Inicio<input name="startsAt" type="datetime-local" step="${APPOINTMENT_TIME_STEP_SECONDS}" min="07:00" max="18:00" value="${formatInputDateTime(defaultStart)}" required /></label>
      <label>Fin<input name="endsAt" type="datetime-local" step="${APPOINTMENT_TIME_STEP_SECONDS}" min="07:00" max="18:00" value="${formatInputDateTime(defaultEnd)}" required /></label>
      <button type="submit" ${state.isSaving ? "disabled" : ""}>${state.isSaving ? "Guardando..." : editingAppointment ? "Guardar cambios" : "Crear cita"}</button>
    </form>
  `;
}

function renderToolbar(state: CalendarState): string {
  return `
    <div class="calendar-toolbar" aria-label="Controles de calendario">
      <div class="calendar-toolbar__group">
        <button class="secondary-action" type="button" data-calendar-action="today">Hoy</button>
        <button class="icon-button" type="button" data-calendar-action="previous" aria-label="Periodo anterior">‹</button>
        <button class="icon-button" type="button" data-calendar-action="next" aria-label="Periodo siguiente">›</button>
        <strong class="calendar-toolbar__range">${escapeHtml(formatRangeLabel(state.anchorDate, state.view))}</strong>
      </div>
      <div class="calendar-view-switch" role="tablist" aria-label="Vistas de calendario">
        ${CALENDAR_VIEW_OPTIONS
          .map((view) => {
            const active = view === state.view ? " calendar-view-switch__item--active" : "";
            return `<button class="calendar-view-switch__item${active}" type="button" data-calendar-view="${view}" role="tab" aria-selected="${view === state.view}">${CALENDAR_VIEW_LABELS[view]}</button>`;
          })
          .join("")}
      </div>
      ${canCreateAppointments(state.role) ? `<button type="button" data-calendar-action="toggle-form">Nueva cita</button>` : ""}
    </div>
  `;
}

function renderSidebar(
  state: CalendarState,
  appointments: readonly CalendarAppointment[],
): string {
  return `
    <aside class="calendar-sidebar" aria-label="Filtros de agenda">
      ${renderMiniCalendar(state)}
      <form class="calendar-filter-panel" data-calendar-filters>
        <div class="calendar-filter-panel__header">
          <h3>Filtros</h3>
          <button class="text-action" type="button" data-calendar-action="clear-filters">Limpiar</button>
        </div>
        ${renderPatientCombobox("filter", "Buscar paciente", state.patientComboboxes.filter, {
          hiddenName: "patientId",
          placeholder: "Escribe el nombre del paciente",
          required: false,
        })}
        ${filterSelect("clinicId", "Area", state.clinics, state.filters.clinicId)}
        ${filterSelect("collaboratorId", "Terapeuta", state.collaborators, state.filters.collaboratorId)}
        ${renderActiveFilterChips(state)}
        <button class="secondary-action" type="button" data-calendar-action="toggle-more-filters">${state.showMoreFilters ? "Menos filtros" : "Mas filtros"}</button>
        ${
          state.showMoreFilters
            ? `
              ${filterSelect("roomId", "Sala", state.rooms, state.filters.roomId)}
              ${filterSelect("appointmentTypeId", "Tipo de terapia", state.appointmentTypes, state.filters.appointmentTypeId)}
              ${statusSelect("appointmentStatus", "Estado de cita", state.filters.appointmentStatus, [
                ["scheduled", "Programada"],
                ["cancelled", "Cancelada"],
                ["rescheduled", "Reprogramada"],
              ])}
              ${statusSelect("attendanceStatus", "Estado de asistencia", state.filters.attendanceStatus, [
                ["present", "Asistencia"],
                ["absent", "Inasistencia"],
                ["rescheduled", "Por reagendar"],
              ])}
            `
            : ""
        }
      </form>
      ${renderLegend()}
      <p class="calendar-sidebar__meta">${appointments.length} citas visibles</p>
    </aside>
  `;
}

function renderMiniCalendar(state: CalendarState): string {
  const days = getVisibleDays(state.anchorDate, "month");
  const todayKey = toDateKey(new Date());
  const activeKey = toDateKey(state.anchorDate);

  return `
    <section class="mini-calendar" aria-label="Mini calendario mensual">
      <div class="mini-calendar__header">
        <button class="icon-button" type="button" data-calendar-action="mini-previous" aria-label="Mes anterior">‹</button>
        <strong>${escapeHtml(formatRangeLabel(state.anchorDate, "month"))}</strong>
        <button class="icon-button" type="button" data-calendar-action="mini-next" aria-label="Mes siguiente">›</button>
      </div>
      <div class="mini-calendar__weekdays">
        ${["L", "M", "M", "J", "V", "S", "D"].map((day) => `<span>${day}</span>`).join("")}
      </div>
      <div class="mini-calendar__grid">
        ${days
          .map((day) => {
            const key = toDateKey(day);
            const classes = [
              "mini-calendar__day",
              key === todayKey ? "mini-calendar__day--today" : "",
              key === activeKey ? "mini-calendar__day--active" : "",
              day.getMonth() !== state.anchorDate.getMonth()
                ? "mini-calendar__day--muted"
                : "",
            ]
              .filter(Boolean)
              .join(" ");
            return `<button class="${classes}" type="button" data-mini-date="${key}">${day.getDate()}</button>`;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderLegend(): string {
  const statuses: CalendarVisualState[] = [
    "scheduled",
    "cancelled",
    "rescheduled",
    "reschedule_requested",
    "present",
    "absent",
  ];

  return `
    <section class="calendar-legend" aria-label="Estado de citas">
      <h3>Estado de citas</h3>
      ${statuses
        .map((status) => {
          const config = getCalendarStatusConfig(status);
          const tone = status === "cancelled" ? "muted" : config.tone;
          return `<span class="calendar-status calendar-status--${tone}"><span aria-hidden="true"></span>${escapeHtml(config.label)}</span>`;
        })
        .join("")}
    </section>
  `;
}

function renderActiveFilterChips(state: CalendarState): string {
  const chips: string[] = [];
  const addChip = (label: string, value: string, key: keyof CalendarFilters) => {
    if (!value) return;
    chips.push(
      `<button class="calendar-filter-chip" type="button" data-clear-filter="${key}">${escapeHtml(label)}: ${escapeHtml(value)} x</button>`,
    );
  };

  addChip(
    "Paciente",
    getPatientFilterLabel(state),
    "patientId",
  );
  addChip("Area", findCatalogLabel(state.clinics, state.filters.clinicId), "clinicId");
  addChip(
    "Terapeuta",
    findCatalogLabel(state.collaborators, state.filters.collaboratorId),
    "collaboratorId",
  );
  addChip("Sala", findCatalogLabel(state.rooms, state.filters.roomId), "roomId");
  addChip(
    "Tipo",
    findCatalogLabel(state.appointmentTypes, state.filters.appointmentTypeId),
    "appointmentTypeId",
  );
  addChip("Cita", state.filters.appointmentStatus, "appointmentStatus");
  addChip("Asistencia", state.filters.attendanceStatus, "attendanceStatus");

  if (chips.length === 0) {
    return "";
  }

  return `<div class="calendar-filter-chips" aria-label="Filtros activos">${chips.join("")}</div>`;
}

function renderCalendarSurface(
  state: CalendarState,
  appointments: readonly CalendarAppointment[],
): string {
  if (state.view === "agenda") {
    return renderAgendaView(state, appointments);
  }

  if (state.view === "month") {
    return renderMonthView(state, appointments);
  }

  return renderTimeGrid(state, appointments);
}

function renderTimeGrid(
  state: CalendarState,
  appointments: readonly CalendarAppointment[],
): string {
  const days = getVisibleDays(state.anchorDate, state.view);
  const hours = Array.from(
    { length: WORKDAY_END_HOUR - WORKDAY_START_HOUR },
    (_, index) => WORKDAY_START_HOUR + index,
  );
  const todayKey = toDateKey(new Date());

  return `
    <section class="calendar-grid-card" aria-label="Agenda por horario">
      <div class="calendar-grid-card__header" style="--calendar-days: ${days.length}">
        <div class="calendar-grid-card__corner"></div>
        ${days
          .map((day) => {
            const key = toDateKey(day);
            return `<div class="calendar-day-heading ${key === todayKey ? "calendar-day-heading--today" : ""}">${escapeHtml(formatDayHeader(day))}</div>`;
          })
          .join("")}
      </div>
      <div class="calendar-time-grid" style="--calendar-days: ${days.length}">
        <div class="calendar-hours">
          ${hours.map((hour) => `<div>${String(hour).padStart(2, "0")}:00</div>`).join("")}
        </div>
        <div class="calendar-day-columns">
          ${days
            .map((day) => renderDayColumn(day, appointments))
            .join("")}
        </div>
      </div>
    </section>
  `;
}

function renderDayColumn(
  day: Date,
  appointments: readonly CalendarAppointment[],
): string {
  const key = toDateKey(day);
  const dayAppointments = appointments.filter((item) => item.dateKey === key);
  const positioned = layoutCalendarAppointments(
    dayAppointments.map((item) => ({
      item,
      startsAt: item.appointment.startsAt,
      endsAt: item.appointment.endsAt,
    })),
    {
      pixelsPerMinute: PIXELS_PER_MINUTE,
      workdayStartHour: WORKDAY_START_HOUR,
      workdayEndHour: WORKDAY_END_HOUR,
    },
  );
  const hours = Array.from(
    { length: WORKDAY_END_HOUR - WORKDAY_START_HOUR },
    (_, index) => WORKDAY_START_HOUR + index,
  );

  return `
    <div class="calendar-day-column" data-day="${key}">
      ${hours
        .map((hour) => `<button class="calendar-slot" type="button" data-slot-date="${key}" data-slot-hour="${hour}" aria-label="Crear cita ${key} ${hour}:00"></button>`)
        .join("")}
      ${positioned.map(renderAppointmentBlock).join("")}
    </div>
  `;
}

function renderAppointmentBlock(
  positioned: CalendarLayoutBlock<CalendarAppointment>,
): string {
  const { item } = positioned;
  const appointment = item.appointment;
  const start = positioned.startsAt;
  const end = positioned.endsAt;
  const status = getCalendarStatusConfig(item.visualState);
  const isCompact = positioned.durationMinutes < 60;
  const hasMeta = positioned.durationMinutes >= 90;
  const classes = [
    "calendar-appointment",
    `calendar-appointment--${status.tone}`,
    isCompact ? "calendar-appointment--compact" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const title = [
    `${formatTime(start)} - ${formatTime(end)}`,
    appointment.patient.fullName,
    appointment.appointmentType.name,
  ].join(" | ");

  return `
    <button class="${classes}" type="button" data-appointment-id="${escapeHtml(appointment.id)}" title="${escapeHtml(title)}" style="top: ${positioned.topPx}px; height: ${positioned.heightPx}px; left: calc(${positioned.leftPercent}% + 4px); width: calc(${positioned.widthPercent}% - 8px);">
      <span class="calendar-appointment__time">${escapeHtml(formatTime(start))} - ${escapeHtml(formatTime(end))}</span>
      <strong class="calendar-appointment__patient">${escapeHtml(appointment.patient.fullName)}</strong>
      ${isCompact ? "" : `<span class="calendar-appointment__therapy">${escapeHtml(appointment.appointmentType.name)}</span>`}
      ${hasMeta ? `<span class="calendar-appointment__meta">${escapeHtml(appointment.collaborator.fullName)} · ${escapeHtml(appointment.room.name)}</span>` : ""}
    </button>
  `;
}

function renderMonthView(
  state: CalendarState,
  appointments: readonly CalendarAppointment[],
): string {
  const days = getVisibleDays(state.anchorDate, "month");
  const todayKey = toDateKey(new Date());

  return `
    <section class="calendar-month" aria-label="Vista mensual">
      ${["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map((day) => `<strong>${day}</strong>`).join("")}
      ${days
        .map((day) => {
          const key = toDateKey(day);
          const dayAppointments = appointments.filter((item) => item.dateKey === key);
          const classes = [
            "calendar-month__day",
            key === todayKey ? "calendar-month__day--today" : "",
            day.getMonth() !== state.anchorDate.getMonth() ? "calendar-month__day--muted" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return `
            <div class="${classes}">
              <button class="calendar-month__date" type="button" data-mini-date="${key}">${day.getDate()}</button>
              ${dayAppointments.slice(0, 4).map(renderMonthChip).join("")}
              ${dayAppointments.length > 4 ? `<span class="calendar-month__more">+${dayAppointments.length - 4} mas</span>` : ""}
            </div>
          `;
        })
        .join("")}
    </section>
  `;
}

function renderMonthChip(item: CalendarAppointment): string {
  const config = getCalendarStatusConfig(item.visualState);
  return `
    <button class="calendar-month__chip calendar-month__chip--${config.tone}" type="button" data-appointment-id="${escapeHtml(item.appointment.id)}">
      ${escapeHtml(formatTime(item.appointment.startsAt))} ${escapeHtml(item.appointment.patient.fullName)}
    </button>
  `;
}

function renderAgendaView(
  state: CalendarState,
  appointments: readonly CalendarAppointment[],
): string {
  const days = getVisibleDays(state.anchorDate, "week");

  return `
    <section class="calendar-agenda" aria-label="Vista de agenda">
      ${days
        .map((day) => {
          const key = toDateKey(day);
          const dayAppointments = appointments.filter((item) => item.dateKey === key);
          return `
            <div class="calendar-agenda__day">
              <h3>${escapeHtml(formatDayHeader(day))}</h3>
              ${
                dayAppointments.length
                  ? dayAppointments.map(renderAgendaItem).join("")
                  : `<p class="calendar-agenda__empty">Sin citas</p>`
              }
            </div>
          `;
        })
        .join("")}
    </section>
  `;
}

function renderAgendaItem(item: CalendarAppointment): string {
  const status = getCalendarStatusConfig(item.visualState);
  return `
    <button class="calendar-agenda__item" type="button" data-appointment-id="${escapeHtml(item.appointment.id)}">
      <span>${escapeHtml(formatTime(item.appointment.startsAt))}</span>
      <strong>${escapeHtml(item.appointment.patient.fullName)}</strong>
      <span>${escapeHtml(item.appointment.appointmentType.name)} · ${escapeHtml(item.appointment.collaborator.fullName)}</span>
      <span class="calendar-status calendar-status--${status.tone}"><span aria-hidden="true"></span>${escapeHtml(status.label)}</span>
    </button>
  `;
}

function renderDetailPanel(
  item: CalendarAppointment,
  role: UserRole,
): string {
  const appointment = item.appointment;
  const status = getCalendarStatusConfig(item.visualState);
  const canOperate = canCreateAppointments(role);
  const canManualCheckIn =
    !appointment.isCheckedIn &&
    (role === "recepcion" || role === "coordinador" || role === "admin" || role === "direccion" || role === "medico" || role === "terapeuta");
  const checkInLabel = appointment.isCheckedIn ? "Con check-in" : "Sin registro";

  return `
    <aside class="calendar-detail-panel" aria-label="Detalle de cita">
      <div class="calendar-detail-panel__header">
        <div>
          <p class="app-eyebrow">Detalle de cita</p>
          <h3>${escapeHtml(appointment.patient.fullName)}</h3>
        </div>
        <button class="icon-button icon-button--danger" type="button" data-calendar-action="close-detail" aria-label="Cerrar detalle">×</button>
      </div>
      <dl class="calendar-detail-list">
        <div><dt>Horario</dt><dd>${escapeHtml(formatDateTime(appointment.startsAt))} - ${escapeHtml(formatTime(appointment.endsAt))}</dd></div>
        <div><dt>Area / clinica</dt><dd>${escapeHtml(appointment.clinic.name)}</dd></div>
        <div><dt>Tipo</dt><dd>${escapeHtml(appointment.appointmentType.name)}</dd></div>
        <div><dt>Profesional</dt><dd>${escapeHtml(appointment.collaborator.fullName)}</dd></div>
        <div><dt>Cuarto</dt><dd>${escapeHtml(appointment.room.name)}</dd></div>
        <div><dt>Estado cita</dt><dd><span class="calendar-status calendar-status--${status.tone}"><span aria-hidden="true"></span>${escapeHtml(status.label)}</span></dd></div>
        <div><dt>Check-in</dt><dd>${escapeHtml(checkInLabel)}</dd></div>
      </dl>
      <div class="calendar-detail-panel__actions">
        ${
          canManualCheckIn
            ? `<button type="button" data-calendar-action="manual-checkin" data-checkin-appointment-id="${escapeHtml(appointment.id)}">Check-in</button>`
            : `<button type="button" disabled>${appointment.isCheckedIn ? "Check-in" : "Check-in no disponible"}</button>`
        }
        ${
          canOperate
            ? `
              <button class="secondary-action" type="button" data-calendar-action="reschedule-appointment" data-appointment-state-id="${escapeHtml(appointment.id)}">Reagendar</button>
              <button class="secondary-action" type="button" data-calendar-action="cancel-appointment" data-appointment-state-id="${escapeHtml(appointment.id)}">Cancelar cita</button>
            `
            : `<button class="secondary-action" type="button" disabled>Vista de solo lectura</button>`
        }
      </div>
      <p class="hint-text">Este panel no muestra diagnosticos ni notas clinicas.</p>
    </aside>
  `;
}

function renderPatientCombobox(
  kind: PatientComboboxKind,
  label: string,
  combo: PatientComboboxState,
  options: {
    hiddenName: string;
    placeholder: string;
    required: boolean;
  },
): string {
  const inputId = `calendar-${kind}-patient-search`;
  const listId = `calendar-${kind}-patient-options`;
  const activeId =
    combo.isOpen && combo.activeIndex >= 0
      ? `${listId}-${combo.activeIndex}`
      : "";

  return `
    <div class="calendar-combobox-field" data-patient-combobox="${kind}">
      <label for="${inputId}">${label}</label>
      <div class="calendar-combobox">
        <input
          id="${inputId}"
          type="search"
          value="${escapeHtml(combo.query)}"
          placeholder="${escapeHtml(options.placeholder)}"
          autocomplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="${combo.isOpen}"
          aria-controls="${listId}"
          ${activeId ? `aria-activedescendant="${activeId}"` : ""}
          data-patient-search="${kind}"
          ${options.required ? "required" : ""}
        />
        <input type="hidden" name="${options.hiddenName}" value="${escapeHtml(combo.selected?.id ?? "")}" data-patient-selected-id="${kind}" />
        <button class="calendar-combobox__clear" type="button" data-patient-clear="${kind}" aria-label="Limpiar paciente" ${combo.query ? "" : "hidden"}>x</button>
        <div id="${listId}" class="calendar-combobox__list${combo.isOpen ? " calendar-combobox__list--open" : ""}" role="listbox">
          ${renderPatientComboboxOptions(kind, combo, listId)}
        </div>
      </div>
    </div>
  `;
}

function renderPatientComboboxOptions(
  kind: PatientComboboxKind,
  combo: PatientComboboxState,
  listId: string,
): string {
  if (!combo.isOpen) {
    return "";
  }

  if (!combo.query.trim()) {
    return `<div class="calendar-combobox__state">Escribe para buscar pacientes.</div>`;
  }

  if (combo.status === "loading") {
    return `<div class="calendar-combobox__state" role="status">Cargando pacientes...</div>`;
  }

  if (combo.status === "error") {
    return `<div class="calendar-combobox__state calendar-combobox__state--error" role="alert">${escapeHtml(combo.error ?? "No se pudieron cargar pacientes.")}</div>`;
  }

  if (combo.status === "loaded" && combo.options.length === 0) {
    return `<div class="calendar-combobox__state">Sin resultados.</div>`;
  }

  return combo.options
    .map((option, index) => {
      const active = index === combo.activeIndex;
      const classes = [
        "calendar-combobox__option",
        active ? "calendar-combobox__option--active" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `
        <button
          id="${listId}-${index}"
          class="${classes}"
          type="button"
          role="option"
          aria-selected="${active}"
          data-patient-option-kind="${kind}"
          data-patient-option-index="${index}"
        >
          <strong>${escapeHtml(getCatalogItemLabel(option))}</strong>
          <span>Folio ${escapeHtml(getPatientFolio(option))}</span>
        </button>
      `;
    })
    .join("");
}

function selectField(
  name: string,
  label: string,
  items: readonly CatalogItem[],
  selectedValue = "",
): string {
  return `
    <label>
      ${label}
      <select name="${name}" required>
        <option value="">Selecciona</option>
        ${items.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selectedValue ? "selected" : ""}>${escapeHtml(getCatalogItemLabel(item))}</option>`).join("")}
      </select>
    </label>
  `;
}

function filterSelect(
  name: keyof CalendarFilters,
  label: string,
  items: readonly CatalogItem[],
  selectedValue: string,
): string {
  return `
    <label>
      ${label}
      <select name="${name}">
        <option value="">Todos</option>
        ${items.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selectedValue ? "selected" : ""}>${escapeHtml(getCatalogItemLabel(item))}</option>`).join("")}
      </select>
    </label>
  `;
}

function getRoomsForClinic(state: CalendarState, clinicId: string): CatalogItem[] {
  if (!clinicId) return [];
  return state.rooms.filter((room) => (room.clinic?.id ?? room.clinicId) === clinicId);
}

function getEditingAppointment(state: CalendarState): AppointmentSummary | null {
  if (!state.editingAppointmentId) return null;
  return (
    state.appointments.find(
      (appointment) => appointment.id === state.editingAppointmentId,
    ) ?? null
  );
}

function statusSelect(
  name: keyof CalendarFilters,
  label: string,
  selectedValue: string,
  items: readonly [string, string][],
): string {
  return `
    <label>
      ${label}
      <select name="${name}">
        <option value="">Todos</option>
        ${items.map(([value, text]) => `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}
      </select>
    </label>
  `;
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
  root.querySelector<HTMLSelectElement>('[data-appointment-form] select[name="clinicId"]')?.addEventListener(
    "change",
    (event) => {
      state.formClinicId = (event.currentTarget as HTMLSelectElement).value;
      render(root, state);
    },
  );
  root
  .querySelectorAll<HTMLInputElement>(
    'input[name="startsAt"], input[name="endsAt"]',
  )
  .forEach((input) => {
    input.addEventListener("blur", () => {
      const date = parseAppointmentDateTime(input.value);

      if (!date) {
        return;
      }

      input.value = formatInputDateTime(
        normalizeAppointmentDateTime(date),
      );
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-calendar-action]").forEach((button) => {
    button.addEventListener("click", () => {
      handleCalendarAction(root, state, button.dataset.calendarAction ?? "", button);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-calendar-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.calendarView as CalendarViewMode;
      state.view = view;
      state.isLoading = true;
      render(root, state);
      void load(root, state);
    });
  });

  root.querySelector<HTMLFormElement>("[data-calendar-filters]")?.addEventListener(
    "change",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
        return;
      }
      if (target.matches("[data-patient-search], [data-patient-selected-id]")) {
        return;
      }
      updateFilter(root, state, target.name as keyof CalendarFilters, target.value);
    },
  );

  bindPatientComboboxes(root, state);

  root.querySelectorAll<HTMLButtonElement>("[data-mini-date]").forEach((button) => {
    button.addEventListener("click", () => {
      const date = parseDateKey(button.dataset.miniDate);
      if (!date) return;
      state.anchorDate = date;
      state.view = state.view === "month" ? "day" : state.view;
      state.isLoading = true;
      render(root, state);
      void load(root, state);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-slot-date]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!canCreateAppointments(state.role)) {
        state.message = "Tu rol no tiene permisos para crear citas.";
        render(root, state);
        return;
      }
      const date = parseDateKey(button.dataset.slotDate);
      const hour = Number(button.dataset.slotHour ?? WORKDAY_START_HOUR);
      if (!date) return;
      date.setHours(hour, 0, 0, 0);
      state.draftStartsAt = date;
      state.showCreateForm = true;
      state.editingAppointmentId = null;
      render(root, state);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-appointment-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedAppointmentId = button.dataset.appointmentId ?? null;
      render(root, state);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-clear-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.clearFilter as keyof CalendarFilters | undefined;
      if (!key) return;
      updateFilter(root, state, key, "");
    });
  });
}

function bindPatientComboboxes(root: HTMLElement, state: CalendarState): void {
  root.querySelectorAll<HTMLInputElement>("[data-patient-search]").forEach((input) => {
    const kind = parsePatientComboboxKind(input.dataset.patientSearch);
    if (!kind) return;

    input.addEventListener("focus", () => {
      const combo = state.patientComboboxes[kind];
      combo.isOpen = true;
      if (combo.query.trim() && combo.status === "idle") {
        queuePatientSearch(root, state, kind, combo.query);
      }
      syncPatientCombobox(root, state, kind);
    });

    input.addEventListener("input", () => {
      handlePatientSearchInput(root, state, kind, input.value);
    });

    input.addEventListener("keydown", (event) => {
      handlePatientComboboxKeydown(root, state, kind, event);
    });
  });

  root.querySelectorAll<HTMLElement>("[data-patient-combobox]").forEach((wrapper) => {
    const kind = parsePatientComboboxKind(wrapper.dataset.patientCombobox);
    if (!kind) return;

    wrapper.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const clearButton = target.closest<HTMLButtonElement>("[data-patient-clear]");
      if (clearButton) {
        event.preventDefault();
        clearPatientCombobox(root, state, kind);
        return;
      }

      const optionButton = target.closest<HTMLButtonElement>("[data-patient-option-index]");
      if (!optionButton) return;
      const index = Number(optionButton.dataset.patientOptionIndex ?? -1);
      selectPatientOption(root, state, kind, index);
    });

    wrapper.addEventListener("focusout", () => {
      window.setTimeout(() => {
        if (wrapper.contains(document.activeElement)) {
          return;
        }
        state.patientComboboxes[kind].isOpen = false;
        syncPatientCombobox(root, state, kind);
      });
    });
  });
}

function handlePatientSearchInput(
  root: HTMLElement,
  state: CalendarState,
  kind: PatientComboboxKind,
  value: string,
): void {
  const combo = state.patientComboboxes[kind];
  const previousSelected = combo.selected;
  combo.query = value;
  combo.isOpen = true;
  combo.activeIndex = -1;
  combo.error = null;

  if (previousSelected && value !== getCatalogItemLabel(previousSelected)) {
    combo.selected = null;
    if (kind === "filter" && state.filters.patientId) {
      state.filters.patientId = "";
      state.isLoading = true;
      render(root, state);
      void load(root, state);
    }
  }

  queuePatientSearch(root, state, kind, value);
}

function handlePatientComboboxKeydown(
  root: HTMLElement,
  state: CalendarState,
  kind: PatientComboboxKind,
  event: KeyboardEvent,
): void {
  const combo = state.patientComboboxes[kind];

  if (event.key === "Escape") {
    combo.isOpen = false;
    syncPatientCombobox(root, state, kind);
    return;
  }

  if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Enter") {
    return;
  }

  if (event.key === "Enter") {
    if (combo.isOpen && combo.activeIndex >= 0) {
      event.preventDefault();
      selectPatientOption(root, state, kind, combo.activeIndex);
    }
    return;
  }

  event.preventDefault();
  combo.isOpen = true;

  if (combo.options.length === 0) {
    syncPatientCombobox(root, state, kind);
    return;
  }

  const direction = event.key === "ArrowDown" ? 1 : -1;
  const nextIndex = combo.activeIndex + direction;
  combo.activeIndex =
    (nextIndex + combo.options.length) % combo.options.length;
  syncPatientCombobox(root, state, kind);
}

function queuePatientSearch(
  root: HTMLElement,
  state: CalendarState,
  kind: PatientComboboxKind,
  query: string,
): void {
  const combo = state.patientComboboxes[kind];
  const trimmedQuery = query.trim();

  if (combo.debounceTimer) {
    window.clearTimeout(combo.debounceTimer);
    combo.debounceTimer = null;
  }

  if (!trimmedQuery) {
    combo.options = [];
    combo.status = "idle";
    combo.error = null;
    combo.activeIndex = -1;
    if (kind === "filter" && state.filters.patientId) {
      state.filters.patientId = "";
      state.isLoading = true;
      render(root, state);
      void load(root, state);
      return;
    }
    syncPatientCombobox(root, state, kind);
    return;
  }

  combo.status = "loading";
  combo.options = [];
  combo.error = null;
  const requestId = combo.requestId + 1;
  combo.requestId = requestId;
  syncPatientCombobox(root, state, kind);

  combo.debounceTimer = window.setTimeout(() => {
    void loadPatientOptions(root, state, kind, trimmedQuery, requestId);
  }, PATIENT_SEARCH_DEBOUNCE_MS);
}

async function loadPatientOptions(
  root: HTMLElement,
  state: CalendarState,
  kind: PatientComboboxKind,
  query: string,
  requestId: number,
): Promise<void> {
  const combo = state.patientComboboxes[kind];

  try {
    const response = await listPatients({
      pageSize: PATIENT_SEARCH_PAGE_SIZE,
      search: query,
    });

    if (combo.requestId !== requestId) {
      return;
    }

    combo.options = response.data;
    combo.status = "loaded";
    combo.error = null;
    combo.activeIndex = response.data.length > 0 ? 0 : -1;
  } catch (error) {
    if (combo.requestId !== requestId) {
      return;
    }
    combo.options = [];
    combo.status = "error";
    combo.error =
      error instanceof Error ? error.message : "No se pudieron cargar pacientes.";
    combo.activeIndex = -1;
  } finally {
    if (combo.requestId === requestId) {
      combo.debounceTimer = null;
      combo.isOpen = true;
      syncPatientCombobox(root, state, kind);
    }
  }
}

function selectPatientOption(
  root: HTMLElement,
  state: CalendarState,
  kind: PatientComboboxKind,
  index: number,
): void {
  const combo = state.patientComboboxes[kind];
  const selected = combo.options[index];
  if (!selected) return;

  combo.selected = selected;
  combo.query = getCatalogItemLabel(selected);
  combo.options = [selected];
  combo.status = "loaded";
  combo.error = null;
  combo.isOpen = false;
  combo.activeIndex = -1;

  if (kind === "filter") {
    state.filters.patientId = selected.id;
    state.isLoading = true;
    render(root, state);
    void load(root, state);
    return;
  }

  syncPatientCombobox(root, state, kind);
}

function clearPatientCombobox(
  root: HTMLElement,
  state: CalendarState,
  kind: PatientComboboxKind,
): void {
  resetPatientCombobox(state.patientComboboxes[kind]);

  if (kind === "filter") {
    state.filters.patientId = "";
    state.isLoading = true;
    render(root, state);
    void load(root, state);
    return;
  }

  syncPatientCombobox(root, state, kind);
}

function resetPatientCombobox(combo: PatientComboboxState): void {
  if (combo.debounceTimer) {
    window.clearTimeout(combo.debounceTimer);
  }
  combo.query = "";
  combo.selected = null;
  combo.options = [];
  combo.status = "idle";
  combo.error = null;
  combo.isOpen = false;
  combo.activeIndex = -1;
  combo.debounceTimer = null;
  combo.requestId += 1;
}

function syncPatientCombobox(
  root: HTMLElement,
  state: CalendarState,
  kind: PatientComboboxKind,
): void {
  const combo = state.patientComboboxes[kind];
  const wrapper = root.querySelector<HTMLElement>(
    `[data-patient-combobox="${kind}"]`,
  );
  if (!wrapper) return;

  const input = wrapper.querySelector<HTMLInputElement>(
    `[data-patient-search="${kind}"]`,
  );
  const hidden = wrapper.querySelector<HTMLInputElement>(
    `[data-patient-selected-id="${kind}"]`,
  );
  const clearButton = wrapper.querySelector<HTMLButtonElement>(
    `[data-patient-clear="${kind}"]`,
  );
  const list = wrapper.querySelector<HTMLElement>(".calendar-combobox__list");
  const listId = `calendar-${kind}-patient-options`;
  const activeId =
    combo.isOpen && combo.activeIndex >= 0
      ? `${listId}-${combo.activeIndex}`
      : "";

  if (input && document.activeElement !== input) {
    input.value = combo.query;
  }
  input?.setAttribute("aria-expanded", String(combo.isOpen));
  if (activeId) {
    input?.setAttribute("aria-activedescendant", activeId);
  } else {
    input?.removeAttribute("aria-activedescendant");
  }
  if (hidden) {
    hidden.value = combo.selected?.id ?? "";
  }
  if (clearButton) {
    clearButton.hidden = combo.query.length === 0;
  }
  if (list) {
    list.classList.toggle("calendar-combobox__list--open", combo.isOpen);
    list.innerHTML = renderPatientComboboxOptions(kind, combo, listId);
  }
}

function parsePatientComboboxKind(
  value: string | undefined,
): PatientComboboxKind | null {
  return value === "filter" || value === "form" ? value : null;
}

async function createAppointmentFromForm(
  root: HTMLElement,
  state: CalendarState,
  data: FormData,
): Promise<void> {
  try {
    const patientId = String(data.get("patientId") ?? "").trim();
    const clinicId = String(data.get("clinicId") ?? "").trim();
    const roomId = String(data.get("roomId") ?? "").trim();
    const startsAt = parseAppointmentDateTime(String(data.get("startsAt") ?? ""));
    const endsAt = parseAppointmentDateTime(String(data.get("endsAt") ?? ""));

    if (!patientId || state.patientComboboxes.form.selected?.id !== patientId) {
      throw new Error("Selecciona un paciente valido de la lista.");
    }

    if (!startsAt || !endsAt) {
      throw new Error("Selecciona horarios de inicio y fin validos.");
    }

    if (!clinicId || !getRoomsForClinic(state, clinicId).some((room) => room.id === roomId)) {
      throw new Error("Selecciona un consultorio de la clinica elegida.");
    }

    if (
      !isMinuteStep(startsAt, APPOINTMENT_TIME_STEP_MINUTES) ||
      !isMinuteStep(endsAt, APPOINTMENT_TIME_STEP_MINUTES)
    ) {
      throw new Error("Los horarios deben usar intervalos de 5 minutos.");
    }

    if (
      !isWithinBusinessHours(startsAt) ||
      !isWithinBusinessHours(endsAt)
    ) {
      throw new Error(
        "Las citas solo pueden programarse entre las 07:00 y las 18:00."
      );
    }

    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new Error("La hora de fin debe ser posterior a la hora de inicio.");
    }

    state.isSaving = true;
    render(root, state);
    const appointmentInput = {
      patientId,
      collaboratorId: String(data.get("collaboratorId")),
      clinicId,
      roomId,
      appointmentTypeId: String(data.get("appointmentTypeId")),
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      preSessionMinutes: DEFAULT_PRE_SESSION_MINUTES,
      postSessionMinutes: DEFAULT_POST_SESSION_MINUTES,
    };

    if (state.editingAppointmentId) {
      await updateAppointment(state.editingAppointmentId, {
        ...appointmentInput,
        status: "rescheduled",
      });
      state.message = "Cita reprogramada.";
    } else {
      await createAppointment(appointmentInput);
      state.message = "Cita creada.";
    }
    state.isLoading = true;
    state.isSaving = false;
    state.showCreateForm = false;
    state.editingAppointmentId = null;
    state.formClinicId = "";
    state.draftStartsAt = null;
    resetPatientCombobox(state.patientComboboxes.form);
    render(root, state);
    await load(root, state);
  } catch (error) {
    state.isSaving = false;
    state.message = error instanceof Error ? error.message : "No se pudo guardar la cita.";
    render(root, state);
  }
}

function handleCalendarAction(
  root: HTMLElement,
  state: CalendarState,
  action: string,
  source?: HTMLElement,
): void {
  switch (action) {
    case "today":
      state.anchorDate = new Date();
      state.isLoading = true;
      render(root, state);
      void load(root, state);
      return;
    case "previous":
      state.anchorDate = moveAnchorDate(state.anchorDate, state.view, -1);
      state.isLoading = true;
      render(root, state);
      void load(root, state);
      return;
    case "next":
      state.anchorDate = moveAnchorDate(state.anchorDate, state.view, 1);
      state.isLoading = true;
      render(root, state);
      void load(root, state);
      return;
    case "mini-previous":
      state.anchorDate = addDays(state.anchorDate, -30);
      state.isLoading = true;
      render(root, state);
      void load(root, state);
      return;
    case "mini-next":
      state.anchorDate = addDays(state.anchorDate, 30);
      state.isLoading = true;
      render(root, state);
      void load(root, state);
      return;
    case "refresh":
      state.isLoading = true;
      render(root, state);
      void load(root, state);
      return;
    case "toggle-form":
      state.showCreateForm = !state.showCreateForm;
      if (!state.showCreateForm) {
        resetAppointmentFormState(state);
      } else {
        state.editingAppointmentId = null;
      }
      render(root, state);
      return;
    case "toggle-filters":
      state.isFiltersCollapsed = !state.isFiltersCollapsed;
      render(root, state);
      return;
    case "toggle-more-filters":
      state.showMoreFilters = !state.showMoreFilters;
      render(root, state);
      return;
    case "clear-filters":
      state.filters = {
        patientId: "",
        clinicId: "",
        collaboratorId: "",
        roomId: "",
        appointmentTypeId: "",
        appointmentStatus: "",
        attendanceStatus: "",
      };
      resetPatientCombobox(state.patientComboboxes.filter);
      state.isLoading = true;
      render(root, state);
      void load(root, state);
      return;
    case "close-detail":
      state.selectedAppointmentId = null;
      render(root, state);
      return;
    case "manual-checkin":
      void registerManualCheckIn(root, state, source?.dataset.checkinAppointmentId);
      return;
    case "reschedule-appointment":
      startReschedule(root, state, source?.dataset.appointmentStateId);
      return;
    case "cancel-appointment":
      void updateAppointmentStatus(root, state, source?.dataset.appointmentStateId, "cancelled");
      return;
    default:
      return;
  }
}

function startReschedule(
  root: HTMLElement,
  state: CalendarState,
  appointmentId: string | undefined,
): void {
  if (!appointmentId) return;
  if (!canCreateAppointments(state.role)) {
    state.message = "Tu rol no tiene permisos para modificar citas.";
    render(root, state);
    return;
  }

  const appointment = state.appointments.find((candidate) => candidate.id === appointmentId);
  if (!appointment) {
    state.message = "No se encontro la cita para reagendar.";
    render(root, state);
    return;
  }

  state.selectedAppointmentId = null;
  state.editingAppointmentId = appointment.id;
  state.showCreateForm = true;
  state.formClinicId = appointment.clinic.id;
  state.draftStartsAt = new Date(appointment.startsAt);
  state.patientComboboxes.form.query = appointment.patient.fullName;
  state.patientComboboxes.form.selected = {
    id: appointment.patient.id,
    fullName: appointment.patient.fullName,
  };
  state.patientComboboxes.form.options = [];
  state.patientComboboxes.form.isOpen = false;
  state.patientComboboxes.form.status = "idle";
  render(root, state);
}

function resetAppointmentFormState(state: CalendarState): void {
  state.editingAppointmentId = null;
  state.formClinicId = "";
  state.draftStartsAt = null;
  resetPatientCombobox(state.patientComboboxes.form);
}

function updateFilter(
  root: HTMLElement,
  state: CalendarState,
  name: keyof CalendarFilters,
  value: string,
): void {
  state.filters[name] = value;
  if (name === "patientId" && !value) {
    resetPatientCombobox(state.patientComboboxes.filter);
  }
  state.isLoading = true;
  render(root, state);
  void load(root, state);
}

function getFilteredCalendarAppointments(state: CalendarState): CalendarAppointment[] {
  return toCalendarAppointments(state.appointments, state.attendance)
    .filter((item) => {
      const appointment = item.appointment;

      if (
        state.filters.patientId &&
        appointment.patient.id !== state.filters.patientId
      ) {
        return false;
      }

      if (state.filters.roomId && appointment.room.id !== state.filters.roomId) {
        return false;
      }

      if (
        state.filters.appointmentTypeId &&
        appointment.appointmentType.id !== state.filters.appointmentTypeId
      ) {
        return false;
      }

      return true;
    })
    .sort(
      (left, right) =>
        new Date(left.appointment.startsAt).getTime() -
        new Date(right.appointment.startsAt).getTime(),
    );
}

function canCreateAppointments(role: UserRole): boolean {
  return canWriteAppointments(role);
}

function isClinicalProfessional(item: CatalogItem): boolean {
  const roles = item.roles ?? [];
  return roles.includes("medico") || roles.includes("terapeuta");
}

async function registerManualCheckIn(
  root: HTMLElement,
  state: CalendarState,
  appointmentId: string | undefined,
): Promise<void> {
  if (!appointmentId) return;

  try {
    state.isCheckingIn = true;
    await checkInAppointment(appointmentId);
    state.selectedAppointmentId = appointmentId;
    state.isLoading = true;
    await load(root, state);
  } catch (error) {
    state.message =
      error instanceof Error ? error.message : "No se pudo registrar check-in manual.";
    render(root, state);
  } finally {
    state.isCheckingIn = false;
  }
}

async function updateAppointmentStatus(
  root: HTMLElement,
  state: CalendarState,
  appointmentId: string | undefined,
  status: "cancelled" | "rescheduled",
): Promise<void> {
  if (!appointmentId) return;
  if (!canCreateAppointments(state.role)) {
    state.message = "Tu rol no tiene permisos para modificar citas.";
    render(root, state);
    return;
  }

  try {
    state.isSaving = true;
    await updateAppointment(appointmentId, { status });
    state.selectedAppointmentId = appointmentId;
    state.isLoading = true;
    await load(root, state);
  } catch (error) {
    state.message =
      error instanceof Error ? error.message : "No se pudo actualizar la cita.";
    render(root, state);
  } finally {
    state.isSaving = false;
  }
}

function findCatalogLabel(items: readonly CatalogItem[], id: string): string {
  if (!id) return "";
  const item = items.find((candidate) => candidate.id === id);
  return item ? getCatalogItemLabel(item) : id;
}

function getPatientFilterLabel(state: CalendarState): string {
  if (!state.filters.patientId) return "";
  const selected = state.patientComboboxes.filter.selected;
  return selected ? getCatalogItemLabel(selected) : state.filters.patientId;
}

function getCatalogItemLabel(item: CatalogItem): string {
  return item.fullName ?? item.name ?? item.id;
}

function getPatientFolio(item: CatalogItem): string {
  return item.folio ?? item.id;
}

function createPatientComboboxState(): PatientComboboxState {
  return {
    query: "",
    selected: null,
    options: [],
    status: "idle",
    error: null,
    isOpen: false,
    activeIndex: -1,
    requestId: 0,
    debounceTimer: null,
  };
}

function parseAppointmentDateTime(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
function isWithinBusinessHours(date: Date): boolean {
  const minutes =
    date.getHours() * 60 +
    date.getMinutes();

  const startMinutes = APPOINTMENT_START_HOUR * 60;
  const endMinutes = APPOINTMENT_END_HOUR * 60;

  return minutes >= startMinutes && minutes <= endMinutes;
}
function normalizeAppointmentDateTime(date: Date): Date {
  const normalized = new Date(date);

  normalized.setSeconds(0, 0);

  // Redondear al siguiente múltiplo de 5
  const minutes =
    Math.ceil(normalized.getMinutes() / APPOINTMENT_TIME_STEP_MINUTES) *
    APPOINTMENT_TIME_STEP_MINUTES;

  normalized.setMinutes(minutes);

  // Si pasó a la siguiente hora
  if (normalized.getMinutes() === 60) {
    normalized.setHours(normalized.getHours() + 1, 0, 0, 0);
  }

  // Antes de abrir
  if (normalized.getHours() < APPOINTMENT_START_HOUR) {
    normalized.setHours(APPOINTMENT_START_HOUR, 0, 0, 0);
  }

  // Después de cerrar
  if (
    normalized.getHours() > APPOINTMENT_END_HOUR ||
    (normalized.getHours() === APPOINTMENT_END_HOUR &&
      normalized.getMinutes() > 0)
  ) {
    normalized.setDate(normalized.getDate() + 1);
    normalized.setHours(APPOINTMENT_START_HOUR, 0, 0, 0);
  }

  return normalized;
}
function nextBusinessStart(): Date {
  const start = new Date();
  start.setSeconds(0, 0);

  // Antes de abrir
  if (start.getHours() < APPOINTMENT_START_HOUR) {
    start.setHours(APPOINTMENT_START_HOUR, 0, 0, 0);
    return start;
  }

  // Después de cerrar
  if (
    start.getHours() > APPOINTMENT_END_HOUR ||
    (start.getHours() === APPOINTMENT_END_HOUR && start.getMinutes() > 0)
  ) {
    start.setDate(start.getDate() + 1);
    start.setHours(APPOINTMENT_START_HOUR, 0, 0, 0);
    return start;
  }

  // Redondear al siguiente múltiplo de 5
  const minutes = start.getMinutes();
  const roundedMinutes =
    Math.ceil(minutes / APPOINTMENT_TIME_STEP_MINUTES) *
    APPOINTMENT_TIME_STEP_MINUTES;

  start.setMinutes(roundedMinutes, 0, 0);

  // Si el redondeo pasó de la hora (ej. 08:58 -> 09:00)
  if (start.getMinutes() === 60) {
    start.setHours(start.getHours() + 1, 0, 0, 0);
  }

  // Si al redondear se pasó del horario laboral
  if (
    start.getHours() > APPOINTMENT_END_HOUR ||
    (start.getHours() === APPOINTMENT_END_HOUR && start.getMinutes() > 0)
  ) {
    start.setDate(start.getDate() + 1);
    start.setHours(APPOINTMENT_START_HOUR, 0, 0, 0);
  }

  return start;
}

function parseDateKey(value: string | undefined): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}
