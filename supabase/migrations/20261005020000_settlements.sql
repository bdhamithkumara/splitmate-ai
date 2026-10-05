-- Settle up: record "Hasaru paid Kasun back 1,250".
-- Stored as an expense of kind 'settlement' paid by Hasaru and shared only by
-- Kasun, which cancels exactly that much debt — balances, RLS and delete keep
-- working unchanged. Requires 20261005000000_edit_delete_expenses.sql.

begin;

alter table public.expenses
  add column if not exists kind text not null default 'expense';

alter table public.expenses
  drop constraint if exists expenses_kind_check;
alter table public.expenses
  add constraint expenses_kind_check check (kind in ('expense', 'settlement'));

-- SECURITY INVOKER: the existing insert policies check that the user, the
-- payer (from) and the receiver (to) all belong to the group.
create or replace function public.record_settlement(
  p_group_id uuid,
  p_from_member_id uuid,
  p_to_member_id uuid,
  p_amount numeric,
  p_currency text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_expense_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_from_member_id is null or p_to_member_id is null
     or p_from_member_id = p_to_member_id then
    raise exception 'Pick two different people' using errcode = '22023';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount > 100000000 then
    raise exception 'Amount must be between 0 and 100,000,000' using errcode = '22023';
  end if;

  if p_currency !~ '^[A-Z]{3}$' then
    raise exception 'Currency must be a 3-letter code' using errcode = '22023';
  end if;

  insert into public.expenses (group_id, payer_id, amount, currency, kind)
  values (p_group_id, p_from_member_id, round(p_amount, 2), p_currency, 'settlement')
  returning id into new_expense_id;

  insert into public.expense_splits (expense_id, member_id, amount)
  values (new_expense_id, p_to_member_id, round(p_amount, 2));

  return new_expense_id;
end;
$$;

revoke execute on function public.record_settlement(uuid, uuid, uuid, numeric, text) from public, anon;
grant execute on function public.record_settlement(uuid, uuid, uuid, numeric, text) to authenticated;

commit;
