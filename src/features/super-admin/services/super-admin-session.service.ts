export interface SuperAdminSession {
  fullName: string;
  email: string;
}

const SESSION_STORAGE_KEY = "crit-assistance.super-admin-profile";

export class SuperAdminSessionService {
  getSession(): SuperAdminSession | null {
    const rawSession = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!rawSession) return null;

    try {
      const parsed = JSON.parse(rawSession) as Partial<SuperAdminSession>;
      if (!parsed.fullName || !parsed.email) {
        this.clearSession();
        return null;
      }
      return {
        fullName: parsed.fullName,
        email: parsed.email,
      };
    } catch {
      this.clearSession();
      return null;
    }
  }

  setSession(session: SuperAdminSession): void {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  clearSession(): void {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

export const superAdminSessionService = new SuperAdminSessionService();
