import { adminApiClient } from "../../../services/admin-api/client";
import type { AppointmentTypeSummary } from "../../../types/operational.types";

export interface CreateAppointmentTypeInput {
  name: string;
  defaultDurationMinutes: number;
  defaultPreSessionMinutes?: number;
  defaultPostSessionMinutes?: number;
}

class AppointmentTypesService {
  getAll(): Promise<readonly AppointmentTypeSummary[]> {
    return adminApiClient.request<readonly AppointmentTypeSummary[]>("/appointment-types");
  }

  create(input: CreateAppointmentTypeInput): Promise<AppointmentTypeSummary> {
    return adminApiClient.request<AppointmentTypeSummary>("/appointment-types", {
      method: "POST",
      body: {
        name: input.name,
        defaultDurationMinutes: input.defaultDurationMinutes,
        defaultPreSessionMinutes: input.defaultPreSessionMinutes ?? 0,
        defaultPostSessionMinutes: input.defaultPostSessionMinutes ?? 0,
      },
    });
  }
}

export const appointmentTypesService = new AppointmentTypesService();
