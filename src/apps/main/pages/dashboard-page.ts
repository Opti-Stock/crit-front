import { listAttendance } from "../../../services/main-api/attendance";
import { listAppointments } from "../../../services/main-api/appointments";
import { listHandoffNotes } from "../../../services/main-api/handoff-notes";
import { listMedicalNotes } from "../../../services/main-api/medical-notes";
import { listNotifications } from "../../../services/main-api/notifications";
import type {
  AppointmentSummary,
  AttendanceSummary,
  HandoffNoteSummary,
  MedicalNoteSummary,
  NotificationSummary,
} from "../../../types/operational.types";
import type { UserRole } from "../../../types/role.types";
import { escapeHtml } from "../../../utils/dom";

interface DashboardState {
  rangeDays: number;
  clinicId: string;
  appointments: AppointmentSummary[];
  clinicOptions: { id: string; name: string }[];
  attendance: AttendanceSummary[];
  medicalNotes: MedicalNoteSummary[];
  handoffNotes: HandoffNoteSummary[];
  notifications: NotificationSummary[];
  isLoading: boolean;
  error: string | null;
}

interface DashboardMetrics {
  totalAppointments: number;
  scheduledAppointments: number;
  cancelledAppointments: number;
  presentCount: number;
  absentCount: number;
  rescheduleCount: number;
  pendingAttendanceCount: number;
  checkedInCount: number;
  medicalNoteCount: number;
  pendingHandoffCount: number;
  unreadNotificationCount: number;
  attendanceRate: number;
  checkInRate: number;
  noteCoverageRate: number;
  clinicRows: ClinicMetricRow[];
  dailyRows: DailyMetricRow[];
}

interface ClinicMetricRow {
  clinicId: string;
  clinicName: string;
  appointments: number;
  attendanceRate: number;
  checkInRate: number;
  pendingAttendance: number;
}

interface DailyMetricRow {
  label: string;
  appointments: number;
  present: number;
  absent: number;
  rescheduled: number;
}

const DASHBOARD_ALLOWED_ROLES: readonly UserRole[] = ["admin", "direccion"];
const DASHBOARD_RANGE_OPTIONS = [
  { label: "7 dias", value: 7 },
  { label: "30 dias", value: 30 },
  { label: "90 dias", value: 90 },
] as const;

export function mountDashboardPage(root: HTMLElement, role: UserRole): void {
  if (!DASHBOARD_ALLOWED_ROLES.includes(role)) {
    root.innerHTML = `
      <section class="feature-page">
        <header class="feature-header">
          <div>
            <p class="app-eyebrow">Dashboard</p>
            <h2>Operational workspace</h2>
          </div>
        </header>
        <section class="app-panel">
          <h3>CRIT Assistance MVP</h3>
          <p>Selecciona una seccion del menu para trabajar con las vistas operativas.</p>
          <p>Rol actual: <strong>${escapeHtml(role)}</strong></p>
        </section>
      </section>
    `;
    return;
  }

  const state: DashboardState = {
    rangeDays: 30,
    clinicId: "all",
    appointments: [],
    clinicOptions: [],
    attendance: [],
    medicalNotes: [],
    handoffNotes: [],
    notifications: [],
    isLoading: true,
    error: null,
  };

  renderDashboard(root, role, state);
  void loadDashboard(root, role, state);
}

async function loadDashboard(
  root: HTMLElement,
  role: UserRole,
  state: DashboardState,
): Promise<void> {
  const range = getRange(state.rangeDays);

  try {
    state.isLoading = true;
    state.error = null;
    renderDashboard(root, role, state);

    const [
      appointments,
      clinicAppointments,
      attendance,
      medicalNotes,
      handoffNotes,
      notifications,
    ] =
      await Promise.all([
        listAppointments({
          pageSize: 500,
          from: range.from,
          to: range.to,
          clinicId: state.clinicId === "all" ? undefined : state.clinicId,
        }),
        listAppointments({
          pageSize: 500,
          from: range.from,
          to: range.to,
        }),
        listAttendance({
          pageSize: 500,
          from: range.from,
          to: range.to,
          clinicId: state.clinicId === "all" ? undefined : state.clinicId,
        }),
        listMedicalNotes({ pageSize: 500 }),
        listHandoffNotes({ pageSize: 500 }),
        listNotifications({ pageSize: 500 }),
      ]);

    state.appointments = appointments.data;
    state.clinicOptions = getClinics(clinicAppointments.data);
    state.attendance = attendance.data;
    state.medicalNotes = medicalNotes.data.filter((note) =>
      isInsideRange(note.createdAt, range.from, range.to),
    );
    state.handoffNotes = handoffNotes.data.filter((note) =>
      isInsideRange(note.createdAt, range.from, range.to),
    );
    state.notifications = notifications.data.filter((notification) =>
      isInsideRange(notification.createdAt, range.from, range.to),
    );
  } catch (error) {
    state.error =
      error instanceof Error
        ? error.message
        : "No se pudo cargar el dashboard ejecutivo.";
  } finally {
    state.isLoading = false;
    renderDashboard(root, role, state);
  }
}

