import { appConfig } from "../../../config/env";
import { adminApiClient } from "../../../services/admin-api/client";
import { mockRooms } from "../mocks/rooms.mock";
import type { RoomSummary } from "../types/admin.types";
import type { RoomDto } from "../types/room.types";

export interface CreateRoomInput {
  clinicId: string;
  name: string;
  capacity?: number;
}

class RoomsService {
  async getAll(options: { includeDeleted?: boolean } = {}): Promise<readonly RoomSummary[]> {
    if (appConfig.adminMocksEnabled) {
      return mockRooms;
    }

    return adminApiClient.request<readonly RoomDto[]>("/rooms", {
      query: options.includeDeleted ? { includeDeleted: true } : undefined,
    });
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
