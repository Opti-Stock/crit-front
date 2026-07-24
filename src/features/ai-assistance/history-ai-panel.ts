import { ApiClientError } from "../../services/api-client";
import {
  askNoteHistory,
  getAiInteraction,
  getLatestNoteSummary,
  getNoteSummary,
  listAiInteractions,
  rateAiInteraction,
  requestNoteSummary,
  type AiInteraction,
  type NoteHistoryKind,
  type NoteSummary,
} from "../../services/main-api/ai-assistance";
import { escapeHtml, formatDateTime } from "../../utils/dom";

export interface HistoryAiState {
  patientId: string;
  kind: NoteHistoryKind;
  initialized: boolean;
  loading: boolean;
  summary: NoteSummary | null;
  interactions: AiInteraction[];
  error: string | null;
  actionMessage: string | null;
}

const SUGGESTIONS: Record<NoteHistoryKind, string[]> = {
  medical: [
    "¿Qué pendientes explícitos aparecen en las notas?",
    "¿Qué cambios se documentaron recientemente?",
    "¿Qué alertas explícitas están registradas?",
  ],
  handoff: [
    "¿Qué asuntos siguen pendientes?",
    "¿Qué cambios de agenda se mencionan?",
    "¿Cuáles son los avisos más recientes?",
  ],
};

export function createHistoryAiState(kind: NoteHistoryKind): HistoryAiState {
  return {
    patientId: "",
    kind,
    initialized: false,
    loading: false,
    summary: null,
    interactions: [],
    error: null,
    actionMessage: null,
  };
}

export function prepareHistoryAiState(
  state: HistoryAiState,
  patientId: string,
  kind: NoteHistoryKind,
) {
  if (state.patientId === patientId && state.kind === kind) return;
  Object.assign(state, createHistoryAiState(kind), { patientId });
}

export function renderHistoryAiPanel(state: HistoryAiState): string {
  return `
    <section class="history-ai" data-history-ai-panel>
      <header class="history-ai__header">
        <div><p class="app-eyebrow">Asistencia local</p><h4>Resumen y preguntas al historial</h4></div>
        <button type="button" data-ai-summarize ${state.loading ? "disabled" : ""}>
          ${state.loading ? "Procesando..." : state.summary ? "Actualizar resumen" : "Resumir historial"}
        </button>
      </header>
      <p class="history-ai__warning">La IA puede equivocarse. Verifica siempre las notas fuente.</p>
      ${state.error ? `<p class="history-ai__error" role="alert">${escapeHtml(state.error)}</p>` : ""}
      ${state.actionMessage ? `<p class="history-ai__message" role="status">${escapeHtml(state.actionMessage)}</p>` : ""}
      ${renderSummary(state.summary)}
      ${renderQuestionComposer(state)}
      ${renderInteractions(state.interactions)}
    </section>
  `;
}

export function bindHistoryAiPanel(root: HTMLElement, state: HistoryAiState): void {
  const panel = root.querySelector<HTMLElement>("[data-history-ai-panel]");
  if (!panel || !state.patientId) return;
  if (!state.initialized && !state.loading) {
    state.initialized = true;
    state.loading = true;
    void loadPanel(root, state);
  }
  panel.querySelector<HTMLButtonElement>("[data-ai-summarize]")?.addEventListener(
    "click",
    () => void requestSummary(root, state),
  );
  panel.querySelector<HTMLFormElement>("[data-ai-question-form]")?.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget as HTMLFormElement);
      void askQuestion(root, state, String(data.get("question") ?? ""));
    },
  );
  panel.querySelectorAll<HTMLButtonElement>("[data-ai-suggestion]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = panel.querySelector<HTMLTextAreaElement>("[name=question]");
      if (input) {
        input.value = button.dataset.aiSuggestion ?? "";
        input.focus();
      }
    });
  });
  panel.querySelectorAll<HTMLButtonElement>("[data-ai-source-note-id]").forEach((button) => {
    button.addEventListener("click", () => navigateToSource(root, button.dataset.aiSourceNoteId));
  });
  panel.querySelectorAll<HTMLButtonElement>("[data-ai-feedback]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.aiInteractionId;
      const rating = button.dataset.aiFeedback;
      if (id && (rating === "helpful" || rating === "not_helpful")) {
        void submitFeedback(root, state, id, rating);
      }
    });
  });
}

