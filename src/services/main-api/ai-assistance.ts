import { mainApiClient } from "./client";
import type { PaginationMeta } from "../../types/api";

export type NoteHistoryKind = "medical" | "handoff";
export type AiWorkStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "stale"
  | "supported"
  | "insufficient_information";

export interface NoteSummary {
  id: string;
  patientId: string;
  kind: NoteHistoryKind;
  status: "queued" | "running" | "completed" | "failed" | "stale";
  content: {
    summary?: string;
    relevantPoints?: string[];
    pendingItems?: string[];
    explicitAlerts?: string[];
    sourceNoteIds?: string[];
  } | null;
  model: string | null;
  generatedAt: string | null;
  staleAt: string | null;
  sources: Array<{ noteId: string; createdAt: string }>;
}

export interface AiInteraction {
  id: string;
  patientId: string;
  kind: NoteHistoryKind;
  question: string;
  status: "queued" | "running" | "supported" | "insufficient_information" | "failed";
  answer: string | null;
  model: string | null;
  generatedAt: string | null;
  feedback: { rating: string; reason: string | null } | null;
  sources: Array<{
    noteId: string;
    createdAt: string;
    excerpt: string;
    rank: number;
    score: number;
  }>;
}

export function requestNoteSummary(patientId: string, kind: NoteHistoryKind) {
  return mainApiClient.request<NoteSummary>(
    `/patients/${encodeURIComponent(patientId)}/note-summaries`,
    { method: "POST", body: { kind } },
  );
}

export function getLatestNoteSummary(patientId: string, kind: NoteHistoryKind) {
  return mainApiClient.request<NoteSummary>(
    `/patients/${encodeURIComponent(patientId)}/note-summaries/latest`,
    { query: { kind } },
  );
}

export function getNoteSummary(summaryId: string) {
  return mainApiClient.request<NoteSummary>(
    `/note-summaries/${encodeURIComponent(summaryId)}`,
  );
}

export function askNoteHistory(
  patientId: string,
  kind: NoteHistoryKind,
  question: string,
) {
  return mainApiClient.request<AiInteraction>(
    `/patients/${encodeURIComponent(patientId)}/ai-questions`,
    { method: "POST", body: { kind, question } },
  );
}

export function getAiInteraction(interactionId: string) {
  return mainApiClient.request<AiInteraction>(
    `/ai-interactions/${encodeURIComponent(interactionId)}`,
  );
}

export function listAiInteractions(patientId: string, kind: NoteHistoryKind) {
  return mainApiClient.requestWithMeta<AiInteraction[], PaginationMeta>(
    `/patients/${encodeURIComponent(patientId)}/ai-interactions`,
    { query: { kind, page: 1, pageSize: 20 } },
  );
}

export function rateAiInteraction(
  interactionId: string,
  rating: "helpful" | "not_helpful",
  reason?: "incorrect" | "incomplete" | "irrelevant" | "missing_source",
) {
  return mainApiClient.request<AiInteraction>(
    `/ai-interactions/${encodeURIComponent(interactionId)}/feedback`,
    { method: "POST", body: { rating, ...(reason ? { reason } : {}) } },
  );
}
