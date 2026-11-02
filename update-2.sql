-- =====================================================================
--  حساب شخصی سعید — به‌روزرسانی ۲
--  جدول‌های «تراکنش‌های تکراری» و «چک‌ها»
--  یک بار در Supabase → SQL Editor اجرا کنید (اجرای دوباره هم ضرری ندارد).
-- =====================================================================

-- ---------- تراکنش‌های تکراری ----------
create table if not exists public.recurring (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind          text not null check (kind in ('income','expense','transfer')),
  amount        bigint not null check (amount > 0),
  account_id    bigint not null references public.accounts(id) on delete cascade,
  to_account_id bigint references public.accounts(id) on delete cascade,
  category_id   bigint references public.categories(id) on delete set null,
  note          text check (note is null or length(note) <= 300),
  every_months  int  not null default 1 check (every_months between 1 and 12),
  day_of_month  int  not null check (day_of_month between 1 and 31),   -- روز ماه شمسی
  next_date     date not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------- چک‌ها ----------
create table if not exists public.cheques (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  direction  text not null check (direction in ('received','issued')),  -- received = دریافتی، issued = پرداختی (صادره)
  person     text not null check (length(person) between 1 and 80),
  amount     bigint not null check (amount > 0),
  due_date   date not null,
  serial     text check (serial is null or length(serial) <= 40),
  bank       text check (bank is null or length(bank) <= 60),
  account_id bigint references public.accounts(id) on delete set null,
  status     text not null default 'pending' check (status in ('pending','cleared','bounced','cancelled')),
  cleared_date date,
  tx_id      bigint references public.transactions(id) on delete set null,
  note       text check (note is null or length(note) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists cheques_user_due_idx on public.cheques (user_id, due_date);

-- ---------- امنیت ----------
alter table public.recurring enable row level security;
alter table public.cheques   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['recurring','cheques'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

revoke all on public.recurring, public.cheques from anon;
grant select, insert, update, delete on public.recurring, public.cheques to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- اتصال فقط به حساب و دسته‌های خود کاربر
create or replace function public.check_ref_ownership() returns trigger
language plpgsql security invoker as $$
declare j jsonb := to_jsonb(new);
begin
  if j->>'account_id' is not null and not exists
     (select 1 from public.accounts where id = (j->>'account_id')::bigint and user_id = new.user_id) then
    raise exception 'invalid account';
  end if;
  if j->>'to_account_id' is not null and not exists
     (select 1 from public.accounts where id = (j->>'to_account_id')::bigint and user_id = new.user_id) then
    raise exception 'invalid target account';
  end if;
  if j->>'category_id' is not null and not exists
     (select 1 from public.categories where id = (j->>'category_id')::bigint and user_id = new.user_id) then
    raise exception 'invalid category';
  end if;
  if j->>'tx_id' is not null and not exists
     (select 1 from public.transactions where id = (j->>'tx_id')::bigint and user_id = new.user_id) then
    raise exception 'invalid transaction';
  end if;
  return new;
end $$;

drop trigger if exists rec_ownership on public.recurring;
create trigger rec_ownership before insert or update on public.recurring
  for each row execute function public.check_ref_ownership();
drop trigger if exists chq_ownership on public.cheques;
create trigger chq_ownership before insert or update on public.cheques
  for each row execute function public.check_ref_ownership();
