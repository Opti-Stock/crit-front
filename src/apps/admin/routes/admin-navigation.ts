export interface AdminNavigationItem {
  key: "users" | "roles" | "clinics" | "rooms" | "appointment-types";
  label: string;
}

export const ADMIN_NAVIGATION_ITEMS: readonly AdminNavigationItem[] = [
  { key: "users", label: "Usuarios" },
  { key: "roles", label: "Roles" },
  { key: "clinics", label: "Clinicas" },
  { key: "rooms", label: "Consultorios" },
  { key: "appointment-types", label: "Tipos de terapia" },
] as const;

export function resolveAdminNavigationKey(): AdminNavigationItem["key"] {
  const hashKey = window.location.hash.replace("#", "");

  const match = ADMIN_NAVIGATION_ITEMS.find((item) => item.key === hashKey);
  return match?.key ?? "users";
}

export function getAdminNavigationItem(
  key: AdminNavigationItem["key"],
): AdminNavigationItem {
  return (
    ADMIN_NAVIGATION_ITEMS.find((item) => item.key === key) ??
    ADMIN_NAVIGATION_ITEMS[0]
  );
}
