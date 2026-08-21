import { appConfig } from "../../../config/env";
import { adminApiClient } from "../../../services/admin-api/client";
import type { PaginationMeta } from "../../../types/api";
import { mockClinics } from "../mocks/clinics.mock";
import type { AdminListResult, ClinicSummary } from "../types/admin.types";
import { ClinicDto } from "../types/clinic.types";

export interface CreateClinicInput {
  name: string;
  specialization?: string;
  capacity?: number;
}

export interface ListClinicsOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: "active" | "inactive";
  includeDeleted?: boolean;
  sortBy?: "name" | "specialization" | "capacity" | "status";
  sortDir?: "asc" | "desc";
}

class ClinicsService {
  async list(options: ListClinicsOptions = {}): Promise<AdminListResult<ClinicSummary>> {
    if (appConfig.adminMocksEnabled) {
      return paginateMock(mockClinics, options.page ?? 1, options.pageSize ?? mockClinics.length);
    }

    const response = await adminApiClient.requestWithMeta<readonly ClinicDto[], PaginationMeta>(
        "/clinics",
        { query: { ...options } },
    );
    return { items: response.data, meta: response.meta ?? fallbackMeta(response.data.length, options) };
  }

  async getAll(options: ListClinicsOptions = {}): Promise<readonly ClinicSummary[]> {
    const items: ClinicSummary[] = [];
    for (let page = 1, totalPages = 1; page <= totalPages; page += 1) {
      const result = await this.list({ ...options, page, pageSize: 100 });
      items.push(...result.items);
      totalPages = result.meta.totalPages;
    }
    return items;
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

  async delete(clinicId: string, reason?: string): Promise<void> {
    if (appConfig.adminMocksEnabled) {
      return;
    }

    await adminApiClient.request<void>(`/clinics/${encodeURIComponent(clinicId)}`, {
      method: "DELETE",
      body: reason ? { reason } : undefined,
    });
  }

  async restore(clinicId: string, reason?: string): Promise<ClinicSummary> {
    if (appConfig.adminMocksEnabled) {
      throw new Error("Restore is unavailable with admin mocks enabled.");
    }

    return adminApiClient.request<ClinicDto>(`/clinics/${encodeURIComponent(clinicId)}/restore`, {
      method: "POST",
      body: reason ? { reason } : undefined,
    });
  }
}

export const clinicsService = new ClinicsService();

function fallbackMeta(total: number, options: ListClinicsOptions): PaginationMeta {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? (total || 1);
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

function paginateMock<T>(items: readonly T[], page: number, pageSize: number): AdminListResult<T> {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    meta: { page, pageSize, total: items.length, totalPages: Math.ceil(items.length / pageSize) },
  };
}
