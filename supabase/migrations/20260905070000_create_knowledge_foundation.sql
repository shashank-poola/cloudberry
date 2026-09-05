create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider ~ '^[a-z][a-z0-9_-]{0,63}$'),
  external_account_id text not null check (char_length(trim(external_account_id)) between 1 and 512),
  status text not null default 'active' check (status in ('active', 'disabled', 'error')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, external_account_id)
);

create table if not exists public.company_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_id uuid references public.integrations(id) on delete set null,
  source text not null check (source ~ '^[a-z][a-z0-9_-]{0,63}$'),
  external_event_id text not null check (char_length(trim(external_event_id)) between 1 and 512),
  external_url text,
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_-]{0,63}$'),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  actor jsonb check (actor is null or jsonb_typeof(actor) = 'object'),
  title text,
  content text not null check (char_length(trim(content)) between 1 and 100000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) in ('object', 'array')),
  normalized_payload jsonb not null check (jsonb_typeof(normalized_payload) = 'object'),
  processing_status text not null default 'queued' check (processing_status in ('queued', 'processing', 'processed', 'failed')),
  processing_attempts integer not null default 0 check (processing_attempts >= 0),
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source, external_event_id)
);

create index if not exists company_events_organization_occurred_at_index
  on public.company_events (organization_id, occurred_at desc);

create index if not exists company_events_processing_index
  on public.company_events (processing_status, received_at asc);

create table if not exists public.knowledge_jobs (
  id uuid primary key default gen_random_uuid(),
  company_event_id uuid not null unique references public.company_events(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'processing', 'succeeded', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_jobs_next_attempt_index
  on public.knowledge_jobs (status, next_attempt_at asc);

create table if not exists public.knowledge_projections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  projection_type text not null check (projection_type ~ '^[a-z][a-z0-9_-]{0,63}$'),
  subject_key text not null check (char_length(trim(subject_key)) between 1 and 512),
  source_event_id uuid references public.company_events(id) on delete set null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, projection_type, subject_key)
);

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_organization_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_organization_owner(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_organization_id
      and user_id = (select auth.uid())
      and role = 'owner'
  );
$$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.integrations enable row level security;
alter table public.company_events enable row level security;
alter table public.knowledge_jobs enable row level security;
alter table public.knowledge_projections enable row level security;

create policy "Organization members can view their organization"
on public.organizations
for select
to authenticated
using (public.is_organization_member(id));

create policy "Organization owners can update their organization"
on public.organizations
for update
to authenticated
using (public.is_organization_owner(id))
with check (public.is_organization_owner(id));

create policy "Organization members can view memberships"
on public.organization_members
for select
to authenticated
using (public.is_organization_member(organization_id));

create policy "Organization owners can manage memberships"
on public.organization_members
for all
to authenticated
using (public.is_organization_owner(organization_id))
with check (public.is_organization_owner(organization_id));

create policy "Organization members can view integrations"
on public.integrations
for select
to authenticated
using (public.is_organization_member(organization_id));

create policy "Organization owners can manage integrations"
on public.integrations
for all
to authenticated
using (public.is_organization_owner(organization_id))
with check (public.is_organization_owner(organization_id));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_id uuid;
  workspace_name text;
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Cloudberry user'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  )
  on conflict (id) do nothing;

  workspace_name := left(
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Cloudberry'
    ),
    108
  ) || '''s workspace';

  insert into public.organizations (name, created_by)
  values (workspace_name, new.id)
  returning id into workspace_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (workspace_id, new.id, 'owner');

  return new;
end;
$$;

do $$
declare
  existing_user record;
  workspace_id uuid;
  workspace_name text;
begin
  for existing_user in
    select id, email, raw_user_meta_data
    from auth.users
    where not exists (
      select 1
      from public.organization_members
      where user_id = auth.users.id
    )
  loop
    workspace_name := left(
      coalesce(
        nullif(existing_user.raw_user_meta_data ->> 'full_name', ''),
        nullif(existing_user.raw_user_meta_data ->> 'name', ''),
        nullif(split_part(coalesce(existing_user.email, ''), '@', 1), ''),
        'Cloudberry'
      ),
      108
    ) || '''s workspace';

    insert into public.organizations (name, created_by)
    values (workspace_name, existing_user.id)
    returning id into workspace_id;

    insert into public.organization_members (organization_id, user_id, role)
    values (workspace_id, existing_user.id, 'owner');
  end loop;
end;
$$;

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
before update on public.organizations
for each row
execute function public.set_updated_at();

drop trigger if exists integrations_set_updated_at on public.integrations;
create trigger integrations_set_updated_at
before update on public.integrations
for each row
execute function public.set_updated_at();

drop trigger if exists company_events_set_updated_at on public.company_events;
create trigger company_events_set_updated_at
before update on public.company_events
for each row
execute function public.set_updated_at();

drop trigger if exists knowledge_jobs_set_updated_at on public.knowledge_jobs;
create trigger knowledge_jobs_set_updated_at
before update on public.knowledge_jobs
for each row
execute function public.set_updated_at();

drop trigger if exists knowledge_projections_set_updated_at on public.knowledge_projections;
create trigger knowledge_projections_set_updated_at
before update on public.knowledge_projections
for each row
execute function public.set_updated_at();
