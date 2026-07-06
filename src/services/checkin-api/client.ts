import { appConfig } from "../../config/env";
import { sessionService } from "../../features/auth/services/session.service";
import { createApiClient } from "../api-client";

export const checkinApiClient = createApiClient({
  baseUrl: appConfig.checkinApiUrl,
  getAccessToken: () => sessionService.getAccessToken(),
});
