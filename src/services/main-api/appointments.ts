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
