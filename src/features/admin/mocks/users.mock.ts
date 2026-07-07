import { UserDto } from "../types/user.types";

export const mockUsers: readonly UserDto[] = [
  {
    id: "1",
    fullName: "Administrador",
    email: "admin@crit.org",
    status: "active",
    roles: [{ id: "admin", name: "admin" }],
  },
  {
    id: "2",
    fullName: "Juan Perez",
    email: "juan@crit.org",
    status: "active",
    roles: [{ id: "medico", name: "medico" }],
  },
];
