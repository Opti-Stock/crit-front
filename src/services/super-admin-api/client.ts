import { appConfig } from "../../config/env";
import { superAdminSessionService } from "../../features/super-admin/services/super-admin-session.service";
import { createApiClient } from "../api-client";

export const superAdminApiClient = createApiClient({
  baseUrl: appConfig.superAdminApiUrl,
  getAccessToken: () => superAdminSessionService.getAccessToken(),
});
