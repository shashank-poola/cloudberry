create or replace function private.enqueue_knowledge_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.knowledge_jobs (company_event_id)
  values (new.id)
  on conflict (company_event_id) do nothing;

  return new;
end;
$$;

revoke all on function private.enqueue_knowledge_job() from public, anon, authenticated;

drop trigger if exists company_events_enqueue_knowledge_job on public.company_events;
create trigger company_events_enqueue_knowledge_job
after insert on public.company_events
for each row
execute function private.enqueue_knowledge_job();

insert into public.knowledge_jobs (company_event_id)
select id
from public.company_events
on conflict (company_event_id) do nothing;

create index if not exists knowledge_jobs_claim_index
  on public.knowledge_jobs (status, next_attempt_at asc, created_at asc);

create or replace function public.claim_next_knowledge_job()
returns setof public.knowledge_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_job public.knowledge_jobs;
begin
  update public.knowledge_jobs
  set status = 'queued',
      locked_at = null,
      updated_at = now()
  where status = 'processing'
    and locked_at is not null
    and locked_at < now() - interval '10 minutes';

  select *
  into claimed_job
  from public.knowledge_jobs
  where status = 'queued'
    and next_attempt_at <= now()
  order by next_attempt_at asc, created_at asc
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update public.knowledge_jobs
  set status = 'processing',
      attempts = attempts + 1,
      locked_at = now(),
      updated_at = now()
  where id = claimed_job.id
  returning * into claimed_job;

  return next claimed_job;
end;
$$;

revoke all on function public.claim_next_knowledge_job() from public, anon, authenticated;
grant execute on function public.claim_next_knowledge_job() to service_role;
