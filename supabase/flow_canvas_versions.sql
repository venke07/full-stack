-- Create table for flow canvas versioning
create table if not exists public.flow_canvas_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  flow_id text not null,
  version integer not null default 1,
  prompt text,
  summary jsonb,
  workflow jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists flow_canvas_versions_user_id_idx on public.flow_canvas_versions (user_id);
create index if not exists flow_canvas_versions_flow_id_idx on public.flow_canvas_versions (flow_id);
create unique index if not exists flow_canvas_versions_user_flow_version_idx
  on public.flow_canvas_versions (user_id, flow_id, version);

alter table public.flow_canvas_versions enable row level security;

-- Policies: users can insert and read their own rows
-- NOTE: Supabase SQL doesn't support "create policy if not exists".
-- Run these once. If you already created them, drop first, then rerun.
create policy "flow_canvas_versions_select_own"
  on public.flow_canvas_versions
  for select
  using (auth.uid() = user_id);

create policy "flow_canvas_versions_insert_own"
  on public.flow_canvas_versions
  for insert
  with check (auth.uid() = user_id);
