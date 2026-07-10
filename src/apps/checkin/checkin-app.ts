import type { IScannerControls } from "@zxing/browser";
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
  lastScannedCode: string;
}

let activeScannerControls: IScannerControls | null = null;
let cameraScanPausedUntil = 0;

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
    lastScannedCode: "",
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
        <a class="checkin-back-button" href="/index.html#attendance" aria-label="Volver a asistencias">‹</a>
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
          ${renderFilterPanel(state)}

          ${state.scanned ? renderScannedPatientCard(state, "inline") : ""}
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

  root.querySelector<HTMLButtonElement>("[data-scan-card-close]")?.addEventListener("click", () => {
    closeScannedResult(root, state);
  });
}

function renderScannerPanel(state: CheckinState): string {
  return `
    <section class="app-panel checkin-scanner-panel">
      <div class="checkin-scanner-panel__header">
        <div>
          <p class="app-eyebrow">Escaneo de gafete</p>
          <h2>${state.mode === "reception-checkin" ? "Recepcion principal" : "Atencion terapeutica"}</h2>
        </div>
        <span class="checkin-mode-badge">${state.mode === "reception-checkin" ? "Check-in diario" : "Asistencia terapeutica"}</span>
      </div>
      <form class="checkin-scan-form" data-badge-scan-form>
        <label class="checkin-scan-form__input">
          Codigo de gafete
          <input data-badge-code type="search" autocomplete="off" placeholder="Escanea o escribe el codigo" value="${escapeHtml(state.lastScannedCode)}" autofocus />
        </label>
        <div class="checkin-scan-form__actions">
          <button type="submit" ${state.isSaving ? "disabled" : ""}>
            ${state.mode === "reception-checkin" ? "Check-in manual" : "Escanear manual"}
          </button>
          <button class="secondary-action" type="button" data-open-camera>Activar camara</button>
        </div>
      </form>
      <p class="hint-text" data-camera-status>${escapeHtml(state.cameraStatus)}</p>
      ${state.lastScannedCode ? `<p class="hint-text">Ultimo codigo leido: <strong>${escapeHtml(state.lastScannedCode)}</strong></p>` : ""}
      <div class="checkin-camera-frame" data-checkin-camera-frame hidden>
        <video class="checkin-camera" data-checkin-camera muted playsinline></video>
        <div class="checkin-camera-guide" aria-hidden="true"></div>
      </div>
    </section>
  `;
}

function renderFilterPanel(state: CheckinState): string {
  return `
    <form class="app-panel checkin-filter-panel" data-checkin-filter-form>
      <div>
        <p class="app-eyebrow">Citas visibles</p>
        <h2>Filtrar agenda</h2>
      </div>
      <div class="checkin-filter-panel__grid">
        <label>
          Fecha
          <input type="date" name="date" value="${escapeHtml(state.date)}" />
        </label>
        <label>
          Buscar paciente
          <input type="search" name="search" value="${escapeHtml(state.search)}" placeholder="Nombre, folio o profesional" />
        </label>
        <div class="checkin-filter-panel__actions">
          <button type="submit">Buscar</button>
        </div>
      </div>
    </form>
  `;
}

function renderScannedPatientCard(
  state: CheckinState,
  presentation: "inline" | "overlay" = "inline",
): string {
  const result = state.scanned;
  if (!result) return "";
  const appointment = result.appointments[0];
  const isTherapeutic = state.mode === "therapeutic-attendance";
  const cardTone = resolveScanCardTone(result);
  const title = resolveScanCardTitle(result, isTherapeutic);
  const description = resolveScanCardDescription(result, isTherapeutic);
  const card = `
      <article class="app-panel checkin-scan-card checkin-scan-card--${cardTone}">
        <button class="checkin-scan-card__close" type="button" data-scan-card-close aria-label="Cerrar resultado">x</button>
        <p class="app-eyebrow">${escapeHtml(title)}</p>
        <h2>${escapeHtml(result.patient.fullName)}</h2>
        <p class="hint-text">${escapeHtml(description)}</p>
        ${
          isTherapeutic && appointment
            ? `
              <div class="button-row checkin-scan-card__actions">
                <button type="button" data-therapeutic-attendance-action="present" data-appointment-id="${escapeHtml(appointment.id)}">Asistencia</button>
                <button type="button" data-therapeutic-attendance-action="absent" data-appointment-id="${escapeHtml(appointment.id)}">Inasistencia</button>
                <button class="secondary-action" type="button" data-therapeutic-attendance-action="rescheduled" data-appointment-id="${escapeHtml(appointment.id)}">Reagendar</button>
              </div>
            `
            : ""
        }
      </article>
  `;

  if (presentation === "overlay") {
    return `
      <div class="checkin-result-overlay" data-scan-result-overlay role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        ${card}
      </div>
    `;
  }

  return `
    ${card}
  `;
}

