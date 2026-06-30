export interface AdminTableColumn<T> {
  header: string;
  render(item: T): string;
}

export function renderAdminTable<T>(
  columns: readonly AdminTableColumn<T>[],
  rows: readonly T[],
): string {
  return `
    <table class="admin-table">
      <thead>
        <tr>
          ${columns
            .map(
              (column) =>
                `<th>${column.header}</th>`,
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
                  No records found.
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