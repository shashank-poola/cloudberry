create table if not exists public.organization_computers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'prized' check (provider = 'prized'),
  external_box_id text not null check (char_length(trim(external_box_id)) between 1 and 512),
  edge_url text not null check (char_length(trim(edge_url)) between 1 and 2048),
  status text not null default 'unknown' check (status ~ '^[a-z][a-z0-9_ -]{0,63}$'),
  last_error text check (last_error is null or last_error ~ '^[A-Z0-9_]{1,128}$'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create table if not exists public.codex_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  computer_id uuid not null references public.organization_computers(id) on delete cascade,
  provider text not null default 'codex' check (provider = 'codex'),
  external_run_id text not null check (char_length(trim(external_run_id)) between 1 and 512),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  cwd text check (cwd is null or char_length(cwd) between 1 and 1024),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  last_event_sequence bigint not null default 0 check (last_event_sequence >= 0),
  last_error text check (last_error is null or last_error ~ '^[A-Z0-9_]{1,128}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, external_run_id)
);

create index if not exists organization_computers_organization_status_index
  on public.organization_computers (organization_id, status);

create index if not exists codex_sessions_organization_status_index
  on public.codex_sessions (organization_id, status);

create index if not exists codex_sessions_computer_index
  on public.codex_sessions (computer_id, created_at desc);

alter table public.organization_computers enable row level security;
alter table public.codex_sessions enable row level security;

revoke all on table public.organization_computers from anon;
revoke insert, update, delete on table public.organization_computers from authenticated;
grant select on table public.organization_computers to authenticated;

revoke all on table public.codex_sessions from anon;
revoke insert, update, delete on table public.codex_sessions from authenticated;
grant select on table public.codex_sessions to authenticated;

drop policy if exists "Organization members can view organization computers"
on public.organization_computers;
create policy "Organization members can view organization computers"
on public.organization_computers
for select
to authenticated
using (private.is_organization_member(organization_id));

drop policy if exists "Organization members can view Codex sessions"
on public.codex_sessions;
create policy "Organization members can view Codex sessions"
on public.codex_sessions
for select
to authenticated
using (private.is_organization_member(organization_id));

drop trigger if exists organization_computers_set_updated_at on public.organization_computers;
create trigger organization_computers_set_updated_at
before update on public.organization_computers
for each row
execute function public.set_updated_at();

drop trigger if exists codex_sessions_set_updated_at on public.codex_sessions;
create trigger codex_sessions_set_updated_at
before update on public.codex_sessions
for each row
execute function public.set_updated_at();
