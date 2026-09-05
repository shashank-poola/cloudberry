create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_organization_member(target_organization_id uuid)
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

create or replace function private.is_organization_owner(target_organization_id uuid)
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

create or replace function private.handle_new_user()
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

revoke all on function private.is_organization_member(uuid) from public, anon;
revoke all on function private.is_organization_owner(uuid) from public, anon;
revoke all on function private.handle_new_user() from public, anon, authenticated;
grant execute on function private.is_organization_member(uuid) to authenticated;
grant execute on function private.is_organization_owner(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.integrations enable row level security;

drop policy if exists "Organization members can view their organization"
on public.organizations;
create policy "Organization members can view their organization"
on public.organizations
for select
to authenticated
using (private.is_organization_member(id));

drop policy if exists "Organization owners can update their organization"
on public.organizations;
create policy "Organization owners can update their organization"
on public.organizations
for update
to authenticated
using (private.is_organization_owner(id))
with check (private.is_organization_owner(id));

drop policy if exists "Organization members can view memberships"
on public.organization_members;
create policy "Organization members can view memberships"
on public.organization_members
for select
to authenticated
using (private.is_organization_member(organization_id));

drop policy if exists "Organization owners can manage memberships"
on public.organization_members;
create policy "Organization owners can insert memberships"
on public.organization_members
for insert
to authenticated
with check (private.is_organization_owner(organization_id));

create policy "Organization owners can update memberships"
on public.organization_members
for update
to authenticated
using (private.is_organization_owner(organization_id))
with check (private.is_organization_owner(organization_id));

create policy "Organization owners can delete memberships"
on public.organization_members
for delete
to authenticated
using (private.is_organization_owner(organization_id));

drop policy if exists "Organization members can view integrations"
on public.integrations;
create policy "Organization members can view integrations"
on public.integrations
for select
to authenticated
using (private.is_organization_member(organization_id));

drop policy if exists "Organization owners can manage integrations"
on public.integrations;
create policy "Organization owners can insert integrations"
on public.integrations
for insert
to authenticated
with check (private.is_organization_owner(organization_id));

create policy "Organization owners can update integrations"
on public.integrations
for update
to authenticated
using (private.is_organization_owner(organization_id))
with check (private.is_organization_owner(organization_id));

create policy "Organization owners can delete integrations"
on public.integrations
for delete
to authenticated
using (private.is_organization_owner(organization_id));

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function private.handle_new_user();

drop function if exists public.handle_new_user();
drop function if exists public.is_organization_member(uuid);
drop function if exists public.is_organization_owner(uuid);
