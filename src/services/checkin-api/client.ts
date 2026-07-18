import { appConfig } from "../../config/env";
import { createApiClient } from "../api-client";

export const checkinApiClient = createApiClient({
  baseUrl: appConfig.checkinApiUrl,
});
