import type { SessionData } from "../types/auth.types";
import { USER_ROLES } from "../../../types/role.types";

const SESSION_STORAGE_KEY = "crit-assistance.profile";

export class SessionService {
  getSession(): SessionData | null {
    const rawSession = window.sessionStorage.getItem(SESSION_STORAGE_KEY);

    if (!rawSession) {
      return null;
    }

    try {
      const parsedSession = JSON.parse(rawSession) as Partial<SessionData>;

      if (
        !parsedSession.role ||
        !USER_ROLES.includes(parsedSession.role)
      ) {
        this.clearSession();
        return null;
      }

      const session: SessionData = {
        role: parsedSession.role,
      };

      if (
        parsedSession.user &&
        typeof parsedSession.user === "object" &&
        typeof parsedSession.user.id === "string"
      ) {
        session.user = {
          id: parsedSession.user.id,
          fullName:
            typeof parsedSession.user.fullName === "string"
              ? parsedSession.user.fullName
              : undefined,
          email:
            typeof parsedSession.user.email === "string"
              ? parsedSession.user.email
              : undefined,
          area:
            typeof parsedSession.user.area === "string"
              ? parsedSession.user.area
              : undefined,
          collaboratorId:
            typeof parsedSession.user.collaboratorId === "string"
              ? parsedSession.user.collaboratorId
              : null,
        };
      }

      return session;
    } catch {
      this.clearSession();
      return null;
    }
  }

  getRole(): SessionData["role"] | null {
    return this.getSession()?.role ?? null;
  }

  setSession(session: SessionData): void {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  clearSession(): void {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }

  isAuthenticated(): boolean {
    return Boolean(this.getSession());
  }
}

export const sessionService = new SessionService();
