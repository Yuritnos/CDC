-- Run the whole migration in SQL Editor. Safe to rerun; preserves every profile.
begin;

-- Preserve profiles and existing policies. NULL timestamps allow one grandfathered
-- change; initial assignment and later changes start a 30-day cooldown.
alter table public.profiles add column if not exists handle_changed_at timestamptz;

create or replace function public.enforce_profile_handle_cooldown()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  next_change_at timestamptz;
begin
  if TG_OP = 'INSERT' then
    -- Ignore any timestamp supplied by an API client.
    NEW.handle_changed_at := case when NEW.handle is null then null else statement_timestamp() end;
  elsif NEW.handle is distinct from OLD.handle then
    next_change_at := OLD.handle_changed_at + interval '720 hours';
    if next_change_at > statement_timestamp() then
      raise exception using
        errcode = 'P0001',
        message = 'CDC_HANDLE_COOLDOWN',
        detail = to_char(next_change_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
    end if;
    -- Clearing an ID also consumes the change; reassigning cannot evade the cooldown.
    NEW.handle_changed_at := statement_timestamp();
  else
    -- Nickname/avatar edits never move the cooldown, even with a forged timestamp.
    NEW.handle_changed_at := OLD.handle_changed_at;
  end if;
  return NEW;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.profiles'::regclass and tgname = 'profiles_handle_cooldown'
  ) then
    create trigger profiles_handle_cooldown
      before insert or update on public.profiles
      for each row execute function public.enforce_profile_handle_cooldown();
  end if;
  -- Restrictive policies also apply when an existing permissive FOR ALL policy
  -- allows DELETE. Account deletion through auth.users can still cascade.
  if not exists (
    select 1 from pg_catalog.pg_policy
    where polrelid = 'public.profiles'::regclass and polname = 'profiles_no_client_delete'
  ) then
    create policy profiles_no_client_delete on public.profiles
      as restrictive for delete to authenticated using (false);
  end if;
end;
$$;

commit;
