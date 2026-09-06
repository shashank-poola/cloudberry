# Cloudberry API server

The API accepts Supabase access tokens in the `Authorization: Bearer <token>`
header. Authentication is implemented in `src/auth` and user identity is
always derived from the verified Supabase token.

## Local setup

1. Create `.env` in this directory using the private deployment
   configuration.
2. Set the Supabase connection and allowed-origin values.
3. Run `bun run dev`.

Available endpoints:

- `GET /api/v1/auth/health`
- `GET /api/v1/auth/me` (requires a Supabase bearer token)
- `GET /api/v1/computer`
- `POST /api/v1/computer/provision`
- `POST /api/v1/computer/codex/sessions`
- `GET /api/v1/computer/codex/sessions/:id`
- `GET /api/v1/computer/codex/sessions/:id/events`
- `POST /api/v1/computer/codex/sessions/:id/interrupt`

All computer routes require a verified Supabase access token. The organization
is derived from membership server-side; the browser cannot choose it. The API
uses its private Prized and knowledge-service credentials, while the user's
Codex authentication remains on the provided Prized computer.

Run server tests with:

```powershell
bun run test
```
