import type { UserRole } from "../../../types/role.types";

export interface NavigationItemConfig {
  key: string;
  label: string;
  allowedRoles: readonly UserRole[];
  app: "main" | "admin-entry";
}

export const ROLE_NAVIGATION_CONFIG: readonly NavigationItemConfig[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    allowedRoles: ["recepcion", "medico", "terapeuta", "direccion", "admin"],
    app: "main",
  },
  {
    key: "attendance",
    label: "Asistencias",
    allowedRoles: ["recepcion", "medico", "terapeuta"],
    app: "main",
  },
  {
    key: "calendar",
    label: "Calendario",
    allowedRoles: ["recepcion", "medico", "terapeuta"],
    app: "main",
  },
  {
    key: "notes",
    label: "Notas",
    allowedRoles: ["medico", "terapeuta"],
    app: "main",
  },
  {
    key: "admin",
    label: "Admin",
    allowedRoles: ["direccion", "admin"],
    app: "admin-entry",
  },
] as const;