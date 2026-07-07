export interface UserSummary {
  id: string;
  fullName: string;
  email: string;
  status: "active" | "inactive";
  roles: { id: string; name: string }[];
  clinicAccess?: { clinicId: string; clinicName: string; accessLevel: "standard" | "manage" }[];
}

export interface RoleSummary {
  id: string;
  name: string;
  description?: string;
}

export interface ClinicSummary {
  id: string;
  name: string;
  status: "active" | "inactive";
  specialization?: string | null;
  capacity?: number | null;
}

export interface RoomSummary {
  id: string;
  clinicId: string;
  clinicName?: string;
  name: string;
  capacity?: number | null;
  status: "active" | "inactive";
}

export interface CollaboratorSummary {
  id: string;
  userId: string;
  fullName: string;
  email?: string | null;
  specialty: string;
  status: "active" | "inactive";
  clinicIds: string[];
}
