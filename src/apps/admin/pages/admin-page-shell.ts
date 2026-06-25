import { adminApiClient } from "../../../services/admin-api/client";

export interface AdminPageShellOptions {
  title: string;
  description: string;
  moduleName: string;
  endpointHint: string;
}

export function mountAdminPageShell(
  root: HTMLElement,
  options: AdminPageShellOptions,
): void {
  root.innerHTML = `
    <section class="app-panel" aria-labelledby="admin-page-title">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">
        <div>
          <p class="app-eyebrow">Admin module</p>
          <h2 id="admin-page-title">${options.title}</h2>
          <p>${options.description}</p>
        </div>
        <span class="app-status">Skeleton</span>
      </div>

      <div style="margin-top:24px;display:grid;gap:16px;">
        <section class="app-panel" aria-label="Module scope">
          <h3>Scope</h3>
          <p>
            This placeholder reserves the admin workspace for <strong>${options.moduleName}</strong>.
            It is already mounted inside the separate admin app and ready to connect CRUD flows later.
          </p>
        </section>

        <section class="app-panel" aria-label="API integration status">
          <h3>Admin API status</h3>
          <p id="admin-api-status">Checking admin API client…</p>
          <ul>
            <li><strong>Client:</strong> adminApiClient</li>
            <li><strong>Target module:</strong> ${options.moduleName}</li>
            <li><strong>Endpoint hint:</strong> ${options.endpointHint}</li>
          </ul>
        </section>

        <section class="app-panel" aria-label="Next implementation steps">
          <h3>Next steps</h3>
          <ol>
            <li>Define module endpoints in the admin API layer.</li>
            <li>Replace this placeholder with filters, table and actions.</li>
            <li>Connect create/edit/delete flows and success/error states.</li>
          </ol>
        </section>
      </div>
    </section>
  `;

  const statusNode = root.querySelector<HTMLElement>("#admin-api-status");
  if (!statusNode) {
    return;
  }

  void updateAdminApiStatus(statusNode, options.endpointHint);
}

async function updateAdminApiStatus(
  statusNode: HTMLElement,
  endpointHint: string,
): Promise<void> {
  try {
    await adminApiClient.request(endpointHint);

    if (!statusNode.isConnected) {
      return;
    }

    statusNode.textContent = `Connected to admin API using GET ${endpointHint}.`;
  } catch (error) {
    if (!statusNode.isConnected) {
      return;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    statusNode.textContent =
      `Admin API client probe failed for ${endpointHint}: ${message}`;
  }
}