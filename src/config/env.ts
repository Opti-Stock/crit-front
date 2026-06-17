function readEnvValue(key: string, fallback: string): string {
  const value = import.meta.env[key];

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return fallback;
}

export const appConfig = {
  appName: readEnvValue("VITE_APP_NAME", "CRIT Assistance"),
  mainApiUrl: readEnvValue("VITE_MAIN_API_URL", "http://localhost:3000/api"),
  adminApiUrl: readEnvValue("VITE_ADMIN_API_URL", "http://localhost:3001/admin"),
} as const;
