import {
  checkInAppointment,
  listCheckinAppointments,
  scanBadgeCheckIn,
  type ScanCheckinResult,
  type CheckinAppointmentSummary,
} from "../../services/checkin-api/appointments";
import { sessionService } from "../../features/auth/services/session.service";
import { escapeHtml } from "../../utils/dom";
import { createAttendance, updateAttendanceStatus } from "../../services/main-api/attendance";

interface CheckinState {
  date: string;
  search: string;
  mode: "reception-checkin" | "therapeutic-attendance";
  appointments: CheckinAppointmentSummary[];
  scanned: ScanCheckinResult | null;
  isLoading: boolean;
  isSaving: boolean;
  cameraStatus: string;
  message: string | null;
}

interface BarcodeDetection {
  rawValue: string;
}

interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement): Promise<BarcodeDetection[]>;
}

type BarcodeDetectorConstructor = new (options: {
  formats: string[];
}) => BarcodeDetectorInstance;

export function mountCheckinApp(root: HTMLElement): void {
  const today = new Date().toISOString().slice(0, 10);
  const params = new URLSearchParams(window.location.search);
  const state: CheckinState = {
    date: params.get("date") || today,
    search: "",
    mode: params.get("mode") === "therapeutic-attendance" ? "therapeutic-attendance" : "reception-checkin",
    appointments: [],
    scanned: null,
    isLoading: true,
    isSaving: false,
    cameraStatus: "Camara pendiente",
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
    <main class="app-shell app-shell--checkin" aria-labelledby="checkin-title">
      <section class="app-content app-content--checkin">
        <header class="app-header">
          <div>
            <p class="app-eyebrow">Check-in</p>
            <h1 id="checkin-title">${state.mode === "reception-checkin" ? "Recepcion principal" : "Escaneo terapeutico"}</h1>
          </div>
          <span class="app-status">${escapeHtml(session?.user?.email ?? "Sesion requerida")}</span>
        </header>

        <section class="feature-page checkin-page">
          ${state.message ? `<p class="inline-alert" role="status">${escapeHtml(state.message)}</p>` : ""}
          ${renderScannerPanel(state)}
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

          ${state.scanned ? renderScannedPatientCard(state) : ""}
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

  root.querySelector<HTMLFormElement>("[data-badge-scan-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = root.querySelector<HTMLInputElement>("[data-badge-code]");
    const code = input?.value.trim() ?? "";
    if (!code) return;
    if (input) input.value = "";
    void scanBadge(root, state, code);
  });

  root.querySelector<HTMLButtonElement>("[data-open-camera]")?.addEventListener("click", () => {
    void openCameraScanner(root, state);
  });

  root.querySelectorAll<HTMLButtonElement>("[data-therapeutic-attendance-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.therapeuticAttendanceAction as "present" | "absent" | "rescheduled";
      const appointmentId = button.dataset.appointmentId;
      void resolveTherapeuticAttendance(root, state, appointmentId, action);
    });
  });
}

function renderScannerPanel(state: CheckinState): string {
  return `
    <section class="app-panel checkin-scanner-panel">
      <div>
        <p class="app-eyebrow">Escaneo de gafete</p>
        <h2>${state.mode === "reception-checkin" ? "Recepcion principal" : "Atencion terapeutica"}</h2>
      </div>
      <form class="checkin-scan-form" data-badge-scan-form>
        <label class="checkin-scan-form__input">
          Codigo de gafete
          <input data-badge-code type="search" autocomplete="off" placeholder="Escanea o escribe el codigo" autofocus />
        </label>
        <div class="checkin-scan-form__actions">
          <button type="submit" ${state.isSaving ? "disabled" : ""}>Check-in manual</button>
          <button class="secondary-action" type="button" data-open-camera>Activar camara</button>
        </div>
      </form>
      <p class="hint-text" data-camera-status>${escapeHtml(state.cameraStatus)}</p>
      <video class="checkin-camera" data-checkin-camera muted playsinline hidden></video>
    </section>
  `;
}

