-- Allow shared users to view conversations for shared agents

create policy "Shared users can view agent conversations" on public.conversation_history
  for select
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.agent_shares s
      where s.agent_id = conversation_history.agent_id
        and s.shared_with_user_id = auth.uid()
    )
  );

create policy "Shared users can view agent messages" on public.conversation_messages
  for select
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.agent_shares s
      where s.agent_id = conversation_messages.agent_id
        and s.shared_with_user_id = auth.uid()
    )
  );
