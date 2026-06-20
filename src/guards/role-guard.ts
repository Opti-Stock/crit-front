import type { UserRole } from "../types/role.types";

const CLINICAL_NOTES_ROLES: readonly UserRole[] = ["medico", "terapeuta"];
const ADMIN_ENTRY_ROLES: readonly UserRole[] = ["direccion", "admin"];

export function canAccessClinicalNotes(role: UserRole): boolean {
  return CLINICAL_NOTES_ROLES.includes(role);
}

export function canAccessAdminEntry(role: UserRole): boolean {
  return ADMIN_ENTRY_ROLES.includes(role);
}