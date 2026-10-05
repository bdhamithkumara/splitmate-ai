-- Invite links: one shareable link per group. Opening it lets a signed-in
-- user claim an existing member (e.g. "Kasun") or join under a new name.
-- Requires 20261004010000_groups_and_members.sql.

begin;

create table if not exists public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  token text not null unique,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- at most one working link per group; "Reset link" revokes it and makes a new one
create unique index if not exists group_invites_one_active_per_group
  on public.group_invites (group_id)
  where revoked_at is null;

alter table public.group_invites enable row level security;

drop policy if exists "Members can view invites" on public.group_invites;
create policy "Members can view invites"
  on public.group_invites for select
  to authenticated
  using (private.is_group_member(group_id));

drop policy if exists "Members can create invites" on public.group_invites;
create policy "Members can create invites"
  on public.group_invites for insert
  to authenticated
  with check (private.is_group_member(group_id));

drop policy if exists "Members can revoke invites" on public.group_invites;
create policy "Members can revoke invites"
  on public.group_invites for update
  to authenticated
  using (private.is_group_member(group_id))
  with check (private.is_group_member(group_id));

-- get_invite: what the invite page shows. SECURITY DEFINER because the
-- visitor isn't a member yet; it reveals only the group name and member
-- names, and only to someone holding a valid token.
create or replace function public.get_invite(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  gid uuid;
  result jsonb;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select i.group_id into gid
  from public.group_invites i
  where i.token = p_token and i.revoked_at is null;

  if gid is null then
    return null;
  end if;

  select jsonb_build_object(
    'group_id', g.id,
    'group_name', g.name,
    'already_member', exists (
      select 1 from public.members m where m.group_id = g.id and m.user_id = uid
    ),
    'members', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', m.id, 'name', m.name, 'claimed', m.user_id is not null)
        order by m.name
      )
      from public.members m
      where m.group_id = g.id
    ), '[]'::jsonb)
  )
  into result
  from public.groups g
  where g.id = gid;

  return result;
end;
$$;

-- accept_invite: claim an unclaimed member (p_member_id) or join as a new
-- member (p_new_name). Returns the group id.
--   SM404 invalid/revoked link   SM409 member already claimed
--   23505 name already used in the group
create or replace function public.accept_invite(
  p_token text,
  p_member_id uuid default null,
  p_new_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  gid uuid;
  clean_name text := btrim(coalesce(p_new_name, ''));
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select i.group_id into gid
  from public.group_invites i
  where i.token = p_token and i.revoked_at is null;

  if gid is null then
    raise exception 'This invite link is invalid or has been reset' using errcode = 'SM404';
  end if;

  -- already in the group: nothing to do
  if exists (select 1 from public.members where group_id = gid and user_id = uid) then
    return gid;
  end if;

  if p_member_id is not null then
    update public.members
    set user_id = uid
    where id = p_member_id and group_id = gid and user_id is null;

    if not found then
      raise exception 'Someone already joined as that member' using errcode = 'SM409';
    end if;
  else
    if char_length(clean_name) not between 1 and 50 then
      raise exception 'Name must be 1-50 characters' using errcode = '22023';
    end if;

    insert into public.members (group_id, name, user_id)
    values (gid, clean_name, uid);
  end if;

  return gid;
end;
$$;

revoke execute on function public.get_invite(text) from public, anon;
grant execute on function public.get_invite(text) to authenticated;
revoke execute on function public.accept_invite(text, uuid, text) from public, anon;
grant execute on function public.accept_invite(text, uuid, text) to authenticated;

commit;
