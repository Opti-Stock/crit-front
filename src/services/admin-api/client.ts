import { appConfig } from "../../config/env";
import { sessionService } from "../../features/auth/services/session.service";
import { createApiClient } from "../api-client";

export const adminApiClient = createApiClient({
  baseUrl: appConfig.adminApiUrl,
  getAccessToken: () => sessionService.getAccessToken(),
});
