# CODEX_BACKLOG.md

# crit-front Codex backlog

## Current state

The repository has the initial folder structure, config files, Docker placeholders, README, and documentation skeleton.

It does not yet contain functional frontend code.

## Product scope for this repo

Build the desktop/responsive web frontend for:

- Main operational app.
- Admin app.
- Authentication UI.
- Role-based navigation.
- Attendance registration.
- Medical-note capture.
- PDF export from frontend.
- Calendar/agenda UI.
- Handoff notes.
- Internal notifications.

Do not build:

- Mobile app.
- Offline mode.
- Payments module.
- Full patient/family portal unless explicitly requested.

## Recommended implementation order

### OPT-FE-01 — Initialize Vite Vanilla TypeScript app

Goal:

- Add minimal TypeScript entrypoints for `index.html` and `admin.html`.
- Keep the app framework-free.
- Add basic CSS structure.

Expected files:

```txt
src/main.ts
src/apps/main/main-app.ts
src/apps/admin/admin-app.ts
src/assets/styles/global.css
src/config/env.ts
```

Acceptance criteria:

- `npm run build` passes.
- Main app renders a simple shell in `#app`.
- Admin app renders a simple shell in `#admin-app`.
- No React or other framework is added.

### OPT-FE-02 — Add API client layer

Goal:

- Create reusable clients for main API and admin API.

Expected files:

```txt
src/services/main-api/client.ts
src/services/admin-api/client.ts
src/types/api.ts
```

Acceptance criteria:

- API base URLs come from environment/config.
- Main and admin clients are separated.
- Request/response helpers are typed.
- No hardcoded production URLs.

### OPT-FE-03 — Add auth UI and session skeleton

Goal:

- Create login page structure and session handling skeleton.

Expected files:

```txt
src/features/auth/
src/guards/auth.guard.ts
src/types/auth.ts
```

Acceptance criteria:

- Login screen exists.
- Token/session storage strategy is documented.
- Route guard skeleton exists.
- No real authentication assumptions beyond API contract placeholders.

### OPT-FE-04 — Add role-based layout and navigation

Goal:

- Create layouts for main app and admin app.
- Show/hide navigation items by role.

Acceptance criteria:

- Reception cannot access clinical note screens in the UI.
- Admin/direction can access admin entry.
- Médico/terapeuta can access attendance and notes.
- Role rules are centralized, not scattered.

### OPT-FE-05 — Attendance screen MVP

Goal:

- Build UI for appointment list and attendance status update.

Acceptance criteria:

- States include: `pending`, `present`, `absent`, `late`, `cancelled`, `rescheduled`.
- UI separates appointment details from clinical-note content.
- API calls are routed through `main-api` service.

### OPT-FE-06 — Medical note capture and PDF export

Goal:

- Build note form and frontend PDF export.

Acceptance criteria:

- PDF includes at least: name, date, patient, appointment.
- PDF file is generated client-side.
- Database stores note data, not PDF files.
- The form can be reloaded from saved note content.

### OPT-FE-07 — Calendar/agenda UI

Goal:

- Build a Teams-like calendar UI for appointments.

Acceptance criteria:

- Manual appointment creation UI exists.
- Autosuggest is visibly marked as later/experimental if not implemented.
- Appointments consider patient, collaborator, clinic, room, duration, pre-session, post-session fields in the UI model.

### OPT-FE-08 — Handoff notes UI

Goal:

- Build list/create/read flows for handoff notes.

Acceptance criteria:

- Notes have title, content, priority, status, recipients.
- Intended viewers are médico, terapeuta, and specific admin/accompaniment roles.
- Clinical privacy is respected.

### OPT-FE-09 — Internal notifications UI

Goal:

- Build notification list and unread/read states.

Acceptance criteria:

- Notification types include appointment reminder, pending note, unregistered attendance, appointment change, handoff note received, administrative alert.
- Patient SMS/WhatsApp reminders are not implemented here.

### OPT-FE-10 — Admin pages

Goal:

- Build admin shell and placeholder pages for users, roles, clinics, collaborators.

Acceptance criteria:

- Admin pages use admin API client.
- Admin is separate from main operational navigation.
- Access is restricted to `admin` and `direccion`.
