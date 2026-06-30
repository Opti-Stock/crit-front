import type { RoleSummary } from "../types/admin.types";

export const mockRoles: readonly RoleSummary[] = [
  {
    id: "1",
    name: "Administrador",
    description: "Acceso completo",
  },
  {
    id: "2",
    name: "Dirección",
    description: "Gestión operativa",
  }
];