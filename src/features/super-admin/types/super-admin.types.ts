export interface TenantSummary {
  id: string;
  code: string;
  name: string;
  state: string | null;
  city: string | null;
  status: "active" | "inactive";
  createdAt: string;
  counts: {
    users: number;
    clinics: number;
    collaborators: number;
    patients: number;
    appointments: number;
    attendanceRecords: number;
  };
}

export interface CreateTenantInput {
  code: string;
  name: string;
  state?: string;
  city?: string;
}

export interface CreateTenantAdminInput {
  tenantId: string;
  fullName: string;
  email: string;
  password: string;
}
