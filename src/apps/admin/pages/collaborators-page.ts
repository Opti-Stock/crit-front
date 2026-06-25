import { mountAdminPageShell } from "./admin-page-shell";

export function mountCollaboratorsPage(root: HTMLElement): void {
  mountAdminPageShell(root, {
    title: "Colaboradores",
    description:
      "Admin placeholder for collaborator records, assignments and operational status.",
    moduleName: "collaborators",
    endpointHint: "/collaborators",
  });
}