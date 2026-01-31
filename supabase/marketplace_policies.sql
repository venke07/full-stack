-- Marketplace visibility + publish policy for agent_personas
-- Allow anyone to read published agents
create policy "agent_personas_select_published"
  on public.agent_personas
  for select
  using (status = 'published');

-- Allow owners to publish/update their own agents
create policy "agent_personas_update_own"
  on public.agent_personas
  for update
  using (auth.uid() = user_id);
