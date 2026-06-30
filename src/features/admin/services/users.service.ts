import { appConfig } from "../../../config/env";
import { adminApiClient } from "../../../services/admin-api/client";
import { mockUsers } from "../mocks/users.mock";
import { UserDto } from "../types/user.types";

class UsersService {
  async getAll(): Promise<readonly UserDto[]> {

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
    );
  }
}

export const usersService = new UsersService();