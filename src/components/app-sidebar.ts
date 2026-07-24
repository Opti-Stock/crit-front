import { escapeHtml } from "../utils/dom";

const SIDEBAR_STORAGE_KEY = "crit-sidebar-collapsed";

export type SidebarIconName =
  | "admin"
  | "appointmentTypes"
  | "attendance"
  | "badgeScan"
  | "brand"
  | "calendar"
  | "clinics"
  | "dashboard"
  | "linkNotes"
  | "logout"
  | "medicalNotes"
  | "notifications"
  | "roles"
  | "rooms"
  | "users";

interface SidebarNavItemOptions {
  active?: boolean;
  badgeHtml?: string;
  dataAdminNavKey?: string;
  dataNavKey?: string;
  extraClass?: string;
  href?: string;
  icon: SidebarIconName;
  label: string;
  tag?: "a" | "span";
}

const sidebarIcons: Record<SidebarIconName, string> = {
  admin: `
    <svg viewBox="0 0 24 24" aria-hidden="true" class="sidebar-icon-svg" focusable="false">
      <path d="M12 3.5l3.1 1.1.7 2.2 2.2.9 2-.9 1.7 3-1.7 1.5v2.4l1.7 1.5-1.7 3-2-.9-2.2.9-.7 2.2-3.1 1.1-3.1-1.1-.7-2.2-2.2-.9-2 .9-1.7-3 1.7-1.5v-2.4L2.3 9.8l1.7-3 2 .9 2.2-.9.7-2.2L12 3.5z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>
      <path d="M12 8.2l3 1.1v2.4c0 2.2-1.2 3.9-3 4.7-1.8-.8-3-2.5-3-4.7V9.3l3-1.1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
    </svg>
  `,
  appointmentTypes: `
    <svg viewBox="0 0 24 24" aria-hidden="true" class="sidebar-icon-svg" focusable="false">
      <rect x="4" y="5" width="16" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M8 3.5v4M16 3.5v4M4 10h16M8 14h4M8 17h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M16.5 13.4v4.2M14.4 15.5h4.2" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
    </svg>
  `,
  attendance: `
    <svg viewBox="0 0 24 24" aria-hidden="true" class="sidebar-icon-svg" focusable="false">
      <circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="2.1"/>
      <path d="M7.8 12.2l2.8 2.8 5.8-6" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,
  badgeScan: `
    <svg viewBox="0 0 24 24" aria-hidden="true" class="sidebar-icon-svg" focusable="false">
      <rect x="4" y="5" width="16" height="14" rx="2.4" fill="none" stroke="currentColor" stroke-width="2.1"/>
      <path d="M8 9.2h4.4M8 13h8M8 16h5.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M5.8 3.7H3.7v2.1M20.3 5.8V3.7h-2.1M18.2 20.3h2.1v-2.1M3.7 18.2v2.1h2.1" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,
  brand: `
    <svg viewBox="0 0 32 32" aria-hidden="true" class="sidebar-icon-svg sidebar-icon-svg--brand" focusable="false">
      <path d="M16 5.5a4 4 0 014 4V12h2.5a4 4 0 010 8H20v2.5a4 4 0 01-8 0V20H9.5a4 4 0 010-8H12V9.5a4 4 0 014-4z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="20.5" cy="11.5" r="2.2" fill="currentColor"/>
    </svg>
  `,
  calendar: `
    <svg viewBox="0 0 24 24" aria-hidden="true" class="sidebar-icon-svg" focusable="false">
      <rect x="4" y="5.5" width="16" height="14.5" rx="2.6" fill="none" stroke="currentColor" stroke-width="2.1"/>
      <path d="M8 3.5v4M16 3.5v4M4 10h16" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
      <path d="M8.1 13.4h1.1M11.5 13.4h1.1M14.9 13.4H16M8.1 16.3h1.1M11.5 16.3h1.1M14.9 16.3H16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
    </svg>
  `,
  clinics: `
    <svg viewBox="0 0 24 24" aria-hidden="true" class="sidebar-icon-svg" focusable="false">
      <path d="M4.5 20V6.5A2.5 2.5 0 017 4h10a2.5 2.5 0 012.5 2.5V20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <path d="M9 20v-4h6v4M8.5 8h7M8.5 11.5h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 6.8v3.4M10.3 8.5h3.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
    </svg>
  `,
  dashboard: `
    <svg viewBox="0 0 24 24" aria-hidden="true" class="sidebar-icon-svg" focusable="false">
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.8" fill="none" stroke="currentColor" stroke-width="2"/>
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" fill="none" stroke="currentColor" stroke-width="2"/>
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" fill="none" stroke="currentColor" stroke-width="2"/>
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8" fill="none" stroke="currentColor" stroke-width="2"/>
    </svg>
  `,
  linkNotes: `
    <svg viewBox="0 0 24 24" aria-hidden="true" class="sidebar-icon-svg" focusable="false">
      <path d="M5.5 5.2h13A2.5 2.5 0 0121 7.7v6.8a2.5 2.5 0 01-2.5 2.5H12l-4.3 3.2V17H5.5A2.5 2.5 0 013 14.5V7.7a2.5 2.5 0 012.5-2.5z" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/>
      <path d="M8 9.3h8M8 12.7h5.8" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
    </svg>
  `,
  logout: `
    <svg viewBox="0 0 24 24" aria-hidden="true" class="sidebar-icon-svg" focusable="false">
      <path d="M10.5 5H6.8A2.8 2.8 0 004 7.8v8.4A2.8 2.8 0 006.8 19h3.7" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
      <path d="M13.5 8l4 4-4 4M17.2 12H8.8" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,
  medicalNotes: `
    <svg viewBox="0 0 24 24" aria-hidden="true" class="sidebar-icon-svg" focusable="false">
      <path d="M6 4h8.4L18 7.6V20H6V4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <path d="M14 4v4h4M9 11.5h5M9 15h3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M13.7 18.3l3.9-3.9a1 1 0 011.4 1.4l-3.9 3.9-1.7.4.3-1.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
    </svg>
  `,
  notifications: `
    <svg viewBox="0 0 24 24" aria-hidden="true" class="sidebar-icon-svg" focusable="false">
      <path d="M18.5 10.8v3.6l1.4 2.4H4.1l1.4-2.4v-3.6a6.5 6.5 0 0113 0z" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/>
      <path d="M10 19a2.2 2.2 0 004 0M10.2 5a2 2 0 013.6 0" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
    </svg>
  `,
  roles: `
    <svg viewBox="0 0 24 24" aria-hidden="true" class="sidebar-icon-svg" focusable="false">
      <path d="M12 4.2l6.2 2.3v4.6c0 4.2-2.4 7.2-6.2 8.7-3.8-1.5-6.2-4.5-6.2-8.7V6.5L12 4.2z" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/>
      <path d="M9.2 12l1.9 1.9 3.9-4.1" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,
  rooms: `
    <svg viewBox="0 0 24 24" aria-hidden="true" class="sidebar-icon-svg" focusable="false">
      <path d="M6 20V5.8A1.8 1.8 0 017.8 4H18v16" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/>
      <path d="M10 20V7h8M13.5 13h.1" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,
  users: `
    <svg viewBox="0 0 24 24" aria-hidden="true" class="sidebar-icon-svg" focusable="false">
      <circle cx="9" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="2.1"/>
      <path d="M3.8 19a5.3 5.3 0 0110.4 0" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
      <path d="M16.3 10.5a2.6 2.6 0 10-.6-5.1M16 14.3a4.3 4.3 0 014.2 4.4" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
    </svg>
  `,
};

export function bindSidebarCollapse(root: HTMLElement): void {
  const shell = root.querySelector<HTMLElement>("[data-app-shell]");
  const button = root.querySelector<HTMLButtonElement>("[data-sidebar-toggle]");

  if (!shell || !button) return;

  const setCollapsed = (collapsed: boolean): void => {
    shell.classList.toggle("app-shell--sidebar-collapsed", collapsed);
    button.setAttribute("aria-expanded", String(!collapsed));
    button.setAttribute(
      "aria-label",
      collapsed ? "Expandir barra lateral" : "Colapsar barra lateral",
    );
    button.setAttribute(
      "title",
      collapsed ? "Expandir barra lateral" : "Colapsar barra lateral",
    );

    writeSidebarCollapsedPreference(collapsed);
  };

  setCollapsed(readSidebarCollapsedPreference());

  button.addEventListener("click", () => {
    setCollapsed(!shell.classList.contains("app-shell--sidebar-collapsed"));
  });
}

export function getSidebarCollapsedShellClass(): string {
  return readSidebarCollapsedPreference() ? " app-shell--sidebar-collapsed" : "";
}

export function getSidebarIconForKey(key: string): SidebarIconName {
  switch (key) {
    case "admin":
      return "admin";
    case "attendance":
      return "attendance";
    case "appointment-types":
      return "appointmentTypes";
    case "badge-scan":
      return "badgeScan";
    case "calendar":
      return "calendar";
    case "clinics":
      return "clinics";
    case "dashboard":
      return "dashboard";
    case "handoff-notes":
      return "linkNotes";
    case "medical-notes":
      return "medicalNotes";
    case "notifications":
      return "notifications";
    case "roles":
      return "roles";
    case "rooms":
      return "rooms";
    case "scheduling":
      return "appointmentTypes";
    case "users":
      return "users";
    default:
      return "dashboard";
  }
}

export function renderSidebarBrand(title: string): string {
  const safeTitle = escapeHtml(title);

  return `
    <div class="app-sidebar__header">
      <div class="app-brand" aria-label="${safeTitle}">
        <span class="app-brand__mark">${sidebarIcons.brand}</span>
        <span class="app-brand__text">${safeTitle}</span>
      </div>
      ${renderSidebarToggle()}
    </div>
  `;
}

export function renderSidebarLogoutButton(id: string): string {
  return `
    <button id="${escapeHtml(id)}" class="app-logout-button" type="button" aria-label="Cerrar sesion" title="Cerrar sesion">
      <span class="app-logout-button__icon">${sidebarIcons.logout}</span>
      <span class="app-logout-button__label">Cerrar sesion</span>
    </button>
  `;
}

export function renderSidebarNavItem(options: SidebarNavItemOptions): string {
  const safeLabel = escapeHtml(options.label);
  const tag = options.href ? "a" : options.tag ?? "span";
  const classes = [
    "app-nav__item",
    options.active ? "app-nav__item--active" : "",
    options.extraClass ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  const attributes = [
    `class="${classes}"`,
    `title="${safeLabel}"`,
    options.href ? `href="${escapeHtml(options.href)}"` : "",
    options.dataNavKey ? `data-nav-key="${escapeHtml(options.dataNavKey)}"` : "",
    options.dataAdminNavKey
      ? `data-admin-nav-key="${escapeHtml(options.dataAdminNavKey)}"`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <${tag} ${attributes}>
      <span class="app-nav__icon app-nav__icon--${options.icon}">
        ${sidebarIcons[options.icon]}
      </span>
      <span class="app-nav__label">${safeLabel}</span>
      ${options.badgeHtml ?? ""}
    </${tag}>
  `;
}

export function renderSidebarToggle(): string {
  const collapsed = readSidebarCollapsedPreference();
  const label = collapsed ? "Expandir barra lateral" : "Colapsar barra lateral";

  return `
    <button
      type="button"
      class="app-sidebar__collapse-button"
      data-sidebar-toggle
      aria-label="${label}"
      aria-expanded="${String(!collapsed)}"
      title="${label}"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" class="app-sidebar__collapse-icon" focusable="false">
        <path d="M4.5 5.5h15v13h-15zM10 5.5v13M15 9l-3 3 3 3" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  `;
}

function readSidebarCollapsedPreference(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeSidebarCollapsedPreference(collapsed: boolean): void {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  } catch {
    // Local storage can be disabled; the sidebar still works for the session.
  }
}
