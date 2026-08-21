import { escapeHtml } from "../../utils/dom";

const states = {
  "401": { title: "Tu sesion termino", message: "Inicia sesion nuevamente para continuar.", action: "Ir al inicio de sesion" },
  "403": { title: "Acceso restringido", message: "Tu perfil no tiene permiso para abrir esta seccion.", action: "Volver al inicio" },
  "404": { title: "No encontramos esta pagina", message: "La direccion puede haber cambiado o ya no estar disponible.", action: "Volver al inicio" },
  "500": { title: "No pudimos completar la operacion", message: "Ocurrio un error inesperado. Puedes intentarlo de nuevo.", action: "Intentar de nuevo" },
  "503": { title: "Servicio temporalmente no disponible", message: "Estamos realizando mantenimiento o recuperando la conexion.", action: "Intentar de nuevo" },
  offline: { title: "Sin conexion", message: "Revisa tu conexion a internet y vuelve a intentarlo.", action: "Reintentar" },
} as const;

type ErrorState = keyof typeof states;

export function mountErrorPage(root: HTMLElement): void {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("status") ?? "500";
  const status: ErrorState = requested in states ? requested as ErrorState : "500";
  const state = states[status];
  const requestId = params.get("requestId");

  root.innerHTML = `
    <main class="system-error" aria-labelledby="system-error-title">
      <section class="system-error__content">
        <p class="system-error__brand">CRIT Assistance</p>
        <p class="system-error__code">${status === "offline" ? "Conexion" : escapeHtml(status)}</p>
        <h1 id="system-error-title">${escapeHtml(state.title)}</h1>
        <p>${escapeHtml(state.message)}</p>
        ${requestId ? `<p class="system-error__request">Referencia: <code>${escapeHtml(requestId)}</code></p>` : ""}
        <div class="system-error__actions">
          <button type="button" data-error-action>${escapeHtml(state.action)}</button>
          <button class="system-error__back" type="button" data-error-back>Volver atrás</button>
        </div>
      </section>
    </main>`;

  root.querySelector<HTMLButtonElement>("[data-error-action]")?.addEventListener("click", () => {
    if (status === "500" || status === "503" || status === "offline") {
      window.location.reload();
      return;
    }
    window.location.assign("/");
  });

  root.querySelector<HTMLButtonElement>("[data-error-back]")?.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.assign("/");
  });
}
