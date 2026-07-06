import type { UserRole } from "../types/role.types";

const CLINICAL_NOTES_ROLES: readonly UserRole[] = ["medico", "terapeuta"];
const ADMIN_ENTRY_ROLES: readonly UserRole[] = ["direccion", "admin"];
const ATTENDANCE_ROLES: readonly UserRole[] = [
  "recepcion",
  "coordinador",
  "medico",
  "terapeuta",
  "direccion",
  "admin",
];
const HANDOFF_NOTE_ROLES: readonly UserRole[] = [
  "admin",
  "direccion",
  "recepcion",
  "coordinador",
  "medico",
  "terapeuta",
  "personal_acompanamiento",
];

export function canAccessClinicalNotes(role: UserRole): boolean {
  return CLINICAL_NOTES_ROLES.includes(role);
}

export function canAccessAdminEntry(role: UserRole): boolean {
  return ADMIN_ENTRY_ROLES.includes(role);
}

export function canAccessAttendance(role: UserRole): boolean {
  return ATTENDANCE_ROLES.includes(role);
}

export function canAccessHandoffNotes(role: UserRole): boolean {
  return HANDOFF_NOTE_ROLES.includes(role);
}

export function canCreateHandoffNotes(role: UserRole): boolean {
  return HANDOFF_NOTE_ROLES.includes(role);
}
