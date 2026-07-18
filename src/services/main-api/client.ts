import { appConfig } from "../../config/env";
import { createApiClient } from "../api-client";

export const mainApiClient = createApiClient({
  baseUrl: appConfig.mainApiUrl,
});
