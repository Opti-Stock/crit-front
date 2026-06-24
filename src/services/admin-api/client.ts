import { appConfig } from "../../config/env";
import { createApiClient } from "../api-client";

export const adminApiClient = createApiClient({
  baseUrl: appConfig.adminApiUrl,
});
