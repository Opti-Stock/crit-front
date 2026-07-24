# Scheduling configuration

The main workspace exposes `#scheduling` to `admin`, `coordinador`, and
`recepcion`.

- `admin` and `coordinador` manage clinic operating hours, appointment-type
  compatibility, scheduling blocks, and patient preferences.
- `recepcion` can only read and replace patient preferences.
- Clinic changes reload all scoped catalogs and rules.
- Collection forms replace the complete active server-side collection in one
  request.
- Scheduling blocks use the browser's local date/time input and are sent as ISO
  8601 timestamps.

All requests use the same-origin Main API client. The page never stores access
tokens and relies on the API for tenant, clinic, and role enforcement.
