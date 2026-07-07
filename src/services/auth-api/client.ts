import { appConfig } from "../../config/env";
import { createApiClient } from "../api-client";

export const authApiClient = createApiClient({
  baseUrl: appConfig.mainApiUrl,
});