function renderDashboard(
  root: HTMLElement,
  role: UserRole,
  state: DashboardState,
): void {
  const metrics = buildMetrics(state);
  const clinics = state.clinicOptions;

  root.innerHTML = `
    <section class="feature-page executive-dashboard">
      <header class="feature-header executive-dashboard__header">
        <div>
          <p class="app-eyebrow">Dashboard</p>
          <h2>Desempeno del centro</h2>
          <p class="executive-dashboard__subtitle">
            Vista ejecutiva para monitorear capacidad operativa, asistencia, check-in y pendientes clinicos.
          </p>
        </div>
        <span class="executive-dashboard__role">${formatRole(role)}</span>
      </header>

      <form class="executive-toolbar" data-dashboard-filters>
        <label>
          Periodo
          <select name="rangeDays">
            ${DASHBOARD_RANGE_OPTIONS.map(
              (option) => `
                <option value="${option.value}" ${option.value === state.rangeDays ? "selected" : ""}>
                  ${option.label}
                </option>
              `,
            ).join("")}
          </select>
        </label>
        <label>
          Clinica
          <select name="clinicId">
            <option value="all" ${state.clinicId === "all" ? "selected" : ""}>Todas las clinicas</option>
            ${clinics.map(
              (clinic) => `
                <option value="${escapeHtml(clinic.id)}" ${clinic.id === state.clinicId ? "selected" : ""}>
                  ${escapeHtml(clinic.name)}
                </option>
              `,
            ).join("")}
          </select>
        </label>
        <button type="submit" ${state.isLoading ? "disabled" : ""}>Actualizar</button>
      </form>

      ${state.error ? `<p class="inline-alert">${escapeHtml(state.error)}</p>` : ""}
      ${state.isLoading ? `<p class="empty-state">Cargando indicadores ejecutivos...</p>` : renderDashboardBody(metrics)}
    </section>
  `;

  root.querySelector<HTMLFormElement>("[data-dashboard-filters]")?.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget as HTMLFormElement);
      state.rangeDays = Number(data.get("rangeDays") ?? state.rangeDays);
      state.clinicId = String(data.get("clinicId") ?? "all");
      void loadDashboard(root, role, state);
    },
  );

  root.querySelectorAll<HTMLSelectElement>("[data-dashboard-filters] select").forEach(
    (select) => {
      select.addEventListener("change", () => {
        const form = select.form;
        if (!form) return;
        const data = new FormData(form);
        state.rangeDays = Number(data.get("rangeDays") ?? state.rangeDays);
        state.clinicId = String(data.get("clinicId") ?? "all");
        void loadDashboard(root, role, state);
      });
    },
  );
}

function renderDashboardBody(metrics: DashboardMetrics): string {
  return `
    <section class="executive-kpi-grid" aria-label="Indicadores principales">
      ${renderKpiCard("Citas", metrics.totalAppointments, `${metrics.scheduledAppointments} activas`, "primary")}
      ${renderKpiCard("Asistencia", `${metrics.attendanceRate}%`, `${metrics.presentCount} asistencias`, "success")}
      ${renderKpiCard("Check-in", `${metrics.checkInRate}%`, `${metrics.checkedInCount} con check-in`, "info")}
      ${renderKpiCard("Pendientes", metrics.pendingAttendanceCount, "asistencias sin cerrar", "warning")}
      ${renderKpiCard("Notas medicas", `${metrics.noteCoverageRate}%`, `${metrics.medicalNoteCount} capturadas`, "purple")}
      ${renderKpiCard("Enlace", metrics.pendingHandoffCount, "notas pendientes", "neutral")}
    </section>

    <section class="executive-dashboard__grid">
      <article class="app-panel executive-card executive-card--wide">
        <div class="executive-card__header">
          <div>
            <p class="app-eyebrow">Tendencia</p>
            <h3>Actividad por dia</h3>
          </div>
          <span>${metrics.totalAppointments} citas</span>
        </div>
        ${renderDailyChart(metrics.dailyRows)}
      </article>

      <article class="app-panel executive-card">
        <div class="executive-card__header">
          <div>
            <p class="app-eyebrow">Resultado</p>
            <h3>Asistencia clinica</h3>
          </div>
        </div>
        ${renderDonut(metrics)}
      </article>

      <article class="app-panel executive-card executive-card--wide">
        <div class="executive-card__header">
          <div>
            <p class="app-eyebrow">Clinicas</p>
            <h3>Desempeno por area</h3>
          </div>
          <span>${metrics.clinicRows.length} areas</span>
        </div>
        ${renderClinicTable(metrics.clinicRows)}
      </article>

      <article class="app-panel executive-card">
        <div class="executive-card__header">
          <div>
            <p class="app-eyebrow">Atencion</p>
            <h3>Focos operativos</h3>
          </div>
        </div>
        <div class="executive-focus-list">
          ${renderFocusItem("Solicitudes de reagendar", metrics.rescheduleCount, "warning")}
          ${renderFocusItem("Inasistencias", metrics.absentCount, "danger")}
          ${renderFocusItem("Citas canceladas", metrics.cancelledAppointments, "neutral")}
          ${renderFocusItem("Notificaciones no leidas", metrics.unreadNotificationCount, "info")}
        </div>
      </article>
    </section>
  `;
}

