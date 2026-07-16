import { ApiClientError } from "../../services/api-client";
import { sessionService } from "../auth/services/session.service";
import { superAdminSessionService } from "../super-admin/services/super-admin-session.service";

export function installGlobalErrorHandling(): void {
  window.addEventListener("crit:http-error", (event) => {
    const error = (event as CustomEvent<ApiClientError>).detail;
    if (error.status === 401) {
      sessionService.clearSession();
      superAdminSessionService.clearSession();
    }
    navigateToError(String(error.status), error.payload?.requestId);
  });

  window.addEventListener("offline", () => navigateToError("offline"));
  window.addEventListener("error", () => navigateToError("500"));
  window.addEventListener("unhandledrejection", () => navigateToError("500"));
}

function navigateToError(status: string, requestId?: string): void {
  if (window.location.pathname.endsWith("/error.html")) return;
  const params = new URLSearchParams({ status });
  if (requestId) params.set("requestId", requestId);
  window.location.assign(`/error.html?${params.toString()}`);
}
