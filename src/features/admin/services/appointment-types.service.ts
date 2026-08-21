import { adminApiClient } from "../../../services/admin-api/client";
import type { PaginationMeta } from "../../../types/api";
import type { AppointmentTypeSummary } from "../../../types/operational.types";
import type { AdminListResult } from "../types/admin.types";

export interface CreateAppointmentTypeInput {
  name: string;
  defaultDurationMinutes: number;
  defaultPreSessionMinutes?: number;
  defaultPostSessionMinutes?: number;
}

export interface ListAppointmentTypesOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: "name" | "defaultDurationMinutes" | "defaultPreSessionMinutes" | "defaultPostSessionMinutes";
  sortDir?: "asc" | "desc";
}

class AppointmentTypesService {
  async list(options: ListAppointmentTypesOptions = {}): Promise<AdminListResult<AppointmentTypeSummary>> {
    const response = await adminApiClient.requestWithMeta<readonly AppointmentTypeSummary[], PaginationMeta>(
      "/appointment-types",
      { query: { ...options } },
    );
    return { items: response.data, meta: response.meta ?? fallbackMeta(response.data.length, options) };
  }

  async getAll(options: ListAppointmentTypesOptions = {}): Promise<readonly AppointmentTypeSummary[]> {
    const items: AppointmentTypeSummary[] = [];
    for (let page = 1, totalPages = 1; page <= totalPages; page += 1) {
      const result = await this.list({ ...options, page, pageSize: 100 });
      items.push(...result.items);
      totalPages = result.meta.totalPages;
    }
    return items;
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

function fallbackMeta(total: number, options: ListAppointmentTypesOptions): PaginationMeta {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? (total || 1);
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}
