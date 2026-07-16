# Auth feature

The browser authenticates through the `crit_session` HttpOnly cookie. API clients use same-origin credentials and never read, persist or attach JWTs. `sessionStorage` contains only the selected role and non-sensitive profile fields needed by the UI.

Login stores the returned profile; logout calls `/api/auth/logout` and clears the local profile even if the API is unavailable. A 401 clears both operational and platform profiles and opens the custom session-expired screen.

`VITE_AUTH_BYPASS_ENABLED` and admin mocks are allowed only with `VITE_APP_ENV=local`; startup fails in Render or production when either is enabled. Frontend guards improve navigation but do not replace API authorization or PostgreSQL RLS.