async function loadPanel(root: HTMLElement, state: HistoryAiState) {
  const patientId = state.patientId;
  const kind = state.kind;
  try {
    const [summary, interactions] = await Promise.all([
      getLatestNoteSummary(patientId, kind).catch((error) => {
        if (error instanceof ApiClientError && error.status === 404) return null;
        throw error;
      }),
      listAiInteractions(patientId, kind),
    ]);
    if (!isCurrent(state, patientId, kind)) return;
    state.summary = summary;
    state.interactions = interactions.data;
    state.error = null;
  } catch (error) {
    state.error = errorMessage(error, "No se pudo cargar la asistencia del historial.");
  } finally {
    if (!isCurrent(state, patientId, kind)) return;
    state.loading = false;
    refresh(root, state);
  }
}

async function requestSummary(root: HTMLElement, state: HistoryAiState) {
  const patientId = state.patientId;
  const kind = state.kind;
  state.loading = true;
  state.error = null;
  state.actionMessage = "Resumen en cola.";
  refresh(root, state);
  try {
    state.summary = await requestNoteSummary(patientId, kind);
    if (!isCurrent(state, patientId, kind)) return;
    refresh(root, state);
    for (let attempt = 0; attempt < 150 && ["queued", "running"].includes(state.summary.status); attempt += 1) {
      await delay(2_000);
      if (!isCurrent(state, patientId, kind)) return;
      state.summary = await getNoteSummary(state.summary.id);
      refresh(root, state);
    }
  } catch (error) {
    state.error = errorMessage(error, "No se pudo solicitar el resumen.");
  } finally {
    if (!isCurrent(state, patientId, kind)) return;
    state.loading = false;
    refresh(root, state);
  }
}

async function askQuestion(root: HTMLElement, state: HistoryAiState, question: string) {
  const normalized = question.trim();
  if (!normalized) return;
  const patientId = state.patientId;
  const kind = state.kind;
  state.error = null;
  state.actionMessage = "Pregunta en cola.";
  refresh(root, state);
  try {
    let interaction = await askNoteHistory(patientId, kind, normalized);
    if (!isCurrent(state, patientId, kind)) return;
    state.interactions = [interaction, ...state.interactions];
    refresh(root, state);
    for (let attempt = 0; attempt < 150 && ["queued", "running"].includes(interaction.status); attempt += 1) {
      await delay(2_000);
      if (!isCurrent(state, patientId, kind)) return;
      interaction = await getAiInteraction(interaction.id);
      state.interactions = state.interactions.map((item) =>
        item.id === interaction.id ? interaction : item
      );
      refresh(root, state);
    }
  } catch (error) {
    state.error = errorMessage(error, "No se pudo enviar la pregunta.");
    refresh(root, state);
  }
}

async function submitFeedback(
  root: HTMLElement,
  state: HistoryAiState,
  interactionId: string,
  rating: "helpful" | "not_helpful",
) {
  try {
    const updated = await rateAiInteraction(
      interactionId,
      rating,
      undefined,
    );
    state.interactions = state.interactions.map((item) =>
      item.id === updated.id ? updated : item
    );
    state.actionMessage = "Gracias por registrar tu evaluación.";
  } catch (error) {
    state.error = errorMessage(error, "No se pudo guardar la evaluación.");
  }
  refresh(root, state);
}

function renderSummary(summary: NoteSummary | null): string {
  if (!summary) return `<p class="history-ai__empty">Aún no hay un resumen generado.</p>`;
  if (summary.status === "queued" || summary.status === "running") {
    return `<p class="history-ai__loading" role="status">Procesando todo el historial...</p>`;
  }
  if (summary.status === "failed") return `<p class="history-ai__error">No se pudo generar el resumen.</p>`;
  const content = summary.content ?? {};
  return `
    <article class="history-ai__summary${summary.status === "stale" ? " history-ai__summary--stale" : ""}">
      <div class="history-ai__summary-heading"><h5>Resumen del historial</h5>${summary.status === "stale" ? `<span>Desactualizado</span>` : ""}</div>
      <p>${escapeHtml(content.summary ?? "Sin contenido.")}</p>
      ${renderList("Puntos relevantes", content.relevantPoints)}
      ${renderList("Pendientes", content.pendingItems)}
      ${renderList("Alertas explícitas", content.explicitAlerts)}
      ${renderSourceButtons(summary.sources)}
      ${summary.generatedAt ? `<small>Generado ${escapeHtml(formatDateTime(summary.generatedAt))}${summary.model ? ` · ${escapeHtml(summary.model)}` : ""}</small>` : ""}
    </article>
  `;
}

