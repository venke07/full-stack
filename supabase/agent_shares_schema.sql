-- Agent sharing + permissions
create table if not exists public.agent_shares (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  owner_id uuid not null,
  shared_with_user_id uuid not null,
  shared_with_email text,
  permission text not null default 'view',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_shares_permission_check check (permission in ('view', 'edit')),
  constraint agent_shares_unique unique (agent_id, shared_with_user_id)
);

create index if not exists agent_shares_agent_id_idx on public.agent_shares (agent_id);
create index if not exists agent_shares_shared_with_idx on public.agent_shares (shared_with_user_id);

alter table public.agent_shares enable row level security;

create policy "agent_shares_select_owner_or_shared" on public.agent_shares
  for select
  using (auth.uid() = owner_id or auth.uid() = shared_with_user_id);

create policy "agent_shares_insert_owner" on public.agent_shares
  for insert
  with check (auth.uid() = owner_id);

-- Allow recipients to accept email invites without admin lookup.
create policy "agent_shares_insert_recipient_from_invite" on public.agent_shares
  for insert
  with check (
    auth.uid() = shared_with_user_id
    and exists (
      select 1
      from public.agent_share_invites i
      where i.agent_id = agent_shares.agent_id
        and i.owner_id = agent_shares.owner_id
        and i.shared_with_email = (auth.jwt() ->> 'email')
        and i.status = 'pending'
    )
  );

create policy "agent_shares_update_owner" on public.agent_shares
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "agent_shares_delete_owner" on public.agent_shares
  for delete
  using (auth.uid() = owner_id);
