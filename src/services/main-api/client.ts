import { appConfig } from "../../config/env";
import { sessionService } from "../../features/auth/services/session.service";
import { createApiClient } from "../api-client";

export const mainApiClient = createApiClient({
  baseUrl: appConfig.mainApiUrl,
  getAccessToken: () => sessionService.getAccessToken(),
});
