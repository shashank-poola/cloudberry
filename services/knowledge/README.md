# Cloudberry knowledge service

This service is the private Graphiti boundary for Cloudberry. It uses hosted
FalkorDB, General Compute for structured extraction, and a local FastEmbed model
for embeddings and reranking. It does not connect to Slack, Linear, GitHub, or
Composio.

## Hosted setup

No local Docker service is required.

1. Create a FalkorDB Cloud database and collect its host, port, username, and
   password. Enable TLS when the provider requires it.
2. Create `services/knowledge/.env` from the private deployment
   configuration (or provide the variables through the deployment environment).
3. Apply the Supabase migrations from the repository root:

   ```bash
   bunx supabase link --project-ref <project-ref>
   bunx supabase db push
   ```

4. Install and run the service with Python 3.10+:

   ```powershell
   python -m pip install -e ".\\services\\knowledge[test]"
   python -m uvicorn app.main:app `
     --app-dir .\\services\\knowledge `
     --host 0.0.0.0 `
     --port 8001
   ```

Set the General Compute values from the private deployment configuration
rather than `OPENAI_API_KEY`. An existing `OPENAI_API_KEY` value beginning with
`gc_` is accepted as a migration alias, but the provider-specific name is
preferred.
General Compute exposes chat completions but not
`/v1/embeddings`, so the first startup downloads the small
`BAAI/bge-small-en-v1.5` FastEmbed model. That model runs locally and does not
use inference credits. The service reports `503` from `/health` until FalkorDB,
General Compute, the local embedding model, and the internal token are ready.
The browser must never connect to this service or FalkorDB directly.

## Internal API

All non-health endpoints require:

```text
Authorization: Bearer <KNOWLEDGE_SERVICE_TOKEN>
```

- `POST /internal/v1/episodes` validates one canonical `CompanyEvent`, writes
  one Graphiti episode, and uses `organization_id` as the FalkorDB graph group.
- `POST /internal/v1/search` validates one organization-scoped search request
  and returns only results from that organization, including episode UUIDs as
  provenance.

The service initializes the base Graphiti indexes at startup and initializes
indexes for each organization graph the first time that graph is used.

## Seeded pipeline

The worker owns PostgreSQL job processing and uses only the Supabase service-role
key. To seed the deterministic Slack/Linear/GitHub-style chain:

```bash
cd apps/worker
bun install
bun run seed
bun run start
```

The seed command inserts the fixtures into `company_events`; the database
trigger creates one `knowledge_jobs` row per event. Set `SEED_ORGANIZATION_ID`
to the organization UUID of the signed-in demo user so that organization-scoped
search can retrieve the seeded knowledge. The worker claims those jobs, sends
normalized events to the knowledge service, and records success or retry/failure
state.

The fixtures are in `tests/fixtures` and cover a Slack decision, a Linear task,
a GitHub pull request, and a later decision that supersedes the first provider.
Run the service tests with:

```bash
cd services/knowledge
python -m pytest tests -q
```

The hosted Graphiti integration test is opt-in so a normal test run cannot
spend inference credits:

```powershell
$env:RUN_LIVE_GRAPH_TESTS = "true"
python -m pytest tests/test_graph_integration.py -q
```

It requires FalkorDB, General Compute, and local embedding configuration. The
test calls the configured LLM and loads the local embedding model.
