import { sessionService } from "../features/auth/services/session.service";

export function isAuthenticated(): boolean {
  return sessionService.isAuthenticated();
}