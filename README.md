# Cloudberry

Cloudberry is a company knowledge workspace. It combines Supabase Auth and
Postgres, a TypeScript API server, and a TypeScript worker. Company knowledge
search uses Postgres full-text search over ingested company events.

## Architecture

```text
Browser (Next.js app)
        |
        v
TypeScript API server -----> Supabase Auth/Postgres <----- TypeScript worker
        |
        v
General Compute (hosted chat)
```

The browser never connects to Postgres with elevated access. The API server and
worker use the Supabase service-role key on the server side only.

## Repository layout

- `apps/app` — authenticated Next.js workspace UI
- `apps/marketing` — public marketing site
- `apps/server` — authenticated TypeScript API server
- `apps/worker` — Supabase job worker and optional fixture-only tools
- `packages/contracts` — shared event and knowledge contracts
- `packages/ui` — shared React UI components
- `supabase` — database migrations and hosted Supabase setup notes

## Prerequisites

- Bun `1.2.22` and Node.js 20+
- A hosted Supabase project
- A General Compute API key for hosted chat

## Install

```powershell
bun install
```

Create the environment files locally from your private deployment
configuration. Safe variable-name templates are checked in for the browser,
server, and worker; they contain placeholders only. Use these local
file locations:

- `apps/app/.env.local` (copy from `apps/app/.env.example`)
- `apps/server/.env` (copy from `apps/server/.env.example`)
- `apps/worker/.env` (copy from `apps/worker/.env.example`)
- `supabase/.env`

Never commit environment files, service-role keys, database passwords, or
provider API keys. The templates do not make external services available; fill
in the real deployment values before starting the flow.

## Database setup

Apply the migrations to the hosted Supabase project:

```powershell
bunx supabase link --project-ref <project-ref>
bunx supabase db push
```

Production workspaces are populated by connected integrations, not seed data.
After applying the migrations, configure the private service credentials and open
**Plugins** in the signed-in app. Connecting Slack, Linear, or GitHub completes
OAuth through Composio and provisions the trigger instances that deliver events
to the API webhook.

## Run locally

Start the worker in one terminal:

```powershell
cd apps/worker
bun run start
```

Start the API server in another terminal from the repository root:

```powershell
cd apps/server
bun run dev
```

Start the app in another terminal from the repository root:

```powershell
cd apps/app
bun run dev
```

## Validation

Run the TypeScript checks and production builds from the repository root:

```powershell
bun run typecheck
bun run lint
bun run build
```

Cloudpedia is backed by organization-scoped `knowledge_projections`. The
worker writes projections after a Composio event is ingested and can backfill
projections for already-processed `company_events`:

```powershell
cd apps/worker
bun run backfill
```

The backfill is for existing integration events; it does not create company
content. The `seed` command is only a fixture utility for automated tests or a
throwaway local workspace and is not part of the production data path.

## Current scope

The ingestion pipeline is validated end to end: Supabase company events are
received from Composio triggers, claimed by the worker, projected for
Cloudpedia, and returned through organization-scoped Postgres full-text search
with event provenance.

Codex is a standalone first-class integration, separate from the Prized
computer resource. Users connect their OpenAI account through the Codex device
authorization flow; Cloudberry stores only safe account metadata and never
persists OpenAI access, refresh, or ID tokens.

```text
Browser → authenticated API → OpenAI Codex device authorization
Browser → authenticated API → Composio OAuth (Slack, Linear, GitHub)
Browser → authenticated API → Prized computer provisioning
```

Prized computers can be provisioned independently for future Cloudberry
workflows. Connecting Codex does not provision, configure, or authenticate a
Prized computer, and provisioning a Prized computer does not connect Codex.

Slack, Linear, and GitHub connector ingestion is available through configured
Composio triggers; additional connectors remain outside the current scope.

## Tests

Run the TypeScript test suite from the repository root:

```powershell
bun run test
```

## License

Cloudberry is licensed under the MIT License. See `LICENSE`.
