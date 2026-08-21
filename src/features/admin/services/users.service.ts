import { appConfig } from "../../../config/env";
import { adminApiClient } from "../../../services/admin-api/client";
import type { PaginationMeta } from "../../../types/api";
import { mockUsers } from "../mocks/users.mock";
import type { AdminListResult } from "../types/admin.types";
import { UserDto } from "../types/user.types";

export interface CreateUserInput {
  fullName: string;
  email: string;
  password: string;
  roleIds: string[];
  clinicAccess: { clinicId: string; accessLevel: "standard" | "manage" }[];
  specialty?: string;
  position?: string;
}

export interface ListUsersOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: "active" | "inactive";
  roleId?: string;
  includeDeleted?: boolean;
  sortBy?: "fullName" | "email" | "status";
  sortDir?: "asc" | "desc";
}

class UsersService {
  async list(options: ListUsersOptions = {}): Promise<AdminListResult<UserDto>> {

    if (appConfig.adminMocksEnabled) {
      return paginateMock(mockUsers, options.page ?? 1, options.pageSize ?? mockUsers.length);
    }

    const response = await adminApiClient.requestWithMeta<readonly UserDto[], PaginationMeta>(
      "/users",
      { query: { ...options } },
    );
    return { items: response.data, meta: response.meta ?? fallbackMeta(response.data.length, options) };
  }

  async getAll(options: ListUsersOptions = {}): Promise<readonly UserDto[]> {
    const items: UserDto[] = [];
    for (let page = 1, totalPages = 1; page <= totalPages; page += 1) {
      const result = await this.list({ ...options, page, pageSize: 100 });
      items.push(...result.items);
      totalPages = result.meta.totalPages;
    }
    return items;
  }

  async create(input: CreateUserInput): Promise<UserDto> {
    if (appConfig.adminMocksEnabled) {
      return {
        id: crypto.randomUUID(),
        fullName: input.fullName,
        email: input.email,
        status: "active",
        roles: input.roleIds.map((roleId) => ({ id: roleId, name: roleId })),
      };
    }

    return adminApiClient.request<UserDto>("/users", {
      method: "POST",
      body: {
        fullName: input.fullName,
        email: input.email,
        password: input.password,
        roleIds: input.roleIds,
        clinicAccess: input.clinicAccess,
        specialty: input.specialty,
        position: input.position,
      },
    });
  }

  async delete(userId: string, reason?: string): Promise<void> {
    if (appConfig.adminMocksEnabled) {
      return;
    }

    await adminApiClient.request<void>(`/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      body: reason ? { reason } : undefined,
    });
  }

  async restore(userId: string, reason?: string): Promise<UserDto> {
    if (appConfig.adminMocksEnabled) {
      throw new Error("Restore is unavailable with admin mocks enabled.");
    }

    return adminApiClient.request<UserDto>(`/users/${encodeURIComponent(userId)}/restore`, {
      method: "POST",
      body: reason ? { reason } : undefined,
    });
  }
}

export const usersService = new UsersService();

function fallbackMeta(total: number, options: ListUsersOptions): PaginationMeta {
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
