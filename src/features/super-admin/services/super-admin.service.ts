import { superAdminApiClient } from "../../../services/super-admin-api/client";
import type {
  CreateTenantAdminInput,
  CreateTenantInput,
  TenantSummary,
} from "../types/super-admin.types";

interface LoginResponse {
  accessToken: string;
  superAdmin: {
    fullName: string;
    email: string;
  };
}

export const superAdminService = {
  login(input: { email: string; password: string }) {
    return superAdminApiClient.request<LoginResponse>("/auth/login", {
      method: "POST",
      body: input,
    });
  },

  listTenants() {
    return superAdminApiClient.request<TenantSummary[]>("/tenants");
  },

  createTenant(input: CreateTenantInput) {
    return superAdminApiClient.request<TenantSummary>("/tenants", {
      method: "POST",
      body: { ...input },
    });
  },

  createTenantAdmin(input: CreateTenantAdminInput) {
    return superAdminApiClient.request(`/tenants/${encodeURIComponent(input.tenantId)}/admin-users`, {
      method: "POST",
      body: {
        fullName: input.fullName,
        email: input.email,
        password: input.password,
      },
    });
  },
};
