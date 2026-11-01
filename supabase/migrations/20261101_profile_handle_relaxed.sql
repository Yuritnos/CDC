-- Temporarily allow immediate User ID changes; use 4-20 characters for new IDs.
-- Keep timestamps for a future policy, all existing rows, uniqueness and RLS.
begin;

create or replace function public.enforce_profile_handle_cooldown()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Preserve unchanged legacy IDs during nickname/photo edits.
  if TG_OP = 'INSERT' or NEW.handle is distinct from OLD.handle then
    if NEW.handle is not null and NEW.handle !~ '^[A-Za-z0-9_]{4,20}$' then
      raise exception using errcode = '23514', message = 'PMCO_HANDLE_FORMAT';
    end if;
  end if;
  if TG_OP = 'INSERT' then
    NEW.handle_changed_at := case when NEW.handle is null then null else statement_timestamp() end;
  elsif NEW.handle is distinct from OLD.handle then
    -- Cooldown intentionally suspended. Ignore client-supplied timestamps.
    NEW.handle_changed_at := statement_timestamp();
  else
    NEW.handle_changed_at := OLD.handle_changed_at;
  end if;
  return NEW;
end;
$$;

commit;
