import type { ClinicDto } from "../types/clinic.types";

export const mockClinics: readonly ClinicDto[] = [
  {
    id: "1",
    name: "Clinica 1",
    status: "active",
    specialization: "Terapia",
    capacity: 10,
  },
  {
    id: "2",
    name: "Clinica 2",
    status: "active",
    specialization: "Consulta",
    capacity: 8,
  },
];
