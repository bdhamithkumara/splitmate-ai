-- WhatsApp chat import: keep the original message date and skip duplicates.
-- Requires 20261004020000_create_expense.sql.

begin;

-- when the expense happened (chat message time), separate from created_at
alter table public.expenses
  add column if not exists spent_at timestamptz;
update public.expenses set spent_at = created_at where spent_at is null;
alter table public.expenses
  alter column spent_at set default now(),
  alter column spent_at set not null;

-- fingerprint of an imported chat message; importing the same chat twice
-- skips messages that were already imported
alter table public.expenses
  add column if not exists import_key text;
create unique index if not exists expenses_group_id_import_key_key
  on public.expenses (group_id, import_key)
  where import_key is not null;

create index if not exists expenses_group_id_spent_at_idx
  on public.expenses (group_id, spent_at desc);

-- New signature with optional spent_at / import_key. Returns null when the
-- import_key already exists (duplicate skipped).
drop function if exists public.create_expense(uuid, uuid, numeric, text, text, text, uuid[]);

create or replace function public.create_expense(
  p_group_id uuid,
  p_payer_id uuid,
  p_amount numeric,
  p_currency text,
  p_description text,
  p_raw_text text,
  p_participant_ids uuid[],
  p_spent_at timestamptz default null,
  p_import_key text default null
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

  if p_spent_at is not null and p_spent_at > now() + interval '1 day' then
    raise exception 'Expense date is in the future' using errcode = '22023';
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
    (group_id, payer_id, amount, currency, description, raw_text, spent_at, import_key)
  values (
    p_group_id,
    p_payer_id,
    round(p_amount, 2),
    p_currency,
    nullif(btrim(p_description), ''),
    nullif(btrim(p_raw_text), ''),
    coalesce(p_spent_at, now()),
    p_import_key
  )
  on conflict (group_id, import_key) where import_key is not null do nothing
  returning id into new_expense_id;

  if new_expense_id is null then
    return null; -- already imported
  end if;

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

revoke execute on function public.create_expense(uuid, uuid, numeric, text, text, text, uuid[], timestamptz, text) from public, anon;
grant execute on function public.create_expense(uuid, uuid, numeric, text, text, text, uuid[], timestamptz, text) to authenticated;

commit;
