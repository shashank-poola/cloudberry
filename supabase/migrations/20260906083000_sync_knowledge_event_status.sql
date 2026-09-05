create or replace function public.claim_next_knowledge_job()
returns setof public.knowledge_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_job public.knowledge_jobs;
begin
  update public.company_events as event
  set processing_status = 'queued',
      updated_at = now()
  from public.knowledge_jobs as job
  where event.id = job.company_event_id
    and job.status = 'processing'
    and job.locked_at is not null
    and job.locked_at < now() - interval '10 minutes';

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

  update public.company_events
  set processing_status = 'processing',
      processing_attempts = claimed_job.attempts,
      last_error = null,
      updated_at = now()
  where id = claimed_job.company_event_id;

  return next claimed_job;
end;
$$;
