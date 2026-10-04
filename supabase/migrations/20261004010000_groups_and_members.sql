-- Group management: create groups, add members, store raw expense text.
-- Requires 20261004000000_fix_members_rls_recursion.sql (private.is_group_member).

begin;

-- expenses: keep the original WhatsApp-style message ----------------------
alter table public.expenses
  add column if not exists raw_text text;

-- groups: remember who created the group ----------------------------------
alter table public.groups
  add column if not exists created_by uuid
  references auth.users (id) on delete set null
  default auth.uid();

-- members: names are matched by the AI parser, so keep them unique per group
create unique index if not exists members_group_id_name_key
  on public.members (group_id, lower(name));

-- a user can be linked to at most one member per group
create unique index if not exists members_group_id_user_id_key
  on public.members (group_id, user_id)
  where user_id is not null;

-- create_group: insert the group and its creator as the first member in one
-- transaction. Needed because the creator can't see the new group (RLS)
-- until their member row exists.
create or replace function public.create_group(group_name text, creator_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_group_id uuid;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  group_name := btrim(group_name);
  creator_name := btrim(creator_name);

  if char_length(group_name) not between 1 and 50 then
    raise exception 'Group name must be 1-50 characters' using errcode = '22023';
  end if;
  if char_length(creator_name) not between 1 and 50 then
    raise exception 'Member name must be 1-50 characters' using errcode = '22023';
  end if;

  insert into public.groups (name, created_by)
  values (group_name, uid)
  returning id into new_group_id;

  insert into public.members (group_id, name, user_id)
  values (new_group_id, creator_name, uid);

  return new_group_id;
end;
$$;

revoke execute on function public.create_group(text, text) from public, anon;
grant execute on function public.create_group(text, text) to authenticated;

-- members: group members can add people by name. user_id must stay null —
-- you can't link someone else's account; they claim their member later.
drop policy if exists "Users can add members to their groups" on public.members;
create policy "Users can add members to their groups"
  on public.members for insert
  to authenticated
  with check (
    private.is_group_member(group_id)
    and user_id is null
  );

commit;
