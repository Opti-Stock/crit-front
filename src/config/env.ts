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
  mainApiUrl: readEnvValue("VITE_MAIN_API_URL", "http://localhost:3000/api"),
  adminApiUrl: readEnvValue("VITE_ADMIN_API_URL", "http://localhost:3001/admin"),
  checkinApiUrl: readEnvValue("VITE_CHECKIN_API_URL", "http://localhost:3002/checkin"),
  superAdminApiUrl: readEnvValue("VITE_SUPER_ADMIN_API_URL", "http://localhost:3003/super-admin"),
  authBypassEnabled: readBooleanEnvValue("VITE_AUTH_BYPASS_ENABLED", false),
  adminMocksEnabled: readBooleanEnvValue("VITE_USE_ADMIN_MOCKS", false),
} as const;
