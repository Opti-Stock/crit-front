import { appConfig } from "../../../config/env";
import { adminApiClient } from "../../../services/admin-api/client";
import { mockCollaborators } from "../mocks/collaborators.mock";
import type {
  AdminCollectionResponse,
  CollaboratorSummary,
} from "../types/admin.types";
import { CollaboratorDto } from "../types/collaborator.types";

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
}

export const collaboratorsService =
  new CollaboratorsService();