function renderScannedPatientCard(state: CheckinState): string {
  const result = state.scanned;
  if (!result) return "";
  const checkedLabel = result.alreadyCheckedIn ? "Ya tenia check-in hoy" : "Check-in registrado";
  const appointment = result.appointments[0];
  return `
    <article class="app-panel checkin-scan-card">
      <p class="app-eyebrow">${escapeHtml(checkedLabel)}</p>
      <h2>${escapeHtml(result.patient.fullName)}</h2>
      <p class="hint-text">${result.appointments.length} citas del dia con check-in.</p>
      ${
        state.mode === "therapeutic-attendance" && appointment
          ? `
            <div class="button-row">
              <button type="button" data-therapeutic-attendance-action="present" data-appointment-id="${escapeHtml(appointment.id)}">Asistencia</button>
              <button type="button" data-therapeutic-attendance-action="absent" data-appointment-id="${escapeHtml(appointment.id)}">Inasistencia</button>
              <button class="secondary-action" type="button" data-therapeutic-attendance-action="rescheduled" data-appointment-id="${escapeHtml(appointment.id)}">Reagendar</button>
            </div>
          `
          : ""
      }
    </article>
  `;
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

async function scanBadge(root: HTMLElement, state: CheckinState, code: string): Promise<void> {
  if (state.isSaving) return;
  try {
    state.isSaving = true;
    state.scanned = await scanBadgeCheckIn({ code, date: state.date });
    state.message = state.scanned.alreadyCheckedIn ? "El paciente ya tenia check-in hoy." : "Check-in registrado correctamente.";
    await load(root, state);
    if (state.mode === "reception-checkin") {
      window.setTimeout(() => {
        state.scanned = null;
        state.message = null;
        render(root, state);
      }, 3000);
    }
  } catch (error) {
    state.message = error instanceof Error ? error.message : "No se pudo registrar el gafete.";
    render(root, state);
  } finally {
    state.isSaving = false;
  }
}

async function resolveTherapeuticAttendance(
  root: HTMLElement,
  state: CheckinState,
  appointmentId: string | undefined,
  status: "present" | "absent" | "rescheduled",
): Promise<void> {
  if (!appointmentId) return;
  const appointment = state.appointments.find((candidate) => candidate.id === appointmentId)
    ?? state.scanned?.appointments.find((candidate) => candidate.id === appointmentId);
  if (!appointment) return;

  try {
    state.isSaving = true;
    if (appointment.attendance?.id) {
      await updateAttendanceStatus(appointment.attendance.id, { status });
    } else {
      await createAttendance({ appointmentId, status, notesRequired: status === "present" });
    }
    state.scanned = null;
    state.message = "Asistencia actualizada.";
    await load(root, state);
  } catch (error) {
    state.message = error instanceof Error ? error.message : "No se pudo actualizar la asistencia.";
    render(root, state);
  } finally {
    state.isSaving = false;
  }
}

async function openCameraScanner(root: HTMLElement, state: CheckinState): Promise<void> {
  const video = root.querySelector<HTMLVideoElement>("[data-checkin-camera]");
  if (!video) return;
  const barcodeDetectorCtor = (window as Window & {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }).BarcodeDetector;
  if (!navigator.mediaDevices?.getUserMedia) {
    state.cameraStatus = "Camara no disponible en este navegador. Usa el campo de escaneo.";
    render(root, state);
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = stream;
    video.hidden = false;
    await video.play();
    if (!barcodeDetectorCtor) {
      state.cameraStatus = "Permiso de camara activo. Este navegador no lee codigos automaticamente; usa el lector fisico o captura manual.";
      const status = root.querySelector<HTMLElement>("[data-camera-status]");
      if (status) status.textContent = state.cameraStatus;
      return;
    }
    state.cameraStatus = "Camara activa. Acerca el gafete al lector.";
    const status = root.querySelector<HTMLElement>("[data-camera-status]");
    if (status) status.textContent = state.cameraStatus;

    const detector = new barcodeDetectorCtor({ formats: ["code_128", "code_39", "ean_13", "qr_code"] });
    const scanLoop = async () => {
      if (!video.isConnected || video.hidden) return;
      const codes = await detector.detect(video);
      const code = codes[0]?.rawValue;
      if (code) {
        stream.getTracks().forEach((track) => track.stop());
        await scanBadge(root, state, code);
        if (state.mode === "reception-checkin") {
          window.setTimeout(() => void openCameraScanner(root, state), 3200);
        }
        return;
      }
      window.setTimeout(scanLoop, 250);
    };
    window.setTimeout(scanLoop, 500);
  } catch {
    state.cameraStatus = "No se pudo abrir la camara. Usa el campo de escaneo.";
    render(root, state);
  }
}

function formatTimeRange(startsAt: string, endsAt: string): string {
  const formatter = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formatter.format(new Date(startsAt))} - ${formatter.format(new Date(endsAt))}`;
}
