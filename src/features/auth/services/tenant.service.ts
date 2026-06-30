import type { TenantOption } from "../types/auth.types";
import { authApiClient } from "../../../services/auth-api/client";

/**
 * Temporary tenant provider.
 *
 * TODO (Backend):
 * Replace this mock once the public tenants endpoint exists.
 *
 * Expected endpoint:
 *
 * return authApiClient.request<readonly TenantOption[]>("/auth/tenants");
 */
export async function getAvailableTenants(): Promise<
  readonly TenantOption[]
> {
  return [
    {
      code: "CRIT-OCC-01",
      name: "CRIT OCC 01",
    },
  ];
}