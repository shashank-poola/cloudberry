create index if not exists chat_conversations_title_fts_index
  on public.chat_conversations
  using gin (to_tsvector('simple'::regconfig, title));

create index if not exists chat_messages_content_fts_index
  on public.chat_messages
  using gin (to_tsvector('simple'::regconfig, content));

create or replace function public.search_chat_content(
  p_organization_id uuid,
  p_query text,
  p_limit integer default 20
)
returns table (
  chat_id uuid,
  title text,
  status text,
  message_id uuid,
  match_type text,
  snippet text,
  last_message_at timestamptz
)
language sql
security invoker
set search_path = public
as $$
  with query as (
    select websearch_to_tsquery('simple'::regconfig, trim(p_query)) as value
  ),
  matches as (
    select
      conversation.id as chat_id,
      conversation.title,
      conversation.status,
      null::uuid as message_id,
      'title'::text as match_type,
      conversation.title as snippet,
      conversation.last_message_at,
      ts_rank_cd(
        to_tsvector('simple'::regconfig, conversation.title),
        query.value
      ) as rank
    from public.chat_conversations as conversation
    cross join query
    where conversation.organization_id = p_organization_id
      and to_tsvector('simple'::regconfig, conversation.title) @@ query.value

    union all

    select
      conversation.id as chat_id,
      conversation.title,
      conversation.status,
      message.id as message_id,
      'message'::text as match_type,
      left(regexp_replace(message.content, '\s+', ' ', 'g'), 240) as snippet,
      conversation.last_message_at,
      ts_rank_cd(
        to_tsvector('simple'::regconfig, message.content),
        query.value
      ) as rank
    from public.chat_messages as message
    join public.chat_conversations as conversation
      on conversation.id = message.chat_id
      and conversation.organization_id = message.organization_id
    cross join query
    where message.organization_id = p_organization_id
      and to_tsvector('simple'::regconfig, message.content) @@ query.value
  ),
  best_matches as (
    select distinct on (chat_id)
      chat_id,
      title,
      status,
      message_id,
      match_type,
      snippet,
      last_message_at,
      rank
    from matches
    order by chat_id, rank desc, last_message_at desc nulls last
  )
  select
    chat_id,
    title,
    status,
    message_id,
    match_type,
    snippet,
    last_message_at
  from best_matches
  order by rank desc, last_message_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 20), 20));
$$;

revoke all on function public.search_chat_content(uuid, text, integer) from public;
revoke all on function public.search_chat_content(uuid, text, integer) from anon;
revoke all on function public.search_chat_content(uuid, text, integer) from authenticated;
grant execute on function public.search_chat_content(uuid, text, integer) to service_role;
