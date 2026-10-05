-- Base tables. The original project created these in the Supabase dashboard;
-- this migration lets a fresh project start from scratch. Everything is
-- "if not exists", so running it on an existing database changes nothing.
-- Access policies are added by the migrations that follow.

begin;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  payer_id uuid not null references public.members (id),
  amount numeric not null,
  currency text not null default 'LKR',
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  member_id uuid not null references public.members (id),
  amount numeric not null
);

create index if not exists members_user_id_idx on public.members (user_id);
create index if not exists expense_splits_expense_id_idx on public.expense_splits (expense_id);

alter table public.groups enable row level security;
alter table public.members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;

commit;
