alter table public.integrations
  drop constraint if exists integrations_status_check;

alter table public.integrations
  add constraint integrations_status_check
  check (status in ('active', 'disabled', 'error', 'reauthorization_required'));

create table if not exists public.integration_connection_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('codex', 'github', 'slack', 'linear')),
  requested_by uuid references auth.users(id) on delete set null,
  state text not null unique check (char_length(trim(state)) between 16 and 256),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  connected_account_id text
    check (connected_account_id is null or char_length(trim(connected_account_id)) between 1 and 512),
  error_code text
    check (error_code is null or error_code ~ '^[A-Z0-9_]{1,128}$'),
  expires_at timestamptz not null,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists integration_connection_attempts_lookup_index
  on public.integration_connection_attempts (state, status, expires_at);

create index if not exists integrations_external_account_lookup_index
  on public.integrations (external_account_id);

alter table public.integration_connection_attempts enable row level security;

revoke all on table public.integration_connection_attempts from anon, authenticated;
grant all on table public.integration_connection_attempts to service_role;

drop trigger if exists integration_connection_attempts_set_updated_at
on public.integration_connection_attempts;
create trigger integration_connection_attempts_set_updated_at
before update on public.integration_connection_attempts
for each row
execute function public.set_updated_at();
