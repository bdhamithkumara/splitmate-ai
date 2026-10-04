-- Fix: infinite recursion detected in policy for relation "members" (42P17).
--
-- The old members SELECT policy queried `members` from inside its own policy.
-- Membership checks now go through a SECURITY DEFINER function, which reads
-- `members` without re-triggering RLS. It lives in a non-exposed schema so it
-- can't be called through the public API.

begin;

create schema if not exists private;

create or replace function private.is_group_member(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    where m.group_id = gid
      and m.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_group_member(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_group_member(uuid) to authenticated;

-- groups -------------------------------------------------------------------
drop policy if exists "Users can view their groups" on public.groups;
create policy "Users can view their groups"
  on public.groups for select
  to authenticated
  using (private.is_group_member(id));

-- members ------------------------------------------------------------------
drop policy if exists "Users can view members in their groups" on public.members;
create policy "Users can view members in their groups"
  on public.members for select
  to authenticated
  using (private.is_group_member(group_id));

-- expenses -----------------------------------------------------------------
drop policy if exists "Users can view expenses" on public.expenses;
create policy "Users can view expenses"
  on public.expenses for select
  to authenticated
  using (private.is_group_member(group_id));

drop policy if exists "Users can add expenses" on public.expenses;
create policy "Users can add expenses"
  on public.expenses for insert
  to authenticated
  with check (
    private.is_group_member(group_id)
    -- payer must belong to the same group
    and exists (
      select 1 from public.members m
      where m.id = payer_id and m.group_id = expenses.group_id
    )
  );

-- expense_splits -----------------------------------------------------------
drop policy if exists "Users can view expense splits" on public.expense_splits;
create policy "Users can view expense splits"
  on public.expense_splits for select
  to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id and private.is_group_member(e.group_id)
    )
  );

drop policy if exists "Users can add expense splits" on public.expense_splits;
create policy "Users can add expense splits"
  on public.expense_splits for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.expenses e
      join public.members m on m.group_id = e.group_id
      where e.id = expense_id
        and m.id = member_id
        and private.is_group_member(e.group_id)
    )
  );

commit;
