import { mainApiClient } from "./client";

export interface SchedulingTimeRange {
  id?: string;
  weekday: number;
  startTime: string;
  endTime: string;
  updatedAt?: string;
}

export interface SchedulingBlock {
  id: string;
  clinicId: string;
  collaboratorId: string | null;
  roomId: string | null;
  startsAt: string;
  endsAt: string;
  reason: string;
  createdAt: string;
}

const clinicPath = (clinicId: string) =>
  `/scheduling/clinics/${encodeURIComponent(clinicId)}`;

export const schedulingService = {
  listOperatingHours(clinicId: string) {
    return mainApiClient.request<SchedulingTimeRange[]>(
      `${clinicPath(clinicId)}/operating-hours`,
    );
  },

  replaceOperatingHours(
    clinicId: string,
    hours: readonly Omit<SchedulingTimeRange, "id" | "updatedAt">[],
  ) {
    return mainApiClient.request<SchedulingTimeRange[]>(
      `${clinicPath(clinicId)}/operating-hours`,
      { method: "PUT", body: { hours } },
    );
  },

  listClinicAppointmentTypes(clinicId: string) {
    return mainApiClient.request<{ appointmentTypeIds: string[] }>(
      `${clinicPath(clinicId)}/appointment-types`,
    );
  },

  replaceClinicAppointmentTypes(
    clinicId: string,
    appointmentTypeIds: readonly string[],
  ) {
    return mainApiClient.request<{ appointmentTypeIds: string[] }>(
      `${clinicPath(clinicId)}/appointment-types`,
      { method: "PUT", body: { appointmentTypeIds } },
    );
  },

  listCollaboratorAppointmentTypes(
    clinicId: string,
    collaboratorId: string,
  ) {
    return mainApiClient.request<{ appointmentTypeIds: string[] }>(
      `${clinicPath(clinicId)}/collaborators/${encodeURIComponent(collaboratorId)}/appointment-types`,
    );
  },

  replaceCollaboratorAppointmentTypes(
    clinicId: string,
    collaboratorId: string,
    appointmentTypeIds: readonly string[],
  ) {
    return mainApiClient.request<{ appointmentTypeIds: string[] }>(
      `${clinicPath(clinicId)}/collaborators/${encodeURIComponent(collaboratorId)}/appointment-types`,
      { method: "PUT", body: { appointmentTypeIds } },
    );
  },

  listRoomAppointmentTypes(clinicId: string, roomId: string) {
    return mainApiClient.request<{ appointmentTypeIds: string[] }>(
      `${clinicPath(clinicId)}/rooms/${encodeURIComponent(roomId)}/appointment-types`,
    );
  },

  replaceRoomAppointmentTypes(
    clinicId: string,
    roomId: string,
    appointmentTypeIds: readonly string[],
  ) {
    return mainApiClient.request<{ appointmentTypeIds: string[] }>(
      `${clinicPath(clinicId)}/rooms/${encodeURIComponent(roomId)}/appointment-types`,
      { method: "PUT", body: { appointmentTypeIds } },
    );
  },

  listBlocks(clinicId: string) {
    return mainApiClient.request<SchedulingBlock[]>(
      `${clinicPath(clinicId)}/blocks`,
    );
  },

  createBlock(
    clinicId: string,
    input: {
      collaboratorId?: string;
      roomId?: string;
      startsAt: string;
      endsAt: string;
      reason: string;
    },
  ) {
    return mainApiClient.request<SchedulingBlock>(
      `${clinicPath(clinicId)}/blocks`,
      { method: "POST", body: input },
    );
  },

  deleteBlock(clinicId: string, blockId: string) {
    return mainApiClient.request<void>(
      `${clinicPath(clinicId)}/blocks/${encodeURIComponent(blockId)}`,
      { method: "DELETE" },
    );
  },

  listPatientPreferences(
    clinicId: string,
    patientId: string,
  ) {
    return mainApiClient.request<SchedulingTimeRange[]>(
      `${clinicPath(clinicId)}/patients/${encodeURIComponent(patientId)}/preferences`,
    );
  },

  replacePatientPreferences(
    clinicId: string,
    patientId: string,
    preferences: readonly Omit<SchedulingTimeRange, "id" | "updatedAt">[],
  ) {
    return mainApiClient.request<SchedulingTimeRange[]>(
      `${clinicPath(clinicId)}/patients/${encodeURIComponent(patientId)}/preferences`,
      { method: "PUT", body: { preferences } },
    );
  },
};
