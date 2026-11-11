-- Private, append-only sync events for farm profiles, advice, budgets and reminders.
-- Cloud sync uses Supabase anonymous auth by default; enable anonymous sign-in in Auth settings.
create table if not exists public.farm_workspace_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null,
  entity_kind text not null check (entity_kind in ('profile', 'task', 'advice', 'cost', 'service')),
  entity_key text not null,
  payload jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index if not exists farm_workspace_events_updated_idx
  on public.farm_workspace_events (user_id, updated_at);

alter table public.farm_workspace_events enable row level security;

create policy "Users can read their farm workspace events"
  on public.farm_workspace_events for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can append their farm workspace events"
  on public.farm_workspace_events for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their farm workspace events"
  on public.farm_workspace_events for delete to authenticated
  using ((select auth.uid()) = user_id);
