export interface AdminTableColumn<T> {
  header: string;
  render(item: T): string;
  sortBy?: string;
}

export interface AdminTableSort {
  sortBy: string;
  sortDir: "asc" | "desc";
}

export function renderAdminTable<T>(
  columns: readonly AdminTableColumn<T>[],
  rows: readonly T[],
  sort?: AdminTableSort,
): string {
  return `
    <table class="admin-table">
      <thead>
        <tr>
          ${columns
            .map(
              (column) => {
                if (!column.sortBy) return `<th>${column.header}</th>`;
                const active = sort?.sortBy === column.sortBy;
                const nextDir = active && sort?.sortDir === "asc" ? "desc" : "asc";
                const marker = active ? (sort.sortDir === "asc" ? " ↑" : " ↓") : "";
                return `
                  <th>
                    <button class="admin-table__sort" type="button" data-admin-sort-by="${column.sortBy}" data-admin-sort-dir="${nextDir}">
                      ${column.header}${marker}
                    </button>
                  </th>
                `;
              },
            )
            .join("")}
        </tr>
      </thead>

      <tbody>
        ${
          rows.length === 0
            ? `
              <tr>
                <td colspan="${columns.length}">
                  No hay registros con estos filtros.
                </td>
              </tr>
            `
            : rows
                .map(
                  (row) => `
                    <tr>
                      ${columns
                        .map(
                          (column) =>
                            `<td>${column.render(row)}</td>`,
                        )
                        .join("")}
                    </tr>
                  `,
                )
                .join("")
        }
      </tbody>
    </table>
  `;
}
