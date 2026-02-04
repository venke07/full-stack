-- Normalize legacy "clone" permissions to "view"
update public.agent_shares set permission = 'view' where permission = 'clone';
update public.agent_share_links set permission = 'view' where permission = 'clone';
update public.agent_share_invites set permission = 'view' where permission = 'clone';
