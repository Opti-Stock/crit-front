import type { UserRole } from "../types/role.types";

export type PermissionKey =
  | "admin:entry"
  | "appointments:write"
  | "attendance:read"
  | "handoff-notes:read"
  | "handoff-notes:write"
  | "medical-notes:read"
  | "medical-notes:write"
  | "notifications:read";

export const ROLE_PERMISSIONS: Record<UserRole, readonly PermissionKey[]> = {
  admin: [
    "admin:entry",
    "attendance:read",
    "handoff-notes:read",
    "medical-notes:read",
    "notifications:read",
  ],
  direccion: [
    "attendance:read",
    "handoff-notes:read",
    "medical-notes:read",
    "notifications:read",
  ],
  recepcion: [
    "appointments:write",
    "attendance:read",
    "handoff-notes:read",
    "handoff-notes:write",
    "notifications:read",
  ],
  coordinador: [
    "appointments:write",
    "attendance:read",
    "handoff-notes:read",
    "handoff-notes:write",
    "medical-notes:read",
    "notifications:read",
  ],
  medico: [
    "attendance:read",
    "handoff-notes:read",
    "handoff-notes:write",
    "medical-notes:read",
    "medical-notes:write",
    "notifications:read",
  ],
  terapeuta: [
    "attendance:read",
    "handoff-notes:read",
    "handoff-notes:write",
    "medical-notes:read",
    "medical-notes:write",
    "notifications:read",
  ],
  personal_acompanamiento: [
    "handoff-notes:read",
    "handoff-notes:write",
    "notifications:read",
  ],
  paciente_familia: [],
};

export function hasPermission(role: UserRole, permission: PermissionKey): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
