-- Seating Chart & Classroom Manager
-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query).

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'New Class',
  students jsonb not null default '[]'::jsonb,
  seating jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Keep updated_at fresh on every change.
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists classes_touch_updated_at on public.classes;
create trigger classes_touch_updated_at
  before update on public.classes
  for each row execute function public.touch_updated_at();

-- Enable realtime so the Smartboard and laptop stay in sync instantly.
alter publication supabase_realtime add table public.classes;

-- This app has no login screen (it's meant for one classroom's shared devices),
-- so we allow open read/write access via the public anon key.
-- If you ever add teacher accounts, tighten these policies.
alter table public.classes enable row level security;

drop policy if exists "Allow all read" on public.classes;
create policy "Allow all read" on public.classes for select using (true);

drop policy if exists "Allow all insert" on public.classes;
create policy "Allow all insert" on public.classes for insert with check (true);

drop policy if exists "Allow all update" on public.classes;
create policy "Allow all update" on public.classes for update using (true);

drop policy if exists "Allow all delete" on public.classes;
create policy "Allow all delete" on public.classes for delete using (true);
