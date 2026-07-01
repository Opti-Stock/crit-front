import {
  createAppointment,
  listAppointments,
} from "../../../services/main-api/appointments";
import { createAttendance, listAttendance } from "../../../services/main-api/attendance";
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
  moveAnchorDate,
  toDateKey,
} from "../utils/calendar-date";
import type { CalendarLayoutBlock } from "../utils/calendar-layout";
import { layoutCalendarAppointments } from "../utils/calendar-layout";
import {
  CalendarVisualState,
  getCalendarStatusConfig,
} from "../config/calendar-status.config";

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

const CREATE_APPOINTMENT_ROLES: readonly UserRole[] = [
  "admin",
  "direccion",
  "recepcion",
  "coordinador",
];

const PIXELS_PER_MINUTE = 1.2;

interface CalendarState {
  role: UserRole;
  view: CalendarViewMode;
  anchorDate: Date;
  appointments: AppointmentSummary[];
  attendance: AttendanceSummary[];
  patients: CatalogItem[];
  collaborators: CatalogItem[];
  clinics: CatalogItem[];
  rooms: CatalogItem[];
  appointmentTypes: AppointmentTypeSummary[];
  filters: CalendarFilters;
  selectedAppointmentId: string | null;
  showCreateForm: boolean;
  isFiltersCollapsed: boolean;
  showMoreFilters: boolean;
  draftStartsAt: Date | null;
  message: string | null;
  isLoading: boolean;
  isSaving: boolean;
  isCheckingIn: boolean;
}

interface CalendarFilters {
  search: string;
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
    patients: [],
    collaborators: [],
    clinics: [],
    rooms: [],
    appointmentTypes: [],
    filters: {
      search: "",
      clinicId: "",
      collaboratorId: "",
      roomId: "",
      appointmentTypeId: "",
      appointmentStatus: "",
      attendanceStatus: "",
    },
    selectedAppointmentId: null,
    showCreateForm: false,
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
    const [appointments, attendance, patients, collaborators, clinics, rooms, appointmentTypes] =
      await Promise.all([
        listAppointments({
          pageSize: 100,
          from: range.from,
          to: range.to,
          clinicId: state.filters.clinicId || undefined,
          collaboratorId: state.filters.collaboratorId || undefined,
          status: state.filters.appointmentStatus || undefined,
        }),
        listAttendance({
          pageSize: 100,
          from: range.from,
          to: range.to,
          clinicId: state.filters.clinicId || undefined,
          collaboratorId: state.filters.collaboratorId || undefined,
          status: (state.filters.attendanceStatus || undefined) as
            | AttendanceStatus
            | undefined,
        }),
        listPatients({ pageSize: 100 }),
        listCollaborators({ pageSize: 100 }),
        listClinics({ pageSize: 100 }),
        listRooms({ pageSize: 100 }),
        listAppointmentTypes(),
      ]);
    state.appointments = appointments.data;
    state.attendance = attendance.data;
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
      <div class="calendar-workspace">
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
  const defaultStart = state.draftStartsAt ?? nextBusinessStart();
  const defaultEnd = new Date(defaultStart);
  defaultEnd.setMinutes(defaultEnd.getMinutes() + 45);

