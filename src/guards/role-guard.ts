import type { UserRole } from "../types/role.types";

const CLINICAL_NOTES_READ_ROLES: readonly UserRole[] = [
  "admin",
  "direccion",
  "coordinador",
  "medico",
  "terapeuta",
];
const CLINICAL_NOTES_WRITE_ROLES: readonly UserRole[] = ["medico", "terapeuta"];
const ADMIN_ENTRY_ROLES: readonly UserRole[] = ["admin"];
const ATTENDANCE_ROLES: readonly UserRole[] = [
  "recepcion",
  "coordinador",
  "medico",
  "terapeuta",
  "direccion",
  "admin",
];
const HANDOFF_NOTE_READ_ROLES: readonly UserRole[] = [
  "admin",
  "direccion",
  "recepcion",
  "coordinador",
  "medico",
  "terapeuta",
  "personal_acompanamiento",
];
const HANDOFF_NOTE_WRITE_ROLES: readonly UserRole[] = [
  "recepcion",
  "coordinador",
  "medico",
  "terapeuta",
  "personal_acompanamiento",
];
const NOTIFICATION_ROLES: readonly UserRole[] = HANDOFF_NOTE_READ_ROLES;
const AP_ROLES: readonly UserRole[] = ["personal_acompanamiento"];
const APPOINTMENT_WRITE_ROLES: readonly UserRole[] = ["recepcion", "coordinador"];

export function canAccessClinicalNotes(role: UserRole): boolean {
  return CLINICAL_NOTES_READ_ROLES.includes(role);
}

export function canAccessAdminEntry(role: UserRole): boolean {
  return ADMIN_ENTRY_ROLES.includes(role);
}

export function canAccessAttendance(role: UserRole): boolean {
  return ATTENDANCE_ROLES.includes(role);
}

export function canAccessHandoffNotes(role: UserRole): boolean {
  return HANDOFF_NOTE_READ_ROLES.includes(role);
}

export function canCreateHandoffNotes(role: UserRole): boolean {
  return HANDOFF_NOTE_WRITE_ROLES.includes(role);
}

export function canAccessNotifications(role: UserRole): boolean {
  return NOTIFICATION_ROLES.includes(role);
}

export function isApRole(role: UserRole): boolean {
  return AP_ROLES.includes(role);
}

export function canWriteAppointments(role: UserRole): boolean {
  return APPOINTMENT_WRITE_ROLES.includes(role);
}

export function canWriteMedicalNotes(role: UserRole): boolean {
  return CLINICAL_NOTES_WRITE_ROLES.includes(role);
}
