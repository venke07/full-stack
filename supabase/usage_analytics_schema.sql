-- Usage analytics tracking
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  agent_id uuid not null,
  conversation_id uuid,
  created_at timestamptz not null default now(),
  user_message_length integer default 0,
  assistant_message_length integer default 0,
  user_tokens_estimate integer default 0,
  assistant_tokens_estimate integer default 0,
  total_tokens_estimate integer default 0,
  response_time_ms integer,
  metadata jsonb default '{}'::jsonb
);

create index if not exists usage_events_user_id_idx on public.usage_events (user_id);
create index if not exists usage_events_agent_id_idx on public.usage_events (agent_id);
create index if not exists usage_events_created_at_idx on public.usage_events (created_at);

alter table public.usage_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'usage_events' and policyname = 'usage_events_select_own'
  ) then
    create policy usage_events_select_own
      on public.usage_events
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'usage_events' and policyname = 'usage_events_insert_own'
  ) then
    create policy usage_events_insert_own
      on public.usage_events
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;
