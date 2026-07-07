import { mainApiClient } from "./client";
import type { ApiQueryValue, PaginationMeta } from "../../types/api";
import type { CatalogItem } from "../../types/operational.types";

interface ListCatalogQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  clinicId?: string;
  role?: "medico" | "terapeuta";
}

function listCatalog(path: string, query: ListCatalogQuery = {}) {
  return mainApiClient.requestWithMeta<CatalogItem[], PaginationMeta>(path, {
    query: query as Record<string, ApiQueryValue>,
  });
}

export const listPatients = (query?: ListCatalogQuery) =>
  listCatalog("/patients", query);

export const listCollaborators = (query?: ListCatalogQuery) =>
  listCatalog("/collaborators", query);

export const listClinics = (query?: ListCatalogQuery) =>
  listCatalog("/clinics", query);

export const listRooms = (query?: ListCatalogQuery) => listCatalog("/rooms", query);
