-- Save an expense and its equal splits in one transaction.
-- Requires 20261004000000 (RLS helpers) and 20261004010000 (raw_text).

begin;

alter table public.expenses
  add column if not exists created_by uuid
  references auth.users (id) on delete set null
  default auth.uid();

-- SECURITY INVOKER (the default): runs as the signed-in user, so the existing
-- RLS insert policies still decide what's allowed — membership, payer in the
-- group, split members in the group.
create or replace function public.create_expense(
  p_group_id uuid,
  p_payer_id uuid,
  p_amount numeric,
  p_currency text,
  p_description text,
  p_raw_text text,
  p_participant_ids uuid[]
)
returns uuid
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
  new_expense_id uuid;
  i int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount > 100000000 then
    raise exception 'Amount must be between 0 and 100,000,000' using errcode = '22023';
  end if;

  if p_currency !~ '^[A-Z]{3}$' then
    raise exception 'Currency must be a 3-letter code' using errcode = '22023';
  end if;

  -- de-duplicate, keeping the caller's order
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

  insert into public.expenses
    (group_id, payer_id, amount, currency, description, raw_text)
  values (
    p_group_id,
    p_payer_id,
    round(p_amount, 2),
    p_currency,
    nullif(btrim(p_description), ''),
    nullif(btrim(p_raw_text), '')
  )
  returning id into new_expense_id;

  -- Equal split in cents; the first `remainder` people pay one cent more so
  -- the shares always add up exactly (1000 / 3 = 333.34 + 333.33 + 333.33).
  total_cents := round(p_amount * 100);
  base_cents := total_cents / participant_count;
  remainder_cents := total_cents - base_cents * participant_count;

  for i in 1 .. participant_count loop
    insert into public.expense_splits (expense_id, member_id, amount)
    values (
      new_expense_id,
      participants[i],
      (base_cents + case when i <= remainder_cents then 1 else 0 end) / 100.0
    );
  end loop;

  return new_expense_id;
end;
$$;

revoke execute on function public.create_expense(uuid, uuid, numeric, text, text, text, uuid[]) from public, anon;
grant execute on function public.create_expense(uuid, uuid, numeric, text, text, text, uuid[]) to authenticated;

commit;
