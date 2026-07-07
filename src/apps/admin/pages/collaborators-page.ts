import { renderAdminTable } from "../../../features/admin/components/admin-table";
import { clinicsService } from "../../../features/admin/services/clinics.service";
import { collaboratorsService } from "../../../features/admin/services/collaborators.service";
import { usersService } from "../../../features/admin/services/users.service";
import { escapeHtml } from "../../../utils/dom";

export async function mountCollaboratorsPage(
  root: HTMLElement,
  message: string | null = null,
): Promise<void> {
  root.innerHTML = `
    <section class="app-panel">
      <h2>Colaboradores</h2>
      <p>Loading collaborators...</p>
    </section>
  `;

  try {
    const [collaborators, users, clinics] = await Promise.all([
      collaboratorsService.getAll(),
      usersService.getAll(),
      clinicsService.getAll(),
    ]);
    const clinicNameById = new Map(
      clinics.map((clinic) => [clinic.id, clinic.name]),
    );

    root.innerHTML = `
      <section class="app-panel">
        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            margin-bottom:24px;
          "
        >
          <div>
            <h2>Colaboradores</h2>
            <p>Crear colaboradores y asociarlos con usuarios del tenant.</p>
          </div>
        </div>

        ${message ? `<p class="inline-alert" role="status">${escapeHtml(message)}</p>` : ""}

        <form class="form-panel" data-admin-create-collaborator-form>
          <h3>Nuevo colaborador</h3>
          <label>Usuario
            <select name="userId" required>
              <option value="">Selecciona un usuario</option>
              ${users
                .map(
                  (user) =>
                    `<option value="${escapeHtml(user.id)}">${escapeHtml(`${user.fullName} - ${user.email}`)}</option>`,
                )
                .join("")}
            </select>
          </label>
          <label>Nombre<input name="fullName" required /></label>
          <label>Especialidad<input name="specialty" required /></label>
          <label>Email<input name="email" type="email" /></label>
          <label>Puesto<input name="position" /></label>
          <label>Clinica
            <select name="clinicId">
              <option value="">Sin clinica asignada</option>
              ${clinics
                .map(
                  (clinic) =>
                    `<option value="${escapeHtml(clinic.id)}">${escapeHtml(clinic.name)}</option>`,
                )
                .join("")}
            </select>
          </label>
          <button type="submit" class="primary-action">Crear colaborador</button>
        </form>

        ${renderAdminTable(
          [
            {
              header: "Nombre",
              render: (collaborator) => escapeHtml(collaborator.fullName),
            },
            {
              header: "Correo",
              render: (collaborator) =>
                collaborator.email ? escapeHtml(collaborator.email) : "-",
            },
            {
              header: "Especialidad",
              render: (collaborator) => escapeHtml(collaborator.specialty),
            },
            {
              header: "Clinicas",
              render: (collaborator) => {
                const names = collaborator.clinicIds
                  .map((clinicId) => clinicNameById.get(clinicId) ?? clinicId)
                  .filter(Boolean);

                return names.length ? escapeHtml(names.join(", ")) : "-";
              },
            },
            {
              header: "Estado",
              render: (collaborator) =>
                collaborator.status === "active" ? "Activo" : "Inactivo",
            },
          ],
          collaborators,
        )}
      </section>
    `;

    root
      .querySelector<HTMLFormElement>("[data-admin-create-collaborator-form]")
      ?.addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.currentTarget as HTMLFormElement;
        const data = new FormData(form);
        const clinicId = String(data.get("clinicId") ?? "");
        void collaboratorsService
          .create({
            userId: String(data.get("userId") ?? ""),
            fullName: String(data.get("fullName") ?? "").trim(),
            specialty: String(data.get("specialty") ?? "").trim(),
            email: String(data.get("email") ?? "").trim() || undefined,
            position: String(data.get("position") ?? "").trim() || undefined,
            clinicIds: clinicId ? [clinicId] : [],
          })
          .then(() => mountCollaboratorsPage(root, "Colaborador creado."))
          .catch((error) =>
            mountCollaboratorsPage(
              root,
              error instanceof Error
                ? error.message
                : "No se pudo crear el colaborador.",
            ),
          );
      });
  } catch (error) {
    root.innerHTML = `
      <section class="app-panel">
        <h2>Colaboradores</h2>
        <p>Failed to load collaborators.</p>
        <pre>${error instanceof Error ? error.message : "Unknown error"}</pre>
      </section>
    `;
  }
}
