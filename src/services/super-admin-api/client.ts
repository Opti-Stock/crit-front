import { appConfig } from "../../config/env";
import { createApiClient } from "../api-client";

export const superAdminApiClient = createApiClient({
  baseUrl: appConfig.superAdminApiUrl,
});
