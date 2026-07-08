export interface ClinicDto {
  id: string;
  name: string;
  status: "active" | "inactive";
  specialization?: string | null;
  capacity?: number | null;
  deletedAt?: string | null;
}
