import { mainApiClient } from "./client";
import type { ApiQueryValue, PaginationMeta } from "../../types/api";
import type {
  AttendanceStatus,
  AttendanceSummary,
} from "../../types/operational.types";

export interface ListAttendanceQuery {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  status?: AttendanceStatus;
  clinicId?: string;
  patientId?: string;
  collaboratorId?: string;
}

export interface CreateAttendanceInput {
  appointmentId: string;
  status: Exclude<AttendanceStatus, "pending">;
  notesRequired: boolean;
}

export interface UpdateAttendanceInput {
  status?: AttendanceStatus;
  notesRequired?: boolean;
}

export function listAttendance(query: ListAttendanceQuery = {}) {
  return mainApiClient.requestWithMeta<AttendanceSummary[], PaginationMeta>(
    "/attendance",
    { query: query as Record<string, ApiQueryValue> },
  );
}

export function createAttendance(input: CreateAttendanceInput) {
  return mainApiClient.request<AttendanceSummary>("/attendance", {
    method: "POST",
    body: { ...input },
  });
}

export function updateAttendanceStatus(
  attendanceId: string,
  input: UpdateAttendanceInput,
) {
  return mainApiClient.request<AttendanceSummary>(
    `/attendance/${encodeURIComponent(attendanceId)}`,
    {
      method: "PATCH",
      body: { ...input },
    },
  );
}
