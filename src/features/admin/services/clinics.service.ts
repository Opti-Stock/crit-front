import { appConfig } from "../../../config/env";
import { adminApiClient } from "../../../services/admin-api/client";
import { mockClinics } from "../mocks/clinics.mock";
import type {
  AdminCollectionResponse,
  ClinicSummary,
} from "../types/admin.types";
import { ClinicDto } from "../types/clinic.types";

class ClinicsService {
  async getAll(): Promise<readonly ClinicSummary[]> {
    if (appConfig.adminMocksEnabled) {
        return mockClinics;
    }

    return adminApiClient.request<readonly ClinicDto[]>(
        "/clinics",
    );
  }
}

export const clinicsService = new ClinicsService();