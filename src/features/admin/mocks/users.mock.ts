import { UserDto } from "../types/user.types";

export const mockUsers: readonly UserDto[] = [
  {
    id: "1",
    fullName: "Administrador",
    email: "admin@crit.org",
    active: true,
  },
  {
    id: "2",
    fullName: "Juan Pérez",
    email: "juan@crit.org",
    active: true,
  },
];