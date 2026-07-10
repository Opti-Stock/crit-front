import { USER_ROLES, type UserRole } from "../../../types/role.types";
import type {
  LoginFormValues,
  LoginPageOptions,
} from "../types/auth.types";

export function renderLoginPage(options: LoginPageOptions = {}): string {
  const {
    errorMessage = null,
    isSubmitting = false,
    availableRoles = USER_ROLES,
    showRoleSelector = false,
  } = options;

  return `
    <main class="auth-page" aria-labelledby="login-title">
      <section class="auth-card">
        <header class="auth-card__header">
          <p class="auth-card__eyebrow">CRIT Assistance</p>
          <h1 id="login-title" class="auth-card__title">Sign in</h1>
          <p class="auth-card__subtitle">
            Access the operational workspace with your assigned credentials.
          </p>
        </header>
        <form id="login-form" class="auth-form" novalidate>
          <div class="auth-form__field">
            <label for="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autocomplete="email"
              placeholder="name@crit.org"
              required
            />
          </div>

          <div class="auth-form__field">
            <label for="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autocomplete="current-password"
              placeholder="Enter your password"
              required
            />
          </div>
          ${
            showRoleSelector
              ? `
                <div class="auth-form__field">
                  <label for="role">Role</label>

                  <select
                    id="role"
                    name="role"
                    required
                  >
                    ${availableRoles
                      .map(
                        (role) => `
                          <option value="${role}">
                            ${formatRoleLabel(role)}
                          </option>
                        `,
                      )
                      .join("")}
                  </select>
                </div>
              `
              : ""
          }

          ${
            errorMessage
              ? `<p class="auth-form__error" role="alert">${escapeHtml(errorMessage)}</p>`
              : ""
          }

          <button
            type="submit"
            class="auth-form__submit"
            ${isSubmitting ? "disabled" : ""}
          >
            ${isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  `;
}

export function mountLoginPage(
  root: HTMLElement,
  options: LoginPageOptions = {},
): void {
  root.innerHTML = renderLoginPage(options);

  const form = root.querySelector<HTMLFormElement>("#login-form");

  if (!form || !options.onSubmit) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const selectedRole =
      formData.get("role") === null
        ? "recepcion"
        : (String(formData.get("role")) as UserRole);
    const values: LoginFormValues = {
      email: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
      role: selectedRole,
    };

    await options.onSubmit?.(values);
  });
}

function formatRoleLabel(role: UserRole): string {
  switch (role) {
    case "recepcion":
      return "Recepción";
    case "recepcion_general":
      return "Recepcion general";
    case "medico":
      return "Médico";
    case "terapeuta":
      return "Terapeuta";
    case "direccion":
      return "Dirección";
    case "admin":
      return "Admin";
    default:
      return role;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