function renderKpiCard(
  label: string,
  value: string | number,
  detail: string,
  tone: string,
): string {
  return `
    <article class="executive-kpi executive-kpi--${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(detail)}</small>
    </article>
  `;
}

function renderDailyChart(rows: DailyMetricRow[]): string {
  if (rows.length === 0) {
    return `<p class="empty-state">No hay citas en el periodo seleccionado.</p>`;
  }

  const maxAppointments = Math.max(...rows.map((row) => row.appointments), 1);

  return `
    <div class="executive-bar-chart">
      ${rows.map((row) => {
        const height = Math.max(8, Math.round((row.appointments / maxAppointments) * 100));
        return `
          <div class="executive-bar-chart__item">
            <span class="executive-bar-chart__bar" style="height: ${height}%">
              <span>${row.appointments}</span>
            </span>
            <small>${escapeHtml(row.label)}</small>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderDonut(metrics: DashboardMetrics): string {
  const total = Math.max(
    metrics.presentCount + metrics.absentCount + metrics.rescheduleCount,
    1,
  );
  const present = Math.round((metrics.presentCount / total) * 100);
  const absent = Math.round((metrics.absentCount / total) * 100);
  const rescheduled = Math.max(0, 100 - present - absent);

  return `
    <div class="executive-donut" style="--present: ${present}; --absent: ${absent}; --rescheduled: ${rescheduled};">
      <div>
        <strong>${metrics.attendanceRate}%</strong>
        <span>asistencia</span>
      </div>
    </div>
    <div class="executive-legend">
      <span><i class="legend-dot legend-dot--success"></i>Asistio ${metrics.presentCount}</span>
      <span><i class="legend-dot legend-dot--danger"></i>No asistio ${metrics.absentCount}</span>
      <span><i class="legend-dot legend-dot--warning"></i>Por reagendar ${metrics.rescheduleCount}</span>
    </div>
  `;
}

function renderClinicTable(rows: ClinicMetricRow[]): string {
  if (rows.length === 0) {
    return `<p class="empty-state">No hay clinicas con citas en este periodo.</p>`;
  }

  return `
    <div class="executive-table-wrap">
      <table class="executive-table">
        <thead>
          <tr>
            <th>Clinica</th>
            <th>Citas</th>
            <th>Asistencia</th>
            <th>Check-in</th>
            <th>Pendientes</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHtml(row.clinicName)}</td>
              <td>${row.appointments}</td>
              <td>${row.attendanceRate}%</td>
              <td>${row.checkInRate}%</td>
              <td>${row.pendingAttendance}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderFocusItem(label: string, value: number, tone: string): string {
  return `
    <div class="executive-focus executive-focus--${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function buildMetrics(state: DashboardState): DashboardMetrics {
  const attendanceByAppointment = new Map(
    state.attendance.map((record) => [record.appointmentId, record]),
  );
  const notesByAppointment = new Set(
    state.medicalNotes.map((note) => note.appointmentId),
  );

  const appointments = state.appointments;
  const totalAppointments = appointments.length;
  const scheduledAppointments = appointments.filter(
    (appointment) => appointment.status === "scheduled",
  ).length;
  const cancelledAppointments = appointments.filter(
    (appointment) => appointment.status === "cancelled",
  ).length;
  const checkedInCount = appointments.filter((appointment) => appointment.isCheckedIn).length;
  const presentCount = countAttendance(appointments, attendanceByAppointment, "present");
  const absentCount = countAttendance(appointments, attendanceByAppointment, "absent");
  const rescheduleCount = countAttendance(appointments, attendanceByAppointment, "rescheduled");
  const pendingAttendanceCount = appointments.filter(
    (appointment) =>
      appointment.status !== "cancelled" &&
      !attendanceByAppointment.has(appointment.id),
  ).length;
  const medicalNoteCount = appointments.filter((appointment) =>
    notesByAppointment.has(appointment.id),
  ).length;
  const pendingHandoffCount = state.handoffNotes.filter(
    (note) => note.status === "pending",
  ).length;
  const unreadNotificationCount = state.notifications.filter(
    (notification) => !notification.readAt,
  ).length;

  return {
    totalAppointments,
    scheduledAppointments,
    cancelledAppointments,
    presentCount,
    absentCount,
    rescheduleCount,
    pendingAttendanceCount,
    checkedInCount,
    medicalNoteCount,
    pendingHandoffCount,
    unreadNotificationCount,
    attendanceRate: percent(presentCount, presentCount + absentCount + rescheduleCount),
    checkInRate: percent(checkedInCount, totalAppointments),
    noteCoverageRate: percent(medicalNoteCount, presentCount),
    clinicRows: buildClinicRows(appointments, attendanceByAppointment),
    dailyRows: buildDailyRows(appointments, attendanceByAppointment),
  };
}

function buildClinicRows(
  appointments: AppointmentSummary[],
  attendanceByAppointment: Map<string, AttendanceSummary>,
): ClinicMetricRow[] {
  const byClinic = new Map<string, AppointmentSummary[]>();

  appointments.forEach((appointment) => {
    const current = byClinic.get(appointment.clinic.id) ?? [];
    current.push(appointment);
    byClinic.set(appointment.clinic.id, current);
  });

  return Array.from(byClinic.entries())
    .map(([clinicId, clinicAppointments]) => {
      const present = countAttendance(clinicAppointments, attendanceByAppointment, "present");
      const absent = countAttendance(clinicAppointments, attendanceByAppointment, "absent");
      const rescheduled = countAttendance(
        clinicAppointments,
        attendanceByAppointment,
        "rescheduled",
      );
      const closed = present + absent + rescheduled;

      return {
        clinicId,
        clinicName: clinicAppointments[0]?.clinic.name ?? "Clinica sin nombre",
        appointments: clinicAppointments.length,
        attendanceRate: percent(present, closed),
        checkInRate: percent(
          clinicAppointments.filter((appointment) => appointment.isCheckedIn).length,
          clinicAppointments.length,
        ),
        pendingAttendance: clinicAppointments.filter(
          (appointment) =>
            appointment.status !== "cancelled" &&
            !attendanceByAppointment.has(appointment.id),
        ).length,
      };
    })
    .sort((left, right) => right.appointments - left.appointments);
}

function buildDailyRows(
  appointments: AppointmentSummary[],
  attendanceByAppointment: Map<string, AttendanceSummary>,
): DailyMetricRow[] {
  const byDay = new Map<string, AppointmentSummary[]>();

  appointments.forEach((appointment) => {
    const key = appointment.startsAt.slice(0, 10);
    const current = byDay.get(key) ?? [];
    current.push(appointment);
    byDay.set(key, current);
  });

  return Array.from(byDay.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-14)
    .map(([dateKey, dayAppointments]) => ({
      label: formatShortDate(dateKey),
      appointments: dayAppointments.length,
      present: countAttendance(dayAppointments, attendanceByAppointment, "present"),
      absent: countAttendance(dayAppointments, attendanceByAppointment, "absent"),
      rescheduled: countAttendance(dayAppointments, attendanceByAppointment, "rescheduled"),
    }));
}

function countAttendance(
  appointments: AppointmentSummary[],
  attendanceByAppointment: Map<string, AttendanceSummary>,
  status: AttendanceSummary["status"],
): number {
  return appointments.filter(
    (appointment) => attendanceByAppointment.get(appointment.id)?.status === status,
  ).length;
}

function getClinics(appointments: AppointmentSummary[]): { id: string; name: string }[] {
  const clinics = new Map<string, string>();

  appointments.forEach((appointment) => {
    clinics.set(appointment.clinic.id, appointment.clinic.name);
  });

  return Array.from(clinics.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function getRange(rangeDays: number): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now);
  from.setDate(now.getDate() - rangeDays + 1);
  from.setHours(0, 0, 0, 0);
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

function isInsideRange(value: string, from: string, to: string): boolean {
  const timestamp = new Date(value).getTime();
  return timestamp >= new Date(from).getTime() && timestamp <= new Date(to).getTime();
}

function percent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function formatShortDate(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatRole(role: UserRole): string {
  return role === "direccion" ? "Direccion" : "Admin";
}
