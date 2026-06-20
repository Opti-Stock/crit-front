import type { SessionData } from "../types/auth.types";

const SESSION_STORAGE_KEY = "crit-assistance.session";

export class SessionService {
  getSession(): SessionData | null {
    const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY);

    if (!rawSession) {
      return null;
    }

    try {
      const parsedSession = JSON.parse(rawSession) as Partial<SessionData>;

      if (!parsedSession.accessToken || typeof parsedSession.accessToken !== "string") {
        this.clearSession();
        return null;
      }

      return {
        accessToken: parsedSession.accessToken,
      };
    } catch {
      this.clearSession();
      return null;
    }
  }

  getAccessToken(): string | null {
    return this.getSession()?.accessToken ?? null;
  }

  setSession(session: SessionData): void {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  clearSession(): void {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }

  isAuthenticated(): boolean {
    return Boolean(this.getAccessToken());
  }
}

export const sessionService = new SessionService();