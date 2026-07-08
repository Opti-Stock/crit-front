import type { UserRole } from "../types/role.types";
import { hasPermission } from "../permissions/role-permissions";

const AP_ROLES: readonly UserRole[] = ["personal_acompanamiento"];

export function canAccessClinicalNotes(role: UserRole): boolean {
  return hasPermission(role, "medical-notes:read");
}

export function canAccessAdminEntry(role: UserRole): boolean {
  return hasPermission(role, "admin:entry");
}

export function canAccessAttendance(role: UserRole): boolean {
  return hasPermission(role, "attendance:read");
}

export function canAccessHandoffNotes(role: UserRole): boolean {
  return hasPermission(role, "handoff-notes:read");
}

export function canCreateHandoffNotes(role: UserRole): boolean {
  return hasPermission(role, "handoff-notes:write");
}

export function canAccessNotifications(role: UserRole): boolean {
  return hasPermission(role, "notifications:read");
}

export function isApRole(role: UserRole): boolean {
  return AP_ROLES.includes(role);
}

export function canWriteAppointments(role: UserRole): boolean {
  return hasPermission(role, "appointments:write");
}

export function canWriteMedicalNotes(role: UserRole): boolean {
  return hasPermission(role, "medical-notes:write");
}
