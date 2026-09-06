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
- `GET /api/v1/chats`
- `GET /api/v1/chats/codex/models` (requires an in-memory Codex session)
- `POST /api/v1/chats`
- `GET /api/v1/chats/:chatId`
- `POST /api/v1/chats/:chatId/messages`
- `GET /api/v1/integrations`
- `POST /api/v1/integrations/:provider/connect` (owner only)
- `POST /api/v1/integrations/:provider/reconnect` (owner only)
- `POST /api/v1/integrations/:provider/retry` (owner only)
- `POST /api/v1/integrations/:provider/disconnect` (owner only)
- `GET /api/v1/integrations/codex/connect/:attemptId`
- `POST /api/v1/integrations/codex/connect/:attemptId/cancel` (owner only)
- `GET /api/v1/integrations/composio/callback`
- `POST /api/v1/integrations/webhooks/composio` (signed Composio webhook)

All computer and authenticated integration routes require a verified Supabase
access token. The organization is derived from membership server-side; the
browser cannot choose it. Integration mutations are owner-only. The API uses
its private Prized, Composio, and knowledge-service credentials. Slack, Linear,
and GitHub OAuth credentials remain managed by Composio. Codex
uses OpenAI's device authorization flow independently and Cloudberry does not
persist its OAuth tokens.

Copy `.env.example` to `.env` and configure `COMPOSIO_API_KEY`, the callback and
webhook URLs/secrets, and `COMPOSIO_TRIGGER_DEFINITIONS`. Trigger definitions
must use the exact slugs/configuration from the Composio trigger catalog. The
currently supported read-only trigger examples are:

- Slack: `SLACK_CHANNEL_MESSAGE_RECEIVED` with an empty config.
- Linear: `LINEAR_COMMENT_EVENT_TRIGGER`, `LINEAR_ISSUE_CREATED_TRIGGER`, and
  `LINEAR_ISSUE_UPDATED_TRIGGER`, each with `{ "team_id": "..." }`.
- GitHub: `GITHUB_COMMIT_EVENT` with `{ "owner": "...", "repo": "..." }`.

The server will connect an account even when no trigger definitions are
configured, but will report the event stream as not configured until
one or more definitions are supplied.

The Composio webhook URL must be publicly reachable in production. Set
`COMPOSIO_WEBHOOK_SECRET` to the signing secret returned by the Composio webhook
subscription; it is not an arbitrary Cloudberry secret. During local development,
use the Composio CLI forwarding command or a secure tunnel and keep the same
webhook handler/signature verification path.

Codex device authorization uses `CODEX_AUTH_BASE_URL` and the optional
`CODEX_CLIENT_ID` (the official Cloudberry Codex client id is used when it is
omitted). `CODEX_AUTH_TIMEOUT_MS` can override the outbound auth timeout.
Codex chat execution uses the official local `codex app-server` command. Set
`CODEX_CLI_PATH` when `codex` is not on the server `PATH`, and optionally set
`CODEX_HOME_ROOT` and `CODEX_RUNTIME_WORKSPACE_ROOT` to absolute, private
runtime directories. `CODEX_RUNTIME_ENABLED=false` disables this provider.
Cloudberry starts one isolated app-server process per organization and keeps
its Codex access/refresh credentials in memory only; they are not stored in
Supabase or sent to the browser. Existing active Codex integrations must
reauthorize after a server restart because those credentials are intentionally
not durable.

Hosted chat generation also requires `GENERALCOMPUTE_API_KEY`. Company
knowledge requires the `KNOWLEDGE_SERVICE_URL`/`KNOWLEDGE_SERVICE_TOKEN` pair.
For local development, use `http://127.0.0.1:8001` and one random shared token
in both `apps/server/.env` and `services/knowledge/.env`. The API returns a
specific configuration error when the hosted or knowledge service is
unavailable; Codex can still answer without knowledge when that optional
service is down.

Run server tests with:

```powershell
bun run test
```
