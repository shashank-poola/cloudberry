# Cloudberry

Cloudberry is a company knowledge workspace. It combines Supabase Auth and
Postgres, a TypeScript ingestion worker, and a private Python knowledge service
backed by Graphiti and FalkorDB.

## Architecture

```text
Browser (Next.js app)
        |
        v
TypeScript API server -----> Supabase Auth/Postgres
        ^                         |
        |                         v
Python knowledge service <--- TypeScript worker
        |
        v
FalkorDB Cloud + General Compute + local FastEmbed
```

The browser never connects directly to FalkorDB or the internal knowledge
service. The worker uses the Supabase service-role key and the knowledge service
uses its own internal bearer token.

## Repository layout

- `apps/app` — authenticated Next.js workspace UI
- `apps/marketing` — public marketing site
- `apps/server` — authenticated TypeScript API server
- `apps/worker` — Supabase job worker and deterministic seed command
- `packages/contracts` — shared event and knowledge contracts
- `packages/ui` — shared React UI components
- `services/knowledge` — private FastAPI/Graphiti service
- `supabase` — database migrations and hosted Supabase setup notes

## Prerequisites

- Bun `1.2.22` and Node.js 20+
- Python 3.10+
- A hosted Supabase project
- A FalkorDB Cloud database
- A General Compute API key for Graphiti extraction

## Install

```powershell
bun install
python -m pip install -e ".\\services\\knowledge[test]"
```

Create the environment files locally from your private deployment
configuration. The repository intentionally does not publish `.env` templates.
Use these local file locations:

- `apps/app/.env.local`
- `apps/server/.env`
- `apps/worker/.env`
- `services/knowledge/.env`
- `supabase/.env`

Never commit environment files, service-role keys, database passwords, or
provider API keys.

## Database setup

Apply the migrations to the hosted Supabase project:

```powershell
bunx supabase link --project-ref <project-ref>
bunx supabase db push
```

The worker seeds a deterministic four-event chain. For a signed-in dashboard
user to retrieve it, target that user's organization UUID (found in
`organization_members`) rather than the fixed fixture organization:

```powershell
$env:SEED_ORGANIZATION_ID = "<signed-in-organization-uuid>"
cd apps/worker
bun run seed
```

## Run locally

Start the private knowledge service in one terminal:

```powershell
python -m uvicorn app.main:app `
  --app-dir .\\services\\knowledge `
  --host 0.0.0.0 `
  --port 8001
```

Start the worker in another terminal:

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

The knowledge service exposes `/health`, plus authenticated internal routes for
episode ingestion and organization-scoped search. It returns `503` from health
until its FalkorDB, LLM, embedding, and token configuration is valid.

## Validation

Run the TypeScript checks and production builds from the repository root:

```powershell
bun run typecheck
bun run lint
bun run build
```

Run the knowledge-service tests:

```powershell
cd services/knowledge
python -m pytest tests -q
python -m compileall -q app tests
```

The hosted Graphiti integration test is opt-in because it uses FalkorDB and LLM
resources:

```powershell
$env:RUN_LIVE_GRAPH_TESTS = "true"
python -m pytest tests/test_graph_integration.py -q
```

## Current scope

The ingestion pipeline is validated end to end: Supabase company events are
claimed by the worker, ingested into Graphiti/FalkorDB, and returned through
organization-scoped search with event provenance.

The first Codex computer slice is also wired end to end:

```text
Browser → authenticated API → Prized company computer → Codex CLI
                         └→ organization-scoped knowledge search
```

Cloudberry provisions or wakes one Prized computer per organization, adds
bounded company context to each prompt, and returns sanitized Codex session
events to the authenticated browser. The user authenticates Codex directly on
the provided computer; Cloudberry never stores that credential.

External Slack, Linear, GitHub, and other connector ingestion is intentionally
not enabled yet.

## Tests

Run the TypeScript test suite from the repository root:

```powershell
bun run test
```

## License

Cloudberry is licensed under the MIT License. See `LICENSE`.
