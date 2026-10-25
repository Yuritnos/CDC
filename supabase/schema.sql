-- CDC accounts and sync. Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Each signed-in user can only read and change their own rows (row-level security).

-- One row per CD. `data` is the CD exactly as the app stores it (cover included).
-- A removed CD keeps its row with deleted = true, so other devices learn it was removed.
create table if not exists public.cds (
  user_id    uuid    not null default auth.uid() references auth.users (id) on delete cascade,
  id         text    not null,
  data       jsonb,
  deleted    boolean not null default false,
  updated_ms bigint  not null,            -- when the CD last changed, in milliseconds; the newer copy wins
  primary key (user_id, id)
);

-- One row per user: favorites and settings.
create table if not exists public.meta (
  user_id    uuid   primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb  not null,
  updated_ms bigint not null
);

alter table public.cds  enable row level security;
alter table public.meta enable row level security;

drop policy if exists "own cds" on public.cds;
create policy "own cds" on public.cds
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own meta" on public.meta;
create policy "own meta" on public.meta
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- One row per user: the public profile. `handle` is the user ID people choose (3-20 letters,
-- digits or underscores, unique regardless of upper/lower case); `avatar` is a small cropped
-- JPEG as a data URL.
create table if not exists public.profiles (
  user_id    uuid   primary key default auth.uid() references auth.users (id) on delete cascade,
  handle     text   check (handle ~ '^[A-Za-z0-9_]{3,20}$'),
  avatar     text   check (avatar is null or length(avatar) < 200000),
  updated_ms bigint not null
);
create unique index if not exists profiles_handle_unique on public.profiles (lower(handle));

alter table public.profiles enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
