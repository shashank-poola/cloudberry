create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null default 'New chat'
    check (char_length(trim(title)) between 1 and 200),
  provider text not null default 'hosted' check (provider = 'hosted'),
  model text not null check (model in ('gpt-oss-120b', 'minimax-m2.7')),
  status text not null default 'active' check (status in ('active', 'archived')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  chat_id uuid not null,
  position bigint generated always as identity,
  role text not null check (role in ('user', 'assistant')),
  author_id uuid references auth.users(id) on delete restrict,
  content text not null default '' check (char_length(content) <= 100000),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  last_error text check (last_error is null or last_error ~ '^[A-Z0-9_]{1,128}$'),
  client_message_id uuid,
  provider_message_id text check (
    provider_message_id is null
    or char_length(trim(provider_message_id)) between 1 and 512
  ),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, chat_id)
    references public.chat_conversations (organization_id, id)
    on delete cascade,
  unique (organization_id, chat_id, position)
);

create unique index if not exists chat_messages_client_message_id_index
  on public.chat_messages (chat_id, client_message_id)
  where client_message_id is not null;

create index if not exists chat_conversations_organization_activity_index
  on public.chat_conversations (organization_id, last_message_at desc);

create index if not exists chat_messages_chat_position_index
  on public.chat_messages (organization_id, chat_id, position asc);

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

revoke all on table public.chat_conversations from anon;
revoke insert, update, delete on table public.chat_conversations from authenticated;
grant select on table public.chat_conversations to authenticated;

revoke all on table public.chat_messages from anon;
revoke insert, update, delete on table public.chat_messages from authenticated;
grant select on table public.chat_messages to authenticated;

drop policy if exists "Organization members can view chat conversations"
on public.chat_conversations;
create policy "Organization members can view chat conversations"
on public.chat_conversations
for select
to authenticated
using (private.is_organization_member(organization_id));

drop policy if exists "Organization members can view chat messages"
on public.chat_messages;
create policy "Organization members can view chat messages"
on public.chat_messages
for select
to authenticated
using (private.is_organization_member(organization_id));

drop trigger if exists chat_conversations_set_updated_at on public.chat_conversations;
create trigger chat_conversations_set_updated_at
before update on public.chat_conversations
for each row
execute function public.set_updated_at();

drop trigger if exists chat_messages_set_updated_at on public.chat_messages;
create trigger chat_messages_set_updated_at
before update on public.chat_messages
for each row
execute function public.set_updated_at();
