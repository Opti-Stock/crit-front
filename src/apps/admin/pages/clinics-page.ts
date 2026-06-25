import { mountAdminPageShell } from "./admin-page-shell";

export function mountClinicsPage(root: HTMLElement): void {
  mountAdminPageShell(root, {
    title: "Clinicas",
    description:
      "Admin placeholder for clinic configuration, availability and organization data.",
    moduleName: "clinics",
    endpointHint: "/clinics",
  });
}