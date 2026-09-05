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