function renderAppointments(state: CheckinState): string {
  if (state.appointments.length === 0) {
    return `<p class="empty-state">No hay citas pendientes para estos filtros.</p>`;
  }

  return `
    <div class="table-wrap checkin-table-wrap">
      <table class="checkin-table">
        <thead>
          <tr>
            <th>Hora</th>
            <th>Paciente</th>
            <th>Profesional</th>
            <th>Area</th>
            <th>${state.mode === "reception-checkin" ? "Check-in" : "Asistencia"}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${state.appointments.map((appointment) => renderAppointmentRow(appointment, state.mode)).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderAppointmentRow(
  appointment: CheckinAppointmentSummary,
  mode: CheckinState["mode"],
): string {
  const checkedIn = appointment.checkInStatus === "checked_in";
  const attendanceLabel = appointment.attendance?.status ?? "Sin asistencia";
  return `
    <tr>
      <td>${escapeHtml(formatTimeRange(appointment.startsAt, appointment.endsAt))}</td>
      <td>${escapeHtml(appointment.patient.fullName)}</td>
      <td>${escapeHtml(appointment.collaborator.fullName)}</td>
      <td>${escapeHtml(appointment.clinic.name)}</td>
      <td>${mode === "reception-checkin" ? (checkedIn ? "Con check-in" : "Sin check-in") : escapeHtml(attendanceLabel)}</td>
      <td>
        ${
          mode === "reception-checkin"
            ? `
              <button type="button" data-checkin-appointment-id="${escapeHtml(appointment.id)}" ${checkedIn ? "disabled" : ""}>
                Registrar
              </button>
            `
            : `
              <div class="checkin-table-actions">
                <button type="button" data-therapeutic-attendance-action="present" data-appointment-id="${escapeHtml(appointment.id)}">Asistencia</button>
                <button class="secondary-action" type="button" data-therapeutic-attendance-action="absent" data-appointment-id="${escapeHtml(appointment.id)}">Inasistencia</button>
                <button class="secondary-action" type="button" data-therapeutic-attendance-action="rescheduled" data-appointment-id="${escapeHtml(appointment.id)}">Reagendar</button>
              </div>
            `
        }
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

async function scanBadge(
  root: HTMLElement,
  state: CheckinState,
  code: string,
  options: { fromCamera?: boolean; controls?: IScannerControls } = {},
): Promise<void> {
  if (state.isSaving) return;
  try {
    state.isSaving = true;
    state.lastScannedCode = code;
    state.scanned = await scanBadgeCheckIn({ code, date: state.date, mode: state.mode });
    state.message = null;

    if (options.fromCamera) {
      showScannedResultOverlay(root, state);
      if (state.mode === "reception-checkin") {
        cameraScanPausedUntil = Date.now() + 3000;
        window.setTimeout(() => closeScannedResult(root, state, { renderPage: false }), 3000);
      } else {
        cameraScanPausedUntil = Number.POSITIVE_INFINITY;
      }
      return;
    }

    await load(root, state);
    if (state.mode === "reception-checkin") {
      window.setTimeout(() => {
        closeScannedResult(root, state);
      }, 3000);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se encontro un paciente con ese codigo.";
    showScanOverlay(root, {
      title: "Codigo no valido",
      message,
      tone: "danger",
    });
    if (!options.fromCamera) {
      state.message = null;
    }
    cameraScanPausedUntil = Date.now() + 5000;
  } finally {
    state.isSaving = false;
  }
}

function showScannedResultOverlay(root: HTMLElement, state: CheckinState): void {
  root.querySelector("[data-scan-result-overlay]")?.remove();
  root.insertAdjacentHTML("beforeend", renderScannedPatientCard(state, "overlay"));

  root.querySelector<HTMLButtonElement>("[data-scan-result-overlay] [data-scan-card-close]")
    ?.addEventListener("click", () => closeScannedResult(root, state, { renderPage: false }));

  root.querySelectorAll<HTMLButtonElement>("[data-scan-result-overlay] [data-therapeutic-attendance-action]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.therapeuticAttendanceAction as "present" | "absent" | "rescheduled";
        const appointmentId = button.dataset.appointmentId;
        void resolveTherapeuticAttendance(root, state, appointmentId, action, { fromOverlay: true });
      });
    });
}

function closeScannedResult(
  root: HTMLElement,
  state: CheckinState,
  options: { renderPage?: boolean } = {},
): void {
  state.scanned = null;
  state.message = null;
  cameraScanPausedUntil = 0;
  root.querySelector("[data-scan-result-overlay]")?.remove();
  if (options.renderPage ?? true) {
    render(root, state);
    void openCameraScanner(root, state);
  }
}

function resolveScanCardTone(result: ScanCheckinResult): "success" | "warning" {
  return result.scanStatus === "no_appointments_today" || result.scanStatus === "therapeutic_no_appointments"
    ? "warning"
    : "success";
}

