-- Edit and delete expenses. Any member of a group can change its expenses.
-- Requires 20261004030000_chat_import.sql.

begin;

-- RLS ------------------------------------------------------------------------
drop policy if exists "Users can update expenses" on public.expenses;
create policy "Users can update expenses"
  on public.expenses for update
  to authenticated
  using (private.is_group_member(group_id))
  with check (
    private.is_group_member(group_id)
    and exists (
      select 1 from public.members m
      where m.id = payer_id and m.group_id = expenses.group_id
    )
  );

drop policy if exists "Users can delete expenses" on public.expenses;
create policy "Users can delete expenses"
  on public.expenses for delete
  to authenticated
  using (private.is_group_member(group_id));

drop policy if exists "Users can delete expense splits" on public.expense_splits;
create policy "Users can delete expense splits"
  on public.expense_splits for delete
  to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id and private.is_group_member(e.group_id)
    )
  );

-- update_expense: change the expense and rebuild its equal splits in one
-- transaction. SECURITY INVOKER, so the policies above decide access.
create or replace function public.update_expense(
  p_expense_id uuid,
  p_payer_id uuid,
  p_amount numeric,
  p_description text,
  p_participant_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  participants uuid[];
  participant_count int;
  total_cents bigint;
  base_cents bigint;
  remainder_cents bigint;
  i int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount > 100000000 then
    raise exception 'Amount must be between 0 and 100,000,000' using errcode = '22023';
  end if;

  select array_agg(id order by first_pos)
  into participants
  from (
    select id, min(pos) as first_pos
    from unnest(p_participant_ids) with ordinality as t(id, pos)
    where id is not null
    group by id
  ) d;

  participant_count := coalesce(array_length(participants, 1), 0);
  if participant_count = 0 then
    raise exception 'Pick at least one participant' using errcode = '22023';
  end if;

  update public.expenses
  set payer_id = p_payer_id,
      amount = round(p_amount, 2),
      description = nullif(btrim(p_description), '')
  where id = p_expense_id;

  -- not found, or RLS hid it (not a member of this group)
  if not found then
    raise exception 'Expense not found' using errcode = 'P0002';
  end if;

  delete from public.expense_splits where expense_id = p_expense_id;

  -- same cent-exact equal split as create_expense
  total_cents := round(p_amount * 100);
  base_cents := total_cents / participant_count;
  remainder_cents := total_cents - base_cents * participant_count;

  for i in 1 .. participant_count loop
    insert into public.expense_splits (expense_id, member_id, amount)
    values (
      p_expense_id,
      participants[i],
      (base_cents + case when i <= remainder_cents then 1 else 0 end) / 100.0
    );
  end loop;
end;
$$;

-- delete_expense: remove the splits, then the expense.
create or replace function public.delete_expense(p_expense_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  delete from public.expense_splits where expense_id = p_expense_id;
  delete from public.expenses where id = p_expense_id;

  if not found then
    raise exception 'Expense not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.update_expense(uuid, uuid, numeric, text, uuid[]) from public, anon;
grant execute on function public.update_expense(uuid, uuid, numeric, text, uuid[]) to authenticated;
revoke execute on function public.delete_expense(uuid) from public, anon;
grant execute on function public.delete_expense(uuid) to authenticated;

commit;
