import type { LoginFormValues, LoginPageOptions } from "../types/auth.types";

export function renderLoginPage(options: LoginPageOptions = {}): string {
  const { errorMessage = null, isSubmitting = false } = options;

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

    const values: LoginFormValues = {
      email: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
    };

    await options.onSubmit?.(values);
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}