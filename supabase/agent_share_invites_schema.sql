-- Agent share invites (email-based, no admin lookup)
create table if not exists public.agent_share_invites (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  owner_id uuid not null,
  shared_with_email text not null,
  permission text not null default 'view',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_share_invites_permission_check check (permission in ('view', 'edit')),
  constraint agent_share_invites_status_check check (status in ('pending', 'accepted', 'revoked')),
  constraint agent_share_invites_unique unique (agent_id, shared_with_email)
);

create index if not exists agent_share_invites_agent_id_idx on public.agent_share_invites (agent_id);
create index if not exists agent_share_invites_owner_id_idx on public.agent_share_invites (owner_id);
create index if not exists agent_share_invites_email_idx on public.agent_share_invites (shared_with_email);

alter table public.agent_share_invites enable row level security;

-- Owners can read their invites; recipients can read invites addressed to their email.
create policy "agent_share_invites_select_owner_or_recipient" on public.agent_share_invites
  for select
  using (auth.uid() = owner_id or (auth.jwt() ->> 'email') = shared_with_email);

-- Owners can create invites.
create policy "agent_share_invites_insert_owner" on public.agent_share_invites
  for insert
  with check (auth.uid() = owner_id);

-- Owners and recipients can update (owner revoke, recipient accept).
create policy "agent_share_invites_update_owner_or_recipient" on public.agent_share_invites
  for update
  using (auth.uid() = owner_id or (auth.jwt() ->> 'email') = shared_with_email)
  with check (auth.uid() = owner_id or (auth.jwt() ->> 'email') = shared_with_email);

-- Owners can delete invites.
create policy "agent_share_invites_delete_owner" on public.agent_share_invites
  for delete
  using (auth.uid() = owner_id);
