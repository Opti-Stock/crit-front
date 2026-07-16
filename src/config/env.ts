function readEnvValue(key: string, fallback: string): string {
  const value = import.meta.env[key];

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return fallback;
}

function readBooleanEnvValue(key: string, fallback: boolean): boolean {
  const value = import.meta.env[key];

  if (typeof value !== "string") {
    return fallback;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "false") {
    return false;
  }

  return fallback;
}

export const appConfig = {
  appName: readEnvValue("VITE_APP_NAME", "CRIT Assistance"),
  appEnv: readEnvValue("VITE_APP_ENV", "local"),
  mainApiUrl: readEnvValue("VITE_MAIN_API_URL", "/api"),
  adminApiUrl: readEnvValue("VITE_ADMIN_API_URL", "/admin"),
  checkinApiUrl: readEnvValue("VITE_CHECKIN_API_URL", "/checkin"),
  superAdminApiUrl: readEnvValue("VITE_SUPER_ADMIN_API_URL", "/super-admin"),
  authBypassEnabled: readBooleanEnvValue("VITE_AUTH_BYPASS_ENABLED", false),
  adminMocksEnabled: readBooleanEnvValue("VITE_USE_ADMIN_MOCKS", false),
} as const;

if (appConfig.appEnv !== "local" && (appConfig.authBypassEnabled || appConfig.adminMocksEnabled)) {
  throw new Error("Authentication bypass and admin mocks are only allowed locally.");
}
