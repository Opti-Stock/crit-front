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
