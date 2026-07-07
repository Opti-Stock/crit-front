import { mainApiClient } from "./client";
import type { AppointmentTypeSummary } from "../../types/operational.types";

export function listAppointmentTypes() {
  return mainApiClient.request<AppointmentTypeSummary[]>(
    "/calendar/appointment-types",
  );
}
