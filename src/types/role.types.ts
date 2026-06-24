export const USER_ROLES = [
  "recepcion",
  "medico",
  "terapeuta",
  "direccion",
  "admin",
] as const;

export type UserRole = (typeof USER_ROLES)[number];