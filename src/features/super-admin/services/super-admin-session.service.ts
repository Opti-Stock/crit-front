export interface SuperAdminSession {
  accessToken: string;
  fullName: string;
  email: string;
}

const SESSION_STORAGE_KEY = "crit-assistance.super-admin-session";

export class SuperAdminSessionService {
  getSession(): SuperAdminSession | null {
    const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!rawSession) return null;

    try {
      const parsed = JSON.parse(rawSession) as Partial<SuperAdminSession>;
      if (!parsed.accessToken || !parsed.fullName || !parsed.email) {
        this.clearSession();
        return null;
      }
      return {
        accessToken: parsed.accessToken,
        fullName: parsed.fullName,
        email: parsed.email,
      };
    } catch {
      this.clearSession();
      return null;
    }
  }

  getAccessToken(): string | null {
    return this.getSession()?.accessToken ?? null;
  }

  setSession(session: SuperAdminSession): void {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  clearSession(): void {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

export const superAdminSessionService = new SuperAdminSessionService();
