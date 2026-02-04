-- Marketplace visibility + publish policy for agent_personas
-- Allow anyone to read published agents
create policy "agent_personas_select_published"
  on public.agent_personas
  for select
  using (status = 'published');

-- Allow owners and shared users to read their agents.
create policy "agent_personas_select_owner_or_shared"
  on public.agent_personas
  for select
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.agent_shares s
      where s.agent_id = agent_personas.id
        and s.shared_with_user_id = auth.uid()
    )
  );

-- Allow owners to publish/update their own agents
create policy "agent_personas_update_own"
  on public.agent_personas
  for update
  using (auth.uid() = user_id);
