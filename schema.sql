-- =====================================================================
--  حسابداری شخصی — ساختار دیتابیس Supabase
--  این فایل را یک بار در Supabase → SQL Editor اجرا کنید.
--  امنیت: Row Level Security روی همه جدول‌ها فعال است؛ هر کاربر فقط
--  ردیف‌های خودش را می‌بیند و تغییر می‌دهد.
-- =====================================================================

-- ---------- حساب‌ها / کیف پول‌ها ----------
create table if not exists public.accounts (
  id              bigint generated always as identity primary key,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name            text not null check (length(name) between 1 and 60),
  kind            text not null default 'bank' check (kind in ('cash','bank','card','wallet','other')),
  opening_balance bigint not null default 0,
  archived        boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ---------- دسته‌بندی‌ها ----------
create table if not exists public.categories (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (length(name) between 1 and 40),
  kind       text not null check (kind in ('income','expense')),
  color      text not null default '#64748b',
  created_at timestamptz not null default now()
);

-- ---------- بدهی و طلب ----------
create table if not exists public.debts (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person       text not null check (length(person) between 1 and 80),
  direction    text not null check (direction in ('borrow','lend')),  -- borrow = بدهی من، lend = طلب من
  total_amount bigint not null check (total_amount > 0),
  start_date   date not null default current_date,
  note         text,
  settled      boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------- اقساط ----------
create table if not exists public.installments (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  debt_id    bigint not null references public.debts(id) on delete cascade,
  due_date   date not null,
  amount     bigint not null check (amount > 0),
  paid       boolean not null default false,
  paid_date  date,
  created_at timestamptz not null default now()
);

-- ---------- تراکنش‌ها ----------
create table if not exists public.transactions (
  id             bigint generated always as identity primary key,
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind           text not null check (kind in ('income','expense','transfer')),
  amount         bigint not null check (amount > 0),
  account_id     bigint not null references public.accounts(id) on delete restrict,
  to_account_id  bigint references public.accounts(id) on delete restrict,
  category_id    bigint references public.categories(id) on delete set null,
  installment_id bigint references public.installments(id) on delete set null,
  tx_date        date not null default current_date,
  note           text check (note is null or length(note) <= 300),
  created_at     timestamptz not null default now(),
  constraint transfer_needs_target check (
    (kind = 'transfer' and to_account_id is not null and to_account_id <> account_id)
    or (kind <> 'transfer' and to_account_id is null)
  )
);

create index if not exists tx_user_date_idx on public.transactions (user_id, tx_date desc);
create index if not exists inst_user_due_idx on public.installments (user_id, due_date);

-- ---------- امنیت: Row Level Security ----------
alter table public.accounts     enable row level security;
alter table public.categories   enable row level security;
alter table public.debts        enable row level security;
alter table public.installments enable row level security;
alter table public.transactions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['accounts','categories','debts','installments','transactions'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- کاربر ناشناس (بدون ورود) هیچ دسترسی‌ای ندارد
revoke all on public.accounts, public.categories, public.debts,
              public.installments, public.transactions from anon;

-- جلوگیری از اینکه کسی تراکنش را به حساب/دسته کاربر دیگری وصل کند
create or replace function public.check_tx_ownership() returns trigger
language plpgsql security invoker as $$
begin
  if not exists (select 1 from public.accounts where id = new.account_id and user_id = new.user_id) then
    raise exception 'invalid account';
  end if;
  if new.to_account_id is not null and not exists
     (select 1 from public.accounts where id = new.to_account_id and user_id = new.user_id) then
    raise exception 'invalid target account';
  end if;
  if new.category_id is not null and not exists
     (select 1 from public.categories where id = new.category_id and user_id = new.user_id) then
    raise exception 'invalid category';
  end if;
  return new;
end $$;

drop trigger if exists tx_ownership on public.transactions;
create trigger tx_ownership before insert or update on public.transactions
  for each row execute function public.check_tx_ownership();

create or replace function public.check_inst_ownership() returns trigger
language plpgsql security invoker as $$
begin
  if not exists (select 1 from public.debts where id = new.debt_id and user_id = new.user_id) then
    raise exception 'invalid debt';
  end if;
  return new;
end $$;

drop trigger if exists inst_ownership on public.installments;
create trigger inst_ownership before insert or update on public.installments
  for each row execute function public.check_inst_ownership();

-- ---------- ویو مانده حساب‌ها (با رعایت RLS) ----------
create or replace view public.account_balances with (security_invoker = true) as
select a.id, a.name, a.kind, a.archived, a.opening_balance,
       a.opening_balance
       + coalesce(sum(case when t.kind = 'income'   and t.account_id    = a.id then t.amount end), 0)
       - coalesce(sum(case when t.kind = 'expense'  and t.account_id    = a.id then t.amount end), 0)
       - coalesce(sum(case when t.kind = 'transfer' and t.account_id    = a.id then t.amount end), 0)
       + coalesce(sum(case when t.kind = 'transfer' and t.to_account_id = a.id then t.amount end), 0)
       as balance
from public.accounts a
left join public.transactions t on t.account_id = a.id or t.to_account_id = a.id
group by a.id;

revoke all on public.account_balances from anon;
grant select on public.account_balances to authenticated;
