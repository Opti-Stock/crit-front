import { appConfig } from "../../../config/env";
import { adminApiClient } from "../../../services/admin-api/client";
import { mockRoles } from "../mocks/roles.mock";
import type { RoleSummary } from "../types/admin.types";

class RolesService {
  async getAll(): Promise<readonly RoleSummary[]> {
    if (appConfig.adminMocksEnabled) {
      return mockRoles;
    }

    return adminApiClient.request<readonly RoleSummary[]>(
      "/roles",
    );
  }
}

export const rolesService = new RolesService();