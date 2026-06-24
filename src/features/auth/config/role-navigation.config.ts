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
    allowedRoles: [
      "recepcion",
      "coordinador",
      "medico",
      "terapeuta",
      "personal_acompanamiento",
      "direccion",
      "admin",
    ],
    app: "main",
  },
  {
    key: "attendance",
    label: "Asistencias",
    allowedRoles: ["recepcion", "coordinador", "medico", "terapeuta", "direccion", "admin"],
    app: "main",
  },
  {
    key: "calendar",
    label: "Calendario",
    allowedRoles: ["recepcion", "coordinador", "medico", "terapeuta", "direccion", "admin"],
    app: "main",
  },
  {
    key: "medical-notes",
    label: "Notas medicas",
    allowedRoles: ["medico", "terapeuta"],
    app: "main",
  },
  {
    key: "handoff-notes",
    label: "Notas de enlace",
    allowedRoles: ["admin", "medico", "terapeuta", "personal_acompanamiento"],
    app: "main",
  },
  {
    key: "notifications",
    label: "Notificaciones",
    allowedRoles: [
      "recepcion",
      "coordinador",
      "medico",
      "terapeuta",
      "personal_acompanamiento",
      "direccion",
      "admin",
    ],
    app: "main",
  },
  {
    key: "admin",
    label: "Admin",
    allowedRoles: ["direccion", "admin"],
    app: "admin-entry",
  },
] as const;
