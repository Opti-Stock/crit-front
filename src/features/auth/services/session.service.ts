import type { SessionData } from "../types/auth.types";
import { USER_ROLES } from "../../../types/role.types";

const SESSION_STORAGE_KEY = "crit-assistance.session";

export class SessionService {
  getSession(): SessionData | null {
    const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY);

    if (!rawSession) {
      return null;
    }

    try {
      const parsedSession = JSON.parse(rawSession) as Partial<SessionData>;

      if (
        !parsedSession.accessToken ||
        typeof parsedSession.accessToken !== "string" ||
        !parsedSession.role ||
        !USER_ROLES.includes(parsedSession.role)
      ) {
        this.clearSession();
        return null;
      }

      const session: SessionData = {
        accessToken: parsedSession.accessToken,
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
        };
      }

      return session;
    } catch {
      this.clearSession();
      return null;
    }
  }

  getAccessToken(): string | null {
    return this.getSession()?.accessToken ?? null;
  }

  getRole(): SessionData["role"] | null {
    return this.getSession()?.role ?? null;
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
  

  setAccessToken(accessToken: string): void {
  const session = this.getSession();

  if (!session) {
    return;
  }

  this.setSession({
    ...session,
    accessToken,
  });
}
}

export const sessionService = new SessionService();
