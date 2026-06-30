export interface AdminCollectionResponse<T> {
  items: readonly T[];
}

export interface UserSummary {
  id: string;
  fullName: string;
  email: string;
  active: boolean;
}

export interface RoleSummary {
  id: string;
  name: string;
  description?: string;
}

export interface ClinicSummary {
  id: string;
  name: string;
  active: boolean;
}

export interface CollaboratorSummary {
  id: string;
  fullName: string;
  email: string;
  active: boolean;
}