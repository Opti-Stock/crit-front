import { appConfig } from "../../../config/env";
import { adminApiClient } from "../../../services/admin-api/client";
import { mockCollaborators } from "../mocks/collaborators.mock";
import type { CollaboratorSummary } from "../types/admin.types";
import { CollaboratorDto } from "../types/collaborator.types";

export interface CreateCollaboratorInput {
  userId: string;
  fullName: string;
  specialty: string;
  email?: string;
  position?: string;
  clinicIds: string[];
}

class CollaboratorsService {
  async getAll(): Promise<
    readonly CollaboratorSummary[]
  > {
    if (appConfig.adminMocksEnabled) {
        return mockCollaborators;
    }

    return adminApiClient.request<readonly CollaboratorDto[]>(
        "/collaborators",
    );
  }

  async create(input: CreateCollaboratorInput): Promise<CollaboratorSummary> {
    if (appConfig.adminMocksEnabled) {
      return {
        id: crypto.randomUUID(),
        userId: input.userId,
        fullName: input.fullName,
        email: input.email ?? null,
        specialty: input.specialty,
        status: "active",
        clinicIds: input.clinicIds,
      };
    }

    return adminApiClient.request<CollaboratorDto>("/collaborators", {
      method: "POST",
      body: {
        userId: input.userId,
        fullName: input.fullName,
        specialty: input.specialty,
        email: input.email,
        position: input.position,
        clinicIds: input.clinicIds,
      },
    });
  }
}

export const collaboratorsService =
  new CollaboratorsService();