  return `
    <form class="form-panel form-grid calendar-form calendar-form--panel" data-appointment-form>
      <div class="calendar-form__title">
        <div>
          <h3>Nueva cita</h3>
          <p>Captura manual. La validacion final de disponibilidad depende del backend.</p>
        </div>
        <button class="icon-button icon-button--danger" type="button" data-calendar-action="toggle-form" aria-label="Cerrar nueva cita">x</button>
      </div>
      ${selectField("patientId", "Paciente", state.patients)}
      ${selectField("collaboratorId", "Profesional", state.collaborators)}
      ${selectField("clinicId", "Clinica", state.clinics)}
      ${selectField("roomId", "Cuarto", state.rooms)}
      ${selectField("appointmentTypeId", "Tipo", state.appointmentTypes)}
      <label>Inicio<input name="startsAt" type="datetime-local" value="${formatInputDateTime(defaultStart)}" required /></label>
      <label>Fin<input name="endsAt" type="datetime-local" value="${formatInputDateTime(defaultEnd)}" required /></label>
      <label>Pre sesion<input name="preSessionMinutes" type="number" min="0" value="5" /></label>
      <label>Post sesion<input name="postSessionMinutes" type="number" min="0" value="40" /></label>
      <button type="submit" ${state.isSaving ? "disabled" : ""}>${state.isSaving ? "Creando..." : "Crear cita"}</button>
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
        <label>Buscar paciente o folio<input name="search" type="search" value="${escapeHtml(state.filters.search)}" placeholder="Paciente, profesional..." /></label>
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
                ["cancelled", "Cancelada"],
                ["rescheduled", "Reprogramada"],
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

  addChip("Busqueda", state.filters.search, "search");
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
  const currentLine = renderCurrentTimeLine(day);
  const hours = Array.from(
    { length: WORKDAY_END_HOUR - WORKDAY_START_HOUR },
    (_, index) => WORKDAY_START_HOUR + index,
  );

  return `
    <div class="calendar-day-column" data-day="${key}">
      ${hours
        .map((hour) => `<button class="calendar-slot" type="button" data-slot-date="${key}" data-slot-hour="${hour}" aria-label="Crear cita ${key} ${hour}:00"></button>`)
        .join("")}
      ${currentLine}
      ${positioned.map(renderAppointmentBlock).join("")}
    </div>
  `;
}

function renderCurrentTimeLine(day: Date): string {
  const now = new Date();

  if (toDateKey(now) !== toDateKey(day)) {
    return "";
  }

  const workdayMinutes = (WORKDAY_END_HOUR - WORKDAY_START_HOUR) * 60;
  const topMinutes = Math.min(
    Math.max((now.getHours() - WORKDAY_START_HOUR) * 60 + now.getMinutes(), 0),
    workdayMinutes,
  );
  const top = topMinutes * PIXELS_PER_MINUTE;
  return `<div class="calendar-current-time" style="top: ${top}px"><span>${escapeHtml(formatTime(now))}</span></div>`;
}

function renderAppointmentBlock(
  positioned: CalendarLayoutBlock<CalendarAppointment>,
): string {
  const { item } = positioned;
  const appointment = item.appointment;
  const start = positioned.startsAt;
  const end = positioned.endsAt;
  const status = getCalendarStatusConfig(item.visualState);
  const isCompact = positioned.durationMinutes < 45;
  const hasMeta = positioned.durationMinutes >= 60;
  const classes = [
    "calendar-appointment",
    `calendar-appointment--${status.tone}`,
    isCompact ? "calendar-appointment--compact" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <button class="${classes}" type="button" data-appointment-id="${escapeHtml(appointment.id)}" style="top: ${positioned.topPx}px; height: ${positioned.heightPx}px; left: calc(${positioned.leftPercent}% + 4px); width: calc(${positioned.widthPercent}% - 8px);">
      <span class="calendar-appointment__time">${escapeHtml(formatTime(start))} - ${escapeHtml(formatTime(end))}</span>
      <strong>${escapeHtml(appointment.patient.fullName)}</strong>
      ${isCompact ? "" : `<span class="calendar-appointment__secondary">${escapeHtml(appointment.appointmentType.name)}</span>`}
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
    !item.attendance && (role === "medico" || role === "terapeuta");

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
        <div><dt>Estado cita</dt><dd>${escapeHtml(appointment.status)}</dd></div>
        <div><dt>Asistencia</dt><dd><span class="calendar-status calendar-status--${status.tone}"><span aria-hidden="true"></span>${escapeHtml(status.label)}</span></dd></div>
        <div><dt>Check-in</dt><dd>${escapeHtml(item.attendance?.checkedAt ? formatDateTime(item.attendance.checkedAt) : "Sin registro")}</dd></div>
      </dl>
      <div class="calendar-detail-panel__actions">
        ${
          canManualCheckIn
            ? `<button type="button" data-calendar-action="manual-checkin" data-checkin-appointment-id="${escapeHtml(appointment.id)}">Check-in manual</button>`
            : `<button type="button" disabled>${item.attendance ? "Check-in registrado" : "Check-in manual no disponible"}</button>`
        }
        <button class="secondary-action" type="button" disabled>Check-in por gafete pendiente</button>
        <button class="secondary-action" type="button" disabled>${canOperate ? "Editar cuando API lo soporte" : "Sin permiso para editar"}</button>
        <button class="secondary-action" type="button" disabled>Reprogramar pendiente</button>
      </div>
      <p class="hint-text">Este panel no muestra diagnosticos ni notas clinicas.</p>
    </aside>
  `;
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
        ${items.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selectedValue ? "selected" : ""}>${escapeHtml(item.fullName ?? item.name ?? item.id)}</option>`).join("")}
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
        ${items.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selectedValue ? "selected" : ""}>${escapeHtml(item.fullName ?? item.name ?? item.id)}</option>`).join("")}
      </select>
    </label>
  `;
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
      updateFilter(root, state, target.name as keyof CalendarFilters, target.value);
    },
  );

  root.querySelector<HTMLFormElement>("[data-calendar-filters]")?.addEventListener(
    "input",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.name !== "search") {
        return;
      }
      state.filters.search = target.value;
      render(root, state);
    },
  );

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

async function createAppointmentFromForm(
  root: HTMLElement,
  state: CalendarState,
  data: FormData,
): Promise<void> {
  try {
    state.isSaving = true;
    render(root, state);
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
    state.isSaving = false;
    state.showCreateForm = false;
    state.draftStartsAt = null;
    render(root, state);
    await load(root, state);
  } catch (error) {
    state.isSaving = false;
    state.message = error instanceof Error ? error.message : "No se pudo crear la cita.";
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
        search: "",
        clinicId: "",
        collaboratorId: "",
        roomId: "",
        appointmentTypeId: "",
        appointmentStatus: "",
        attendanceStatus: "",
      };
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
    default:
      return;
  }
}

function updateFilter(
  root: HTMLElement,
  state: CalendarState,
  name: keyof CalendarFilters,
  value: string,
): void {
  state.filters[name] = value;
  state.isLoading = true;
  render(root, state);
  void load(root, state);
}

function getFilteredCalendarAppointments(state: CalendarState): CalendarAppointment[] {
  const search = state.filters.search.trim().toLowerCase();

  return toCalendarAppointments(state.appointments, state.attendance)
    .filter((item) => {
      const appointment = item.appointment;

      if (state.filters.roomId && appointment.room.id !== state.filters.roomId) {
        return false;
      }

      if (
        state.filters.appointmentTypeId &&
        appointment.appointmentType.id !== state.filters.appointmentTypeId
      ) {
        return false;
      }

      if (search) {
        const haystack = [
          appointment.patient.fullName,
          appointment.collaborator.fullName,
          appointment.clinic.name,
          appointment.room.name,
          appointment.appointmentType.name,
          appointment.id,
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(search)) {
          return false;
        }
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
  return CREATE_APPOINTMENT_ROLES.includes(role);
}

async function registerManualCheckIn(
  root: HTMLElement,
  state: CalendarState,
  appointmentId: string | undefined,
): Promise<void> {
  if (!appointmentId) return;

  try {
    state.isCheckingIn = true;
    await createAttendance({
      appointmentId,
      status: "present",
      notesRequired: false,
    });
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

function findCatalogLabel(items: readonly CatalogItem[], id: string): string {
  if (!id) return "";
  const item = items.find((candidate) => candidate.id === id);
  return item?.fullName ?? item?.name ?? id;
}

function nextBusinessStart(): Date {
  const start = new Date();
  start.setMinutes(0, 0, 0);

  if (start.getHours() < WORKDAY_START_HOUR) {
    start.setHours(WORKDAY_START_HOUR, 0, 0, 0);
  } else if (start.getHours() >= WORKDAY_END_HOUR) {
    start.setDate(start.getDate() + 1);
    start.setHours(WORKDAY_START_HOUR, 0, 0, 0);
  } else {
    start.setHours(start.getHours() + 1, 0, 0, 0);
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
