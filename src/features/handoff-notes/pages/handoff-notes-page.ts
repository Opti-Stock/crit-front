import {
  createHandoffNote,
  listHandoffNotes,
  markHandoffNoteAsRead,
} from "../../../services/main-api/handoff-notes";
import { listPatients } from "../../../services/main-api/catalogs";
import type {
  CatalogItem,
  HandoffNoteSummary,
  HandoffPriority,
} from "../../../types/operational.types";
import type { UserRole } from "../../../types/role.types";
import { canCreateHandoffNotes } from "../../../guards/role-guard";
import { escapeHtml, formatDateTime } from "../../../utils/dom";

interface HandoffState {
  notes: HandoffNoteSummary[];
  patients: CatalogItem[];
  message: string | null;
  isLoading: boolean;
}

export function mountHandoffNotesPage(root: HTMLElement, role: UserRole): void {
  const state: HandoffState = {
    notes: [],
    patients: [],
    message: null,
    isLoading: true,
  };
  render(root, state, role);
  void load(root, state, role);
}

async function load(
  root: HTMLElement,
  state: HandoffState,
  role: UserRole,
): Promise<void> {
  try {
    const [notes, patients] = await Promise.all([
      listHandoffNotes({ pageSize: 50 }),
      listPatients({ pageSize: 100 }),
    ]);
    state.notes = notes.data;
    state.patients = patients.data;
    state.message = null;
  } catch (error) {
    state.message =
      error instanceof Error ? error.message : "No se pudieron cargar notas de enlace.";
  } finally {
    state.isLoading = false;
    render(root, state, role);
  }
}

function render(root: HTMLElement, state: HandoffState, role: UserRole): void {
  root.innerHTML = `
    <section class="feature-page">
      <header class="feature-header">
        <div><p class="app-eyebrow">Notas de enlace</p><h2>Seguimiento interno</h2></div>
      </header>
      ${state.message ? `<p class="inline-alert">${escapeHtml(state.message)}</p>` : ""}
      ${canCreateHandoffNotes(role) ? renderForm(state.patients) : ""}
      ${state.isLoading ? `<p class="empty-state">Cargando notas...</p>` : renderNotes(state.notes)}
    </section>
  `;
  bindEvents(root, state, role);
}

function renderForm(patients: CatalogItem[]): string {
  return `
    <form class="form-panel" data-handoff-form>
      <label>
        Paciente
        <select name="patientId" required>
          <option value="">Selecciona</option>
          ${patients.map((patient) => `<option value="${escapeHtml(patient.id)}">${escapeHtml(patient.fullName ?? patient.name ?? patient.id)}</option>`).join("")}
        </select>
      </label>
      <label>Titulo<input name="title" required maxlength="200" /></label>
      <label>Contenido<textarea name="content" required rows="3"></textarea></label>
      <label>
        Prioridad
        <select name="priority">
          <option value="medium">Media</option>
          <option value="low">Baja</option>
          <option value="high">Alta</option>
          <option value="urgent">Urgente</option>
        </select>
      </label>
      <label>Recipients user IDs<input name="recipientUserIds" placeholder="uuid, uuid" required /></label>
      <button type="submit">Crear nota</button>
    </form>
  `;
}

function renderNotes(notes: HandoffNoteSummary[]): string {
  if (notes.length === 0) return `<p class="empty-state">No hay notas de enlace.</p>`;
  return `<div class="data-list">${notes.map((note) => `
    <article class="data-card" data-handoff-id="${escapeHtml(note.id)}">
      <div class="data-card__header">
        <div><p class="data-card__meta">${formatDateTime(note.createdAt)} - ${escapeHtml(note.priority)}</p><h3>${escapeHtml(note.title)}</h3></div>
        <span class="status-pill">${escapeHtml(note.status)}</span>
      </div>
      <p>${escapeHtml(note.content)}</p>
      <p class="hint-text">Paciente: ${escapeHtml(note.patient.fullName)}. Recipients: ${note.recipients.map((recipient) => escapeHtml(recipient.fullName)).join(", ")}</p>
      <button type="button" data-mark-handoff-read>Marcar leida</button>
    </article>
  `).join("")}</div>`;
}

function bindEvents(root: HTMLElement, state: HandoffState, role: UserRole): void {
  root.querySelector<HTMLFormElement>("[data-handoff-form]")?.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget as HTMLFormElement);
      void submitHandoff(root, state, role, data);
    },
  );

  root.querySelectorAll<HTMLButtonElement>("[data-mark-handoff-read]").forEach(
    (button) => {
      button.addEventListener("click", () => {
        const id = button.closest<HTMLElement>("[data-handoff-id]")?.dataset.handoffId;
        if (id) void markRead(root, state, role, id);
      });
    },
  );
}

async function submitHandoff(
  root: HTMLElement,
  state: HandoffState,
  role: UserRole,
  data: FormData,
): Promise<void> {
  try {
    await createHandoffNote({
      patientId: String(data.get("patientId")),
      title: String(data.get("title")),
      content: String(data.get("content")),
      priority: String(data.get("priority") ?? "medium") as HandoffPriority,
      recipientUserIds: String(data.get("recipientUserIds"))
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    });
    await load(root, state, role);
  } catch (error) {
    state.message = error instanceof Error ? error.message : "No se pudo crear la nota.";
    render(root, state, role);
  }
}

async function markRead(
  root: HTMLElement,
  state: HandoffState,
  role: UserRole,
  id: string,
): Promise<void> {
  try {
    await markHandoffNoteAsRead(id);
    await load(root, state, role);
  } catch (error) {
    state.message = error instanceof Error ? error.message : "No se pudo marcar como leida.";
    render(root, state, role);
  }
}
