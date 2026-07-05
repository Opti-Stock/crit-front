import { authApiClient } from "../../../services/auth-api/client";
import {
  USER_ROLES,
  type UserRole,
} from "../../../types/role.types";
import type {
  LoginFormValues,
  SessionData,
} from "../types/auth.types";

interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: string;

  user: {
    id: string;
    tenantId: string;
    fullName: string;
    email: string;
    area?: string;
    roles: string[];
  };
}

class AuthService {
  async login(values: LoginFormValues): Promise<SessionData> {
    const response = await authApiClient.request<LoginResponse>(
      "/auth/login",
      {
        method: "POST",
        body: {
          tenantCode: values.tenantCode,
          email: values.email,
          password: values.password,
        },
      },
    );

    const role = this.resolveRole(response.user.roles);

    return {
      accessToken: response.accessToken,
      role,
      user: {
        id: response.user.id,
        fullName: response.user.fullName,
        email: response.user.email,
        area: response.user.area,
      },
    };
  }

  private resolveRole(roles: readonly string[]): UserRole {
    const supportedRoles = new Set(USER_ROLES);

    const role = roles.find(
      (candidate): candidate is UserRole =>
        supportedRoles.has(candidate as UserRole),
    );

    if (!role) {
      throw new Error(
        "The authenticated user does not have a supported application role.",
      );
    }

    return role;
  }
}

export const authService = new AuthService();
