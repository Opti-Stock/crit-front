import { ROLE_NAVIGATION_CONFIG } from "../config/role-navigation.config";
import type { UserRole } from "../../../types/role.types";

export interface NavigationItem {
  key: string;
  label: string;
}

export function getMainNavigationForRole(role: UserRole): NavigationItem[] {
  return ROLE_NAVIGATION_CONFIG
    .filter((item) => item.app === "main" && item.allowedRoles.includes(role))
    .map((item) => ({
      key: item.key,
      label: item.label,
    }));
}

export function getAdminEntryForRole(role: UserRole): NavigationItem | null {
  const adminEntry = ROLE_NAVIGATION_CONFIG.find(
    (item) => item.app === "admin-entry" && item.allowedRoles.includes(role),
  );

  if (!adminEntry) {
    return null;
  }

  return {
    key: adminEntry.key,
    label: adminEntry.label,
  };
}