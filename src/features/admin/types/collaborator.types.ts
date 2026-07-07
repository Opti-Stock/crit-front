export interface CollaboratorDto {
  id: string;
  userId: string;
  fullName: string;
  email?: string | null;
  specialty: string;
  status: "active" | "inactive";
  clinicIds: string[];
}
