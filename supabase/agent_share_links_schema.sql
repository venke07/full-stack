-- Agent share links (tokenized URLs)
create table if not exists public.agent_share_links (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  owner_id uuid not null,
  token text not null unique,
  permission text not null default 'view',
  is_public boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists agent_share_links_agent_id_idx on public.agent_share_links (agent_id);
create index if not exists agent_share_links_owner_id_idx on public.agent_share_links (owner_id);

alter table public.agent_share_links enable row level security;

create policy "agent_share_links_select_owner" on public.agent_share_links
  for select
  using (auth.uid() = owner_id);

create policy "agent_share_links_insert_owner" on public.agent_share_links
  for insert
  with check (auth.uid() = owner_id);

create policy "agent_share_links_delete_owner" on public.agent_share_links
  for delete
  using (auth.uid() = owner_id);


create policy "agent_share_links_update_owner" on public.agent_share_links
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
