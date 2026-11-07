-- Run once in Supabase → SQL Editor.
-- Then: Authentication → Users → Add user (email + password, auto-confirm),
-- and Authentication → Sign In / Providers → turn OFF "Allow new users to sign up".

create table if not exists public.backups (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  schema_version int not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists backups_user_created_idx on public.backups (user_id, created_at desc);

alter table public.backups enable row level security;

drop policy if exists "own backups select" on public.backups;
create policy "own backups select" on public.backups
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "own backups insert" on public.backups;
create policy "own backups insert" on public.backups
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "own backups delete" on public.backups;
create policy "own backups delete" on public.backups
  for delete to authenticated using (user_id = (select auth.uid()));
-- No update policy: backups are append-only; the app prunes old ones (keeps the latest 5).