function resolveScanCardTitle(result: ScanCheckinResult, isTherapeutic: boolean): string {
  if (isTherapeutic) {
    return result.scanStatus === "therapeutic_no_appointments"
      ? "Paciente sin citas visibles hoy"
      : "Paciente encontrado";
  }

  if (result.scanStatus === "no_appointments_today") {
    return "Paciente sin citas hoy";
  }

  return result.scanStatus === "already_checked_in"
    ? "Check-in ya realizado"
    : "Check-in realizado";
}

function resolveScanCardDescription(result: ScanCheckinResult, isTherapeutic: boolean): string {
  if (isTherapeutic) {
    return result.appointments.length > 0
      ? "Selecciona asistencia, inasistencia o reagendar para cerrar este escaneo."
      : "El paciente es valido, pero no tiene citas visibles para tu acceso en la fecha seleccionada.";
  }

  if (result.scanStatus === "no_appointments_today") {
    return "El paciente es valido en este CRIT, pero no tiene citas el dia de hoy.";
  }

  return `${result.appointments.length} cita${result.appointments.length === 1 ? "" : "s"} del dia con check-in.`;
}

async function resolveTherapeuticAttendance(
  root: HTMLElement,
  state: CheckinState,
  appointmentId: string | undefined,
  status: "present" | "absent" | "rescheduled",
  options: { fromOverlay?: boolean } = {},
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
    cameraScanPausedUntil = 0;
    root.querySelector("[data-scan-result-overlay]")?.remove();
    if (options.fromOverlay) {
      state.appointments = state.appointments.map((candidate) =>
        candidate.id === appointment.id
          ? { ...candidate, attendanceStatus: status }
          : candidate
      );
      return;
    }
    await load(root, state);
    void openCameraScanner(root, state);
  } catch (error) {
    state.message = error instanceof Error ? error.message : "No se pudo actualizar la asistencia.";
    if (options.fromOverlay) {
      cameraScanPausedUntil = Date.now() + 5000;
      showScanOverlay(root, {
        title: "No se pudo actualizar",
        message: state.message,
        tone: "danger",
      });
      return;
    }
    render(root, state);
  } finally {
    state.isSaving = false;
  }
}

async function openCameraScanner(root: HTMLElement, state: CheckinState): Promise<void> {
  const video = root.querySelector<HTMLVideoElement>("[data-checkin-camera]");
  const cameraFrame = root.querySelector<HTMLElement>("[data-checkin-camera-frame]");
  if (!video) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    state.cameraStatus = "Camara no disponible en este navegador. Usa el campo de escaneo.";
    render(root, state);
    return;
  }

  try {
    activeScannerControls?.stop();
    activeScannerControls = null;
    if (cameraFrame) cameraFrame.hidden = false;
    state.cameraStatus = "Camara activa. Acerca el gafete al recuadro.";
    const status = root.querySelector<HTMLElement>("[data-camera-status]");
    if (status) status.textContent = state.cameraStatus;

    const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] =
      await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.QR_CODE,
    ]);
    const reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 120,
      delayBetweenScanSuccess: 700,
      tryPlayVideoTimeout: 5000,
    });
    activeScannerControls = await reader.decodeFromConstraints(
      {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      },
      video,
      (result, _error, controls) => {
        if (!result || state.isSaving || Date.now() < cameraScanPausedUntil) return;
        const code = result.getText().trim();
        if (!code) return;
        const input = root.querySelector<HTMLInputElement>("[data-badge-code]");
        if (input) input.value = code;
        void scanBadge(root, state, code, { fromCamera: true, controls });
      },
    );
  } catch {
    state.cameraStatus = "No se pudo abrir la camara. Usa el campo de escaneo.";
    render(root, state);
  }
}

function showScanOverlay(
  root: HTMLElement,
  input: { title: string; message: string; tone: "danger" | "success" },
): void {
  root.querySelector("[data-scan-overlay]")?.remove();
  const overlay = document.createElement("div");
  overlay.className = `checkin-scan-overlay checkin-scan-overlay--${input.tone}`;
  overlay.dataset.scanOverlay = "true";
  overlay.setAttribute("role", "status");
  overlay.innerHTML = `
    <article class="checkin-scan-overlay__card">
      <p class="app-eyebrow">${input.tone === "danger" ? "Escaneo rechazado" : "Escaneo correcto"}</p>
      <h2>${escapeHtml(input.title)}</h2>
      <p>${escapeHtml(input.message)}</p>
    </article>
  `;
  root.appendChild(overlay);
  window.setTimeout(() => overlay.remove(), 5000);
}

function formatTimeRange(startsAt: string, endsAt: string): string {
  const formatter = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formatter.format(new Date(startsAt))} - ${formatter.format(new Date(endsAt))}`;
}
