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
- `GET /api/v1/cloudpedia`
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
webhook URLs/secrets, and any provider-specific scope. Trigger definitions must
use the exact slugs/configuration from the Composio trigger catalog. The
currently supported read-only trigger examples are:

- Slack: `SLACK_CHANNEL_MESSAGE_RECEIVED` with `{ "is_bot_message": false }` to ingest human messages only.
- Linear: `LINEAR_COMMENT_EVENT_TRIGGER`, `LINEAR_ISSUE_CREATED_TRIGGER`, and `LINEAR_ISSUE_UPDATED_TRIGGER`, each with `{ "team_id": "..." }`.
- GitHub: `GITHUB_COMMIT_EVENT` with `{ "owner": "...", "repo": "..." }`.

When `COMPOSIO_TRIGGER_DEFINITIONS` is omitted, the server provisions the
documented Slack trigger automatically. Set `COMPOSIO_LINEAR_TEAM_ID` to
provision the three documented Linear triggers, or use
`COMPOSIO_TRIGGER_DEFINITIONS` when your deployment needs a different catalog
configuration. GitHub remains opt-in through `COMPOSIO_GITHUB_OWNER` and
`COMPOSIO_GITHUB_REPO`. Existing Slack triggers keep their old configuration,
so use **Retry** or reconnect after changing the default configuration.

Cloudberry uses the organization ID as the Composio user identity. The normal
connection flow is Cloudberry's Connect Link callback, which records the local
integration and provisions its triggers. Set `COMPOSIO_LINEAR_AUTH_CONFIG_ID`
to the `ac_...` identifier for Cloudberry's custom Linear OAuth auth config;
the server attaches it only to Linear Connect Link sessions. A connected
account created directly in Composio is discovered only when it uses that same
organization identity; it is recorded as connected with triggers not
configured, and **Retry** can then provision them.

The server will not activate event delivery until the Composio API key, public
webhook URL, and the signing secret returned by the webhook subscription are
configured.

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
in both `apps/server/.env` and `knowledge_base/.env`. The API returns a
specific configuration error when the hosted or knowledge service is
unavailable; Codex can still answer without knowledge when that optional
service is down.

The production event path is:

`Composio trigger → signed webhook → company_events → knowledge worker → Graphiti + Cloudpedia projections`

Cloudpedia projections are written after successful event ingestion. Restarting
the worker also backfills projections for previously processed events, so
existing integration history becomes visible without replaying provider events.

Run server tests with:

```powershell
bun run test
```
