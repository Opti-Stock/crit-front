# AGENTS.md

## Project context

This repository is part of the CRIT Assist / CRIT Assistance MVP.

The system aims to reduce operational friction in CRIT attendance registration by helping clinicians, therapists, reception, coordination, administration, and direction manage:

- Attendance registration.
- Medical notes.
- Calendar and appointments.
- Handoff notes.
- Internal notifications.
- Role-based access.
- Multi-CRIT readiness.
- Temporary POST integration with the CRIT institutional API.

The project is organized in three repositories:

- `crit-front`: web frontend.
- `crit-api`: Node.js + Express + TypeScript backend.
- `crit-db`: PostgreSQL database schema, migrations, seeds, and documentation.

## Global working rules

- Work from `dev`, not directly from `main`.
- Use branches with the Linear issue prefix: `feat/OPT-00-description`, `fix/OPT-00-description`, `chore/OPT-00-description`, `docs/OPT-00-description`, `refactor/OPT-00-description`.
- Keep commits small and scoped.
- Do not commit `.env` files, secrets, tokens, passwords, private keys, generated credentials, or local database volumes.
- When adding functionality, update the relevant README or docs.
- Prefer clear, boring, maintainable code over clever abstractions.
- Do not add new frameworks or major dependencies without an explicit task asking for it.
- Keep the MVP focused. Do not implement mobile app, offline mode, payments, or advanced external notification providers unless explicitly requested.
- When something is ambiguous, make the smallest safe assumption and document it in the PR summary.
- Code and docs should use English for technical identifiers and Spanish is acceptable for project-facing documentation if already used in the repo.

## Security and privacy expectations

This project touches healthcare-related operational data. Treat patient, family, appointment, and clinical-note data as sensitive.

- Never log patient clinical content.
- Never expose medical notes to reception users.
- Never return password hashes.
- Never hardcode real patient data.
- Use demo/mock data only in seeds.
- Keep auditability in mind for changes to attendance, notes, users, roles, and appointments.

## Review guidelines

When reviewing or modifying this repository, check for:

- Role-based access regressions.
- Data leakage between CRIT centers.
- Missing validation.
- Missing documentation.
- Unsafe assumptions about external CRIT API availability.
- Overengineering beyond MVP scope.

## Repository: crit-front

### Purpose

`crit-front` is the desktop/responsive web frontend for CRIT Assist.

It contains two web entry points:

- `index.html` for the main operational app.
- `admin.html` for the admin page.

The admin page is visually and functionally separate, but it stays in this repository for the MVP.

### Stack

- HTML.
- CSS.
- TypeScript.
- Vite Vanilla TypeScript.
- No React unless a future issue explicitly changes the decision.
- PDF generation will happen from the frontend.
- API consumption may use Fetch or Axios, but choose one consistently.

### Expected architecture

Use this structure:

```txt
src/
├── apps/
│   ├── main/
│   └── admin/
├── assets/
├── components/
├── features/
├── services/
├── config/
├── guards/
├── types/
└── utils/
```

### Frontend rules

- Do not introduce React, Angular, Vue, or another frontend framework.
- Keep UI code modular by feature.
- Keep reusable UI pieces under `src/components`.
- Keep business-specific screens under `src/features`.
- Keep API calls under `src/services`.
- Keep route guards and role checks under `src/guards`.
- Keep global types under `src/types`.
- Do not duplicate API base URLs; use config/env access.
- Admin pages must call the admin API URL, not the main API URL.
- Main app pages must call the main API URL, not the admin API URL.

### Role-based UI expectations

Initial roles:

- `admin`
- `direccion`
- `recepcion`
- `coordinador`
- `medico`
- `terapeuta`
- `personal_acompanamiento`
- `paciente_familia`

Access expectations:

- Médicos and terapeutas can register attendance and write medical notes.
- Recepción can see attendance/status but must not see clinical note content.
- Dirección and admin can manage users/roles.
- Coordinators can manage schedules and appointments.
- Patient/family portal should not be built unless explicitly requested.

### Build and validation commands

Use these once the repository has working source files:

```bash
npm install
npm run build
npm run lint
npm test
```

If a script is still a placeholder, do not pretend it validates behavior. Mention that it is pending.
