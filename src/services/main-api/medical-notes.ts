import { mainApiClient } from "./client";
import type { PaginationMeta } from "../../types/api";
import type { MedicalNoteSummary } from "../../types/operational.types";

export function listMedicalNotes(query: {
  page?: number;
  pageSize?: number;
  patientId?: string;
  collaboratorId?: string;
} = {}) {
  return mainApiClient.requestWithMeta<MedicalNoteSummary[], PaginationMeta>(
    "/medical-notes",
    { query },
  );
}

export function createMedicalNote(input: {
  appointmentId: string;
  content: Record<string, unknown>;
  formatVersion: string;
}) {
  return mainApiClient.request<MedicalNoteSummary>("/medical-notes", {
    method: "POST",
    body: input,
  });
}
