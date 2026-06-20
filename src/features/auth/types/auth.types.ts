import type { UserRole } from "../../../types/role.types";

export interface SessionData {
  accessToken: string;
  role: UserRole;
}

export interface LoginFormValues {
  email: string;
  password: string;
  role: UserRole;
}

export interface LoginPageOptions {
  onSubmit?: (values: LoginFormValues) => Promise<void> | void;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  availableRoles?: readonly UserRole[];
}