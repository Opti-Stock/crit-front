import type { CollaboratorDto } from "../types/collaborator.types";

export const mockCollaborators: readonly CollaboratorDto[] = [
  {
    id: "1",
    fullName: "María López",
    email: "maria@crit.org",
    active: true,
  },
  {
    id: "2",
    fullName: "Carlos Hernández",
    email: "carlos@crit.org",
    active: false,
  },
];