alter table public.chat_conversations
  add column if not exists reasoning_effort text;

alter table public.chat_conversations
  drop constraint if exists chat_conversations_provider_check,
  drop constraint if exists chat_conversations_model_check;

alter table public.chat_conversations
  add constraint chat_conversations_provider_check
  check (provider in ('hosted', 'codex')),
  add constraint chat_conversations_model_check
  check (
    (provider = 'hosted' and model in ('gpt-oss-120b', 'minimax-m2.7'))
    or (
      provider = 'codex'
      and model ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    )
  ),
  add constraint chat_conversations_reasoning_effort_check
  check (
    (provider = 'hosted' and reasoning_effort is null)
    or (provider = 'codex' and reasoning_effort = 'high')
  );

create index if not exists chat_conversations_provider_activity_index
  on public.chat_conversations (organization_id, provider, last_message_at desc);
