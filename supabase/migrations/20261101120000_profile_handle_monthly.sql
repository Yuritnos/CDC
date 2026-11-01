-- Restore a 30-day User ID cooldown and use 6-20 ASCII characters for new/changed IDs.
-- Keep existing IDs, recorded change times, uniqueness and account access policies.
begin;

create or replace function public.enforce_profile_handle_cooldown()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  next_change_at timestamptz;
begin
  -- Only new/changed IDs use the new format. Preserve existing shorter IDs
  -- during nickname/photo edits, and never rewrite an owner's profile.
  if TG_OP = 'INSERT' or NEW.handle is distinct from OLD.handle then
    if NEW.handle is not null and NEW.handle !~ '^[A-Za-z0-9_]{6,20}$' then
      raise exception using errcode = '23514', message = 'PMCO_HANDLE_FORMAT';
    end if;
  end if;
  if TG_OP = 'INSERT' then
    -- Ignore any timestamp supplied by an API client.
    NEW.handle_changed_at := case when NEW.handle is null then null else statement_timestamp() end;
  elsif NEW.handle is distinct from OLD.handle then
    next_change_at := OLD.handle_changed_at + interval '720 hours';
    if next_change_at > statement_timestamp() then
      raise exception using
        errcode = 'P0001',
        message = 'CDC_HANDLE_COOLDOWN';
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

commit;
