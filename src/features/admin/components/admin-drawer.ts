import { escapeHtml } from "../../../utils/dom";

export interface AdminDrawerOptions {
  open: boolean;
  title: string;
  body: string;
}

export function renderAdminDrawer(options: AdminDrawerOptions): string {
  if (!options.open) return "";

  return `
    <div class="admin-drawer-backdrop" data-admin-drawer-backdrop>
      <aside class="admin-drawer" role="dialog" aria-modal="true" aria-label="${escapeHtml(options.title)}">
        <header class="admin-drawer__header">
          <h3>${escapeHtml(options.title)}</h3>
          <button class="icon-button" type="button" aria-label="Cerrar panel" title="Cerrar panel" data-admin-drawer-close>x</button>
        </header>
        ${options.body}
      </aside>
    </div>
  `;
}

export function bindAdminDrawer(root: HTMLElement, close: () => void): void {
  root.querySelectorAll<HTMLButtonElement>("[data-admin-drawer-close]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      close();
    });
  });
  root.querySelectorAll<HTMLElement>("[data-admin-drawer-backdrop]").forEach((element) => {
    element.addEventListener("click", (event) => {
      if (event.target === element) close();
    });
  });
}
