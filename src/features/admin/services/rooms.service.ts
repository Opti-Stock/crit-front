import { appConfig } from "../../../config/env";
import { adminApiClient } from "../../../services/admin-api/client";
import type { PaginationMeta } from "../../../types/api";
import { mockRooms } from "../mocks/rooms.mock";
import type { AdminListResult, RoomSummary } from "../types/admin.types";
import type { RoomDto } from "../types/room.types";

export interface CreateRoomInput {
  clinicId: string;
  name: string;
  capacity?: number;
}

export interface ListRoomsOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  clinicId?: string;
  status?: "active" | "inactive";
  includeDeleted?: boolean;
  sortBy?: "clinicName" | "name" | "capacity" | "status";
  sortDir?: "asc" | "desc";
}

class RoomsService {
  async list(options: ListRoomsOptions = {}): Promise<AdminListResult<RoomSummary>> {
    if (appConfig.adminMocksEnabled) {
      return paginateMock(mockRooms, options.page ?? 1, options.pageSize ?? mockRooms.length);
    }

    const response = await adminApiClient.requestWithMeta<readonly RoomDto[], PaginationMeta>("/rooms", {
      query: { ...options },
    });
    return { items: response.data, meta: response.meta ?? fallbackMeta(response.data.length, options) };
  }

  async getAll(options: ListRoomsOptions = {}): Promise<readonly RoomSummary[]> {
    const items: RoomSummary[] = [];
    for (let page = 1, totalPages = 1; page <= totalPages; page += 1) {
      const result = await this.list({ ...options, page, pageSize: 100 });
      items.push(...result.items);
      totalPages = result.meta.totalPages;
    }
    return items;
  }

  async create(input: CreateRoomInput): Promise<RoomSummary> {
    if (appConfig.adminMocksEnabled) {
      return {
        id: crypto.randomUUID(),
        clinicId: input.clinicId,
        name: input.name,
        capacity: input.capacity ?? null,
        status: "active",
      };
    }

    return adminApiClient.request<RoomDto>("/rooms", {
      method: "POST",
      body: {
        clinicId: input.clinicId,
        name: input.name,
        capacity: input.capacity,
      },
    });
  }

  async delete(roomId: string, reason?: string): Promise<void> {
    if (appConfig.adminMocksEnabled) {
      return;
    }

    await adminApiClient.request<void>(`/rooms/${encodeURIComponent(roomId)}`, {
      method: "DELETE",
      body: reason ? { reason } : undefined,
    });
  }

  async restore(roomId: string, reason?: string): Promise<RoomSummary> {
    if (appConfig.adminMocksEnabled) {
      throw new Error("Restore is unavailable with admin mocks enabled.");
    }

    return adminApiClient.request<RoomDto>(`/rooms/${encodeURIComponent(roomId)}/restore`, {
      method: "POST",
      body: reason ? { reason } : undefined,
    });
  }
}

export const roomsService = new RoomsService();

function fallbackMeta(total: number, options: ListRoomsOptions): PaginationMeta {
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
