import type { UserRole } from "../../../types/role.types";

export interface SessionData {
  accessToken: string;
  role: UserRole;
  user?: {
    id: string;
    fullName?: string;
    email?: string;
    area?: string;
  };
}

export interface TenantOption {
  code: string;
  name: string;
}

export interface LoginFormValues {
  tenantCode: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface LoginPageOptions {
  onSubmit?: (values: LoginFormValues) => Promise<void> | void;
  isSubmitting?: boolean;
  errorMessage?: string | null;

  availableRoles?: readonly UserRole[];
  availableTenants?: readonly TenantOption[];

  showRoleSelector?: boolean;
}
