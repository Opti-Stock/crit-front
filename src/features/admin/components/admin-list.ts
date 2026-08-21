import type { PaginationMeta } from "../../../types/api";
import { escapeHtml } from "../../../utils/dom";

export interface AdminSortOption {
  value: string;
  label: string;
}

export interface AdminListControlsOptions {
  search: string;
  searchPlaceholder: string;
  pageSize: number;
  sortBy: string;
  sortDir: "asc" | "desc";
  sortOptions: readonly AdminSortOption[];
  filters?: string;
}

export function renderAdminListControls(options: AdminListControlsOptions): string {
  return `
    <form class="admin-list-controls" data-admin-list-controls>
      <label class="admin-list-controls__search">
        <span>Buscar</span>
        <input name="search" value="${escapeHtml(options.search)}" placeholder="${escapeHtml(options.searchPlaceholder)}" />
      </label>
      ${options.filters ?? ""}
      <label>
        <span>Ordenar por</span>
        <select name="sortBy">
          ${options.sortOptions.map((option) => `
            <option value="${escapeHtml(option.value)}" ${option.value === options.sortBy ? "selected" : ""}>${escapeHtml(option.label)}</option>
          `).join("")}
        </select>
      </label>
      <label>
        <span>Dirección</span>
        <select name="sortDir">
          <option value="asc" ${options.sortDir === "asc" ? "selected" : ""}>Asc</option>
          <option value="desc" ${options.sortDir === "desc" ? "selected" : ""}>Desc</option>
        </select>
      </label>
      <label>
        <span>Filas</span>
        <select name="pageSize">
          ${[10, 20, 50, 100].map((size) => `
            <option value="${size}" ${size === options.pageSize ? "selected" : ""}>${size}</option>
          `).join("")}
        </select>
      </label>
      <button type="submit" class="secondary-action">Aplicar</button>
    </form>
  `;
}

export function renderAdminPagination(meta: PaginationMeta): string {
  const totalPages = Math.max(meta.totalPages, 1);
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.total);

  return `
    <footer class="admin-pagination" aria-label="Paginación">
      <p>${from}-${to} de ${meta.total}</p>
      <div class="admin-pagination__actions">
        <button class="secondary-action" type="button" data-admin-page="${meta.page - 1}" ${meta.page <= 1 ? "disabled" : ""}>Anterior</button>
        <span>Página ${meta.page} de ${totalPages}</span>
        <button class="secondary-action" type="button" data-admin-page="${meta.page + 1}" ${meta.page >= totalPages ? "disabled" : ""}>Siguiente</button>
      </div>
    </footer>
  `;
}

export function readAdminListControls(form: HTMLFormElement) {
  const data = new FormData(form);
  return {
    search: String(data.get("search") ?? "").trim(),
    pageSize: Number(data.get("pageSize") ?? 20),
    sortBy: String(data.get("sortBy") ?? ""),
    sortDir: String(data.get("sortDir") ?? "asc") === "desc" ? "desc" as const : "asc" as const,
  };
}
