import {
  checkInAppointment,
  listCheckinAppointments,
  type CheckinAppointmentSummary,
} from "../../services/checkin-api/appointments";
import { sessionService } from "../../features/auth/services/session.service";
import { escapeHtml } from "../../utils/dom";

interface CheckinState {
  date: string;
  search: string;
  appointments: CheckinAppointmentSummary[];
  isLoading: boolean;
  isSaving: boolean;
  message: string | null;
}

export function mountCheckinApp(root: HTMLElement): void {
  const today = new Date().toISOString().slice(0, 10);
  const params = new URLSearchParams(window.location.search);
  const state: CheckinState = {
    date: params.get("date") || today,
    search: "",
    appointments: [],
    isLoading: true,
    isSaving: false,
    message: null,
  };

  render(root, state);
  void load(root, state);
}

async function load(root: HTMLElement, state: CheckinState): Promise<void> {
  if (!sessionService.isAuthenticated()) {
    state.isLoading = false;
    state.message = "Inicia sesion en la app principal antes de registrar check-in.";
    render(root, state);
    return;
  }

  try {
    state.isLoading = true;
    render(root, state);
    state.appointments = await listCheckinAppointments({
      date: state.date,
      search: state.search || undefined,
      status: "scheduled",
    });
    state.message = null;
  } catch (error) {
    state.message =
      error instanceof Error ? error.message : "No se pudieron cargar las citas de check-in.";
  } finally {
    state.isLoading = false;
    render(root, state);
  }
}

function render(root: HTMLElement, state: CheckinState): void {
  const session = sessionService.getSession();

  root.innerHTML = `
    <main class="app-shell app-shell--main" aria-labelledby="checkin-title">
      <section class="app-content">
        <header class="app-header">
          <div>
            <p class="app-eyebrow">Check-in</p>
            <h1 id="checkin-title">Escaneo de gafete</h1>
          </div>
          <span class="app-status">${escapeHtml(session?.user?.email ?? "Sesion requerida")}</span>
        </header>

        <section class="feature-page">
          ${state.message ? `<p class="inline-alert" role="status">${escapeHtml(state.message)}</p>` : ""}
          <form class="filter-form" data-checkin-filter-form>
            <label>
              Fecha
              <input type="date" name="date" value="${escapeHtml(state.date)}" />
            </label>
            <label>
              Buscar paciente
              <input type="search" name="search" value="${escapeHtml(state.search)}" placeholder="Nombre del paciente o profesional" />
            </label>
            <button type="submit">Buscar</button>
            <a class="secondary-link" href="/index.html#attendance">Volver</a>
          </form>

          ${state.isLoading ? `<p class="empty-state">Cargando citas...</p>` : renderAppointments(state)}
        </section>
      </section>
    </main>
  `;

  root.querySelector<HTMLFormElement>("[data-checkin-filter-form]")?.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget as HTMLFormElement);
      state.date = String(data.get("date") ?? state.date);
      state.search = String(data.get("search") ?? "").trim();
      void load(root, state);
    },
  );

  root.querySelectorAll<HTMLButtonElement>("[data-checkin-appointment-id]").forEach((button) => {
    button.addEventListener("click", () => {
      void registerCheckIn(root, state, button.dataset.checkinAppointmentId);
    });
  });
}

function renderAppointments(state: CheckinState): string {
  if (state.appointments.length === 0) {
    return `<p class="empty-state">No hay citas pendientes para estos filtros.</p>`;
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Hora</th>
            <th>Paciente</th>
            <th>Profesional</th>
            <th>Area</th>
            <th>Check-in</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${state.appointments.map(renderAppointmentRow).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderAppointmentRow(appointment: CheckinAppointmentSummary): string {
  const checkedIn = appointment.checkInStatus === "checked_in";
  return `
    <tr>
      <td>${escapeHtml(formatTimeRange(appointment.startsAt, appointment.endsAt))}</td>
      <td>${escapeHtml(appointment.patient.fullName)}</td>
      <td>${escapeHtml(appointment.collaborator.fullName)}</td>
      <td>${escapeHtml(appointment.clinic.name)}</td>
      <td>${checkedIn ? "Con check-in" : "Sin check-in"}</td>
      <td>
        <button type="button" data-checkin-appointment-id="${escapeHtml(appointment.id)}" ${checkedIn ? "disabled" : ""}>
          Registrar
        </button>
      </td>
    </tr>
  `;
}

async function registerCheckIn(
  root: HTMLElement,
  state: CheckinState,
  appointmentId: string | undefined,
): Promise<void> {
  if (!appointmentId || state.isSaving) return;

  try {
    state.isSaving = true;
    await checkInAppointment(appointmentId);
    state.message = "Check-in registrado.";
    await load(root, state);
  } catch (error) {
    state.message = error instanceof Error ? error.message : "No se pudo registrar check-in.";
    render(root, state);
  } finally {
    state.isSaving = false;
  }
}

function formatTimeRange(startsAt: string, endsAt: string): string {
  const formatter = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formatter.format(new Date(startsAt))} - ${formatter.format(new Date(endsAt))}`;
}
