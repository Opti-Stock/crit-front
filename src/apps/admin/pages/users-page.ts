import { mountAdminPageShell } from "./admin-page-shell";

export function mountUsersPage(root: HTMLElement): void {
  mountAdminPageShell(root, {
    title: "Usuarios",
    description:
      "Admin placeholder for user management, account lifecycle and access assignments.",
    moduleName: "users",
    endpointHint: "/users",
  });
}