export interface SessionData {
  accessToken: string;
}

export interface LoginFormValues {
  email: string;
  password: string;
}

export interface LoginPageOptions {
  onSubmit?: (values: LoginFormValues) => Promise<void> | void;
  isSubmitting?: boolean;
  errorMessage?: string | null;
}