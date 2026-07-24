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
      "admin",
      "direccion",
    ],
    app: "main",
  },
  {
    key: "attendance",
    label: "Asistencias",
    allowedRoles: [ "coordinador", "medico", "terapeuta", "direccion", "admin"],
    app: "main",
  },
  {
    key: "calendar",
    label: "Calendario",
    allowedRoles: ["recepcion", "coordinador", "direccion", "admin"],
    app: "main",
  },
  {
    key: "scheduling",
    label: "Configurar agenda",
    allowedRoles: ["recepcion", "coordinador", "admin"],
    app: "main",
  },
  {
    key: "badge-scan",
    label: "Escaneo de gafete",
    allowedRoles: ["recepcion", "recepcion_general"],
    app: "main",
  },
  {
    key: "medical-notes",
    label: "Notas medicas",
    allowedRoles: ["coordinador", "medico", "terapeuta","direccion", "admin"],
    app: "main",
  },
  {
    key: "handoff-notes",
    label: "Notas de enlace",
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
    allowedRoles: ["admin"],
    app: "admin-entry",
  },
] as const;
