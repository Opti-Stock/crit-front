# Auth feature

## Scope

This module provides authentication support for the main CRIT Assistance app.

Included in this module:

- Login page UI
- Session service
- Auth guard
- Session/token strategy documentation

Not included yet:

- Refresh token flow
- Token expiration handling
- Full backend permission enforcement
- Admin authentication flow

---

## Session and token strategy

The frontend only relies on the documented backend contract when available.

### Current assumptions

A successful authentication flow provides an access token, a supported role and, for scoped clinical modules, user metadata.

No additional assumptions are made about:

- JWT claims structure
- refresh token behavior
- tenant metadata inside the token
- expiration format or renewal flow

These details must be implemented only after the backend contract is defined.

---

## Session storage

The current app stores the session in `localStorage` using a single key:

- `crit-assistance.session`

Stored structure:

```ts
interface SessionData {
  accessToken: string;
  role: UserRole;
  user?: {
    id: string;
    fullName?: string;
    email?: string;
    area?: string;
  };
}
```

`user.id` and `user.area` are required by scoped modules such as Registro de asistencias to avoid inventing identity data in the frontend. Backend permission checks remain mandatory.

## Development auth bypass

For local frontend development, the app can simulate a successful login without calling a real auth endpoint.

Environment variable:

```env
VITE_AUTH_BYPASS_ENABLED=true
```

---

## Role-based navigation rules

The frontend applies role-aware navigation rules at UI level for the main and admin application shells.

### Supported roles

- `admin`
- `direccion`
- `recepcion`
- `coordinador`
- `medico`
- `terapeuta`
- `personal_acompanamiento`
- `paciente_familia`

### Current navigation behavior

The active navigation matrix is defined in `role-navigation.config.ts`. Modules must still validate permissions through the backend; UI visibility is only a convenience.

### Centralization

Role rules are centralized in:

- `src/features/auth/config/role-navigation.config.ts`
- `src/features/auth/services/role-navigation.service.ts`
- `src/guards/role-guard.ts`