function renderQuestionComposer(state: HistoryAiState): string {
  return `
    <form class="history-ai__question" data-ai-question-form>
      <label>Preguntar al historial<textarea name="question" maxlength="500" rows="3" required></textarea></label>
      <div class="history-ai__suggestions">
        ${SUGGESTIONS[state.kind].map((value) => `<button class="secondary-action" type="button" data-ai-suggestion="${escapeHtml(value)}">${escapeHtml(value)}</button>`).join("")}
      </div>
      <button type="submit">Preguntar</button>
    </form>
  `;
}

function renderInteractions(interactions: AiInteraction[]): string {
  return interactions.length === 0 ? "" : `
    <div class="history-ai__interactions">
      ${interactions.map((interaction) => `
        <article class="history-ai__interaction">
          <strong>${escapeHtml(interaction.question)}</strong>
          ${["queued", "running"].includes(interaction.status)
            ? `<p role="status">Procesando respuesta...</p>`
            : interaction.status === "failed"
              ? `<p class="history-ai__error">No se pudo generar la respuesta.</p>`
              : `<p>${escapeHtml(interaction.answer ?? "No hay evidencia suficiente en el historial.")}</p>`}
          ${interaction.status === "insufficient_information" ? `<span class="history-ai__insufficient">Información insuficiente</span>` : ""}
          ${renderSourceButtons(interaction.sources)}
          ${["supported", "insufficient_information"].includes(interaction.status)
            ? `<div class="history-ai__feedback"><span>¿Fue útil?</span>
                <button class="icon-button" type="button" aria-label="Útil" data-ai-feedback="helpful" data-ai-interaction-id="${escapeHtml(interaction.id)}">+</button>
                <button class="icon-button" type="button" aria-label="No útil" data-ai-feedback="not_helpful" data-ai-interaction-id="${escapeHtml(interaction.id)}">−</button>
              </div>`
            : ""}
        </article>
      `).join("")}
    </div>
  `;
}

function renderList(title: string, values: string[] | undefined) {
  return values?.length
    ? `<div><h6>${escapeHtml(title)}</h6><ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul></div>`
    : "";
}

function renderSourceButtons(sources: Array<{ noteId: string; createdAt: string }>) {
  return sources.length ? `
    <div class="history-ai__sources"><span>Fuentes</span>
      ${sources.map((source, index) => `<button class="text-action" type="button" data-ai-source-note-id="${escapeHtml(source.noteId)}">${index + 1} · ${escapeHtml(formatDateTime(source.createdAt))}</button>`).join("")}
    </div>
  ` : "";
}

function navigateToSource(root: HTMLElement, noteId: string | undefined) {
  if (!noteId) return;
  const escapedId = CSS.escape(noteId);
  const note = root.querySelector<HTMLElement>(
    `[data-note-id="${escapedId}"], [data-handoff-note-id="${escapedId}"]`,
  );
  note?.scrollIntoView({ behavior: "smooth", block: "center" });
  note?.setAttribute("tabindex", "-1");
  note?.focus({ preventScroll: true });
}

function refresh(root: HTMLElement, state: HistoryAiState) {
  const panel = root.querySelector<HTMLElement>("[data-history-ai-panel]");
  if (!panel) return;
  panel.outerHTML = renderHistoryAiPanel(state);
  bindHistoryAiPanel(root, state);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function isCurrent(
  state: HistoryAiState,
  patientId: string,
  kind: NoteHistoryKind,
) {
  return state.patientId === patientId && state.kind === kind;
}
