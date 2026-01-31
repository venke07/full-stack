-- Add marketplace fields to agent_personas if missing
alter table public.agent_personas
  add column if not exists tags text[] default '{}',
  add column if not exists downloads integer default 0,
  add column if not exists fork_count integer default 0,
  add column if not exists ratings jsonb default '[]',
  add column if not exists average_rating numeric default 0;

-- Ensure status exists for publishing
alter table public.agent_personas
  add column if not exists status text default 'draft';
