-- Company knowledge search runs directly on company_events with Postgres
-- full-text search, replacing the separate Graphiti/FalkorDB service.
create index if not exists company_events_knowledge_fts_index
  on public.company_events
  using gin (
    to_tsvector(
      'english'::regconfig,
      coalesce(title, '') || ' ' || content
    )
  );

create or replace function public.search_company_knowledge(
  p_organization_id uuid,
  p_query text,
  p_limit integer default 8
)
returns table (
  id uuid,
  type text,
  content text,
  score real,
  source_event_ids text[]
)
language sql
stable
security invoker
set search_path = public
as $$
  with query as (
    -- Chat prompts are natural-language questions, so match any meaningful
    -- term and let ranking favour events that match more of them.
    select nullif(
      replace(
        plainto_tsquery('english'::regconfig, trim(p_query))::text,
        ' & ',
        ' | '
      ),
      ''
    )::tsquery as value
  )
  select
    event.id,
    left(event.source || '_' || event.event_type, 64) as type,
    left(
      case
        when event.title is null then event.content
        else event.title || E'\n\n' || event.content
      end,
      4000
    ) as content,
    ts_rank_cd(
      to_tsvector(
        'english'::regconfig,
        coalesce(event.title, '') || ' ' || event.content
      ),
      query.value
    ) as score,
    array[event.id::text] as source_event_ids
  from public.company_events as event
  cross join query
  where event.organization_id = p_organization_id
    and query.value is not null
    and to_tsvector(
      'english'::regconfig,
      coalesce(event.title, '') || ' ' || event.content
    ) @@ query.value
  order by score desc, event.occurred_at desc
  limit greatest(1, least(coalesce(p_limit, 8), 25));
$$;

revoke all on function public.search_company_knowledge(uuid, text, integer) from public;
revoke all on function public.search_company_knowledge(uuid, text, integer) from anon;
revoke all on function public.search_company_knowledge(uuid, text, integer) from authenticated;
grant execute on function public.search_company_knowledge(uuid, text, integer) to service_role;
