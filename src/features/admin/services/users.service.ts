import { appConfig } from "../../../config/env";
import { adminApiClient } from "../../../services/admin-api/client";
import { mockUsers } from "../mocks/users.mock";
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

class UsersService {
  async getAll(options: { includeDeleted?: boolean } = {}): Promise<readonly UserDto[]> {

    if (appConfig.adminMocksEnabled) {
      return mockUsers;
    }

    // TODO (Backend):
    // Confirm final response contract.
    //
    // If endpoint returns:
    //
    // {
    //   success: true,
    //   data: UserDto[]
    // }
    //
    // this is enough:
    //
    // return adminApiClient.request<readonly UserDto[]>("/users");
    //
    // If instead it returns:
    //
    // {
    //   success: true,
    //   data: {
    //     items:[]
    //   }
    // }
    //
    // then replace with:
    //
    // const response =
    //   await adminApiClient.request<{
    //     items: UserDto[];
    //   }>("/users");
    //
    // return response.items;

    return adminApiClient.request<readonly UserDto[]>(
      "/users",
      { query: options.includeDeleted ? { includeDeleted: true } : undefined },
    );
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

  async delete(userId: string): Promise<void> {
    if (appConfig.adminMocksEnabled) {
      return;
    }

    await adminApiClient.request<void>(`/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
  }

  async restore(userId: string): Promise<UserDto> {
    if (appConfig.adminMocksEnabled) {
      throw new Error("Restore is unavailable with admin mocks enabled.");
    }

    return adminApiClient.request<UserDto>(`/users/${encodeURIComponent(userId)}/restore`, {
      method: "POST",
    });
  }
}

export const usersService = new UsersService();
