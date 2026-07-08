import { appConfig } from "../../../config/env";
import { adminApiClient } from "../../../services/admin-api/client";
import { mockClinics } from "../mocks/clinics.mock";
import type { ClinicSummary } from "../types/admin.types";
import { ClinicDto } from "../types/clinic.types";

export interface CreateClinicInput {
  name: string;
  specialization?: string;
  capacity?: number;
}

class ClinicsService {
  async getAll(): Promise<readonly ClinicSummary[]> {
    if (appConfig.adminMocksEnabled) {
        return mockClinics;
    }

    return adminApiClient.request<readonly ClinicDto[]>(
        "/clinics",
    );
  }

  async create(input: CreateClinicInput): Promise<ClinicSummary> {
    if (appConfig.adminMocksEnabled) {
      return {
        id: crypto.randomUUID(),
        name: input.name,
        specialization: input.specialization ?? null,
        capacity: input.capacity ?? null,
        status: "active",
      };
    }

    return adminApiClient.request<ClinicDto>("/clinics", {
      method: "POST",
      body: {
        name: input.name,
        specialization: input.specialization,
        capacity: input.capacity,
      },
    });
  }

  async delete(clinicId: string): Promise<void> {
    if (appConfig.adminMocksEnabled) {
      return;
    }

    await adminApiClient.request<void>(`/clinics/${encodeURIComponent(clinicId)}`, {
      method: "DELETE",
    });
  }
}

export const clinicsService = new ClinicsService();
