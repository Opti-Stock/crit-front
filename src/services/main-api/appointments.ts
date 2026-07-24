import { mainApiClient } from "./client";
import type { ApiQueryValue, PaginationMeta } from "../../types/api";
import type { AppointmentSummary } from "../../types/operational.types";

export interface ListAppointmentsQuery {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  status?: string;
  clinicId?: string;
  patientId?: string;
  collaboratorId?: string;
}

export interface CreateAppointmentInput {
  patientId: string;
  collaboratorId: string;
  clinicId: string;
  roomId: string;
  appointmentTypeId: string;
  startsAt: string;
  endsAt: string;
  preSessionMinutes: number;
  postSessionMinutes: number;
  recommendationId?: string;
}

export interface UpdateAppointmentInput {
  patientId?: string;
  collaboratorId?: string;
  clinicId?: string;
  roomId?: string;
  appointmentTypeId?: string;
  startsAt?: string;
  endsAt?: string;
  preSessionMinutes?: number;
  postSessionMinutes?: number;
  recommendationId?: string;
  status?: "scheduled" | "cancelled" | "rescheduled";
}

export interface AppointmentRecommendation {
  recommendationId: string;
  startsAt: string;
  endsAt: string;
  patientId: string;
  clinic: { id: string; name: string };
  collaborator: { id: string; fullName: string };
  room: { id: string; name: string };
  appointmentType: { id: string; name: string };
  preSessionMinutes: number;
  postSessionMinutes: number;
  score: number;
  reasons: Array<{
    code:
      | "PATIENT_COMPACTION"
      | "COLLABORATOR_COMPACTION"
      | "ROOM_COMPACTION"
      | "PATIENT_PREFERENCE"
      | "COLLABORATOR_CONTINUITY"
      | "TEMPORAL_PROXIMITY";
    points: number;
  }>;
  metrics: {
    patientGapMinutes: number | null;
    collaboratorGapMinutes: number | null;
    roomGapMinutes: number | null;
    matchesPreference: boolean;
    keepsContinuity: boolean;
  };
}

export interface AppointmentRecommendationsResponse {
  timeZone: string | null;
  window: { localDate: string | null; days: number };
  criteria: {
    patientId: string;
    clinicId: string;
    collaboratorId: string | null;
    appointmentTypeId: string | null;
    roomId: string | null;
  };
  recommendations: AppointmentRecommendation[];
}

export function recommendAppointments(
  input: {
    patientId: string;
    clinicId: string;
    localDate?: string;
    collaboratorId?: string;
    appointmentTypeId?: string;
    roomId?: string;
    limit?: number;
  },
  signal?: AbortSignal,
) {
  return mainApiClient.request<AppointmentRecommendationsResponse>(
    "/appointments/recommendations",
    { method: "POST", body: input, signal },
  );
}

export function listAppointments(query: ListAppointmentsQuery = {}) {
  return mainApiClient.requestWithMeta<AppointmentSummary[], PaginationMeta>(
    "/appointments",
    { query: query as Record<string, ApiQueryValue> },
  );
}

export function createAppointment(input: CreateAppointmentInput) {
  return mainApiClient.request<AppointmentSummary>("/appointments", {
    method: "POST",
    body: { ...input },
  });
}

export function updateAppointment(appointmentId: string, input: UpdateAppointmentInput) {
  return mainApiClient.request<AppointmentSummary>(
    `/appointments/${encodeURIComponent(appointmentId)}`,
    {
      method: "PATCH",
      body: { ...input },
    },
  );
}
