# Auth feature

## Scope

This module currently provides the frontend skeleton for authentication in the main CRIT Assistance app.

Included in this milestone:

- Login page UI skeleton
- Session service skeleton
- Auth guard skeleton
- Session/token strategy documentation

Not included yet:

- Real login API integration
- Refresh token flow
- Token expiration handling
- Role/permission enforcement
- Admin authentication flow

---

## Session and token strategy

The frontend auth skeleton is intentionally minimal and only relies on the documented backend contract when available.

### Current assumptions
At this stage, the frontend only assumes that a successful authentication flow will eventually provide an **access token**.

No additional assumptions are made about:

- JWT claims structure
- refresh token behavior
- tenant metadata inside the token
- role/permission claims
- expiration format or renewal flow

These details must be implemented only after the backend contract is defined.

---

## Session storage

The current skeleton stores the session in `localStorage` using a single key:

- `crit-assistance.session`

Stored structure:

```ts
interface SessionData {
  accessToken: string;
}
```

## Development auth bypass

For local frontend development, the app can simulate a successful login without calling a real auth endpoint.

Environment variable:

```env
VITE_AUTH_BYPASS_ENABLED=true
```

---

## Role-based navigation rules

The frontend currently applies role-aware navigation rules at UI level for the main and admin application shells.

### Supported roles
- `recepcion`
- `medico`
- `terapeuta`
- `direccion`
- `admin`

### Current navigation behavior

#### recepcion
- can access: Dashboard, Attendance, Calendar
- cannot access: Clinical Notes, Admin entry

#### medico
- can access: Dashboard, Attendance, Calendar, Notes
- cannot access: Admin entry

#### terapeuta
- can access: Dashboard, Attendance, Calendar, Notes
- cannot access: Admin entry

#### direccion
- can access: Dashboard, Admin entry
- cannot access: Attendance, Calendar, Notes

#### admin
- can access: Dashboard, Admin entry
- cannot access: Attendance, Calendar, Notes

### Centralization
Role rules are centralized in:
- `src/features/auth/config/role-navigation.config.ts`
- `src/features/auth/services/role-navigation.service.ts`
- `src/guards/role-guard.ts`

### Future change to option B
If admin and dirección later need access to operational sections such as Attendance, Calendar, or Notes, the change should be done by updating the `allowedRoles` arrays in `role-navigation.config.ts`.