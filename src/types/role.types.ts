export const USER_ROLES = [
  "admin",
  "direccion",
  "recepcion",
  "coordinador",
  "medico",
  "terapeuta",
  "personal_acompanamiento",
  "paciente_familia",
] as const;

export type UserRole = (typeof USER_ROLES)[number];
