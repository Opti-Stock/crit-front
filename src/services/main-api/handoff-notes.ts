import { mainApiClient } from "./client";
import type { PaginationMeta } from "../../types/api";
import type {
  HandoffNoteSummary,
  HandoffStatus,
} from "../../types/operational.types";

export function listHandoffNotes(query: {
  page?: number;
  pageSize?: number;
  status?: HandoffStatus;
  patientId?: string;
} = {}) {
  return mainApiClient.requestWithMeta<HandoffNoteSummary[], PaginationMeta>(
    "/handoff-notes",
    { query },
  );
}

export function createHandoffNote(input: {
  patientId: string;
  appointmentId?: string;
  title: string;
  content: string;
  recipientUserIds: string[];
}) {
  // Author identity is intentionally omitted; the API must derive it from the authenticated session.
  return mainApiClient.request<HandoffNoteSummary>("/handoff-notes", {
    method: "POST",
    body: input,
  });
}

export function markHandoffNoteAsRead(handoffNoteId: string) {
  return mainApiClient.request<HandoffNoteSummary>(
    `/handoff-notes/${encodeURIComponent(handoffNoteId)}/read`,
    { method: "PATCH" },
  );
}
