import { mountAdminPageShell } from "./admin-page-shell";

export function mountRolesPage(root: HTMLElement): void {
  mountAdminPageShell(root, {
    title: "Roles",
    description:
      "Admin placeholder for role catalog management and permission mapping.",
    moduleName: "roles",
    endpointHint: "/roles",
  });
}