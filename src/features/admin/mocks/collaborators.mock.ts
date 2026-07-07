import type { CollaboratorDto } from "../types/collaborator.types";

export const mockCollaborators: readonly CollaboratorDto[] = [
  {
    id: "1",
    userId: "2",
    fullName: "Maria Lopez",
    email: "maria@crit.org",
    specialty: "Terapia fisica",
    status: "active",
    clinicIds: ["1"],
  },
  {
    id: "2",
    userId: "3",
    fullName: "Carlos Hernandez",
    email: "carlos@crit.org",
    specialty: "Medicina",
    status: "inactive",
    clinicIds: ["2"],
  },
];
