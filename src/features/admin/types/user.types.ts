export interface UserDto {
  id: string;
  fullName: string;
  email: string;
  status: "active" | "inactive";
  roles: { id: string; name: string }[];
  clinicAccess?: { clinicId: string; clinicName: string; accessLevel: "standard" | "manage" }[];
  deletedAt?: string | null;
}
