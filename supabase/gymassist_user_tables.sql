create extension if not exists pgcrypto;

do $$
declare
  table_ref regclass;
  fk record;
begin
  foreach table_ref in array array[
    to_regclass('public.payments'),
    to_regclass('public.payment_history')
  ]
  loop
    if table_ref is not null then
      for fk in
        select c.conname
        from pg_constraint c
        join unnest(c.conkey) as cols(attnum) on true
        join pg_attribute a
          on a.attrelid = c.conrelid
         and a.attnum = cols.attnum
        where c.contype = 'f'
          and c.conrelid = table_ref
          and a.attname = 'member_id'
      loop
        execute format('alter table %s drop constraint if exists %I', table_ref, fk.conname);
      end loop;
    end if;
  end loop;
end;
$$;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  gym_owner_id text not null,
  member_id text not null,
  transaction_id text not null,
  amount numeric not null default 0,
  payment_date date not null,
  member_upi_id text not null,
  owner_upi_id text,
  bill_url text,
  payment_status text not null default 'PAID',
  created_at timestamptz not null default now()
);

create table if not exists public.payment_history (
  id uuid primary key default gen_random_uuid(),
  gym_owner_id text not null,
  member_id text not null,
  payment_id uuid,
  transaction_id text not null,
  amount numeric not null default 0,
  payment_date date not null,
  bill_url text,
  created_at timestamptz not null default now()
);

alter table public.payments add column if not exists gym_owner_id text;
alter table public.payments add column if not exists member_id text;
alter table public.payments add column if not exists transaction_id text;
alter table public.payments add column if not exists amount numeric default 0;
alter table public.payments add column if not exists payment_date date;
alter table public.payments add column if not exists member_upi_id text;
alter table public.payments add column if not exists owner_upi_id text;
alter table public.payments add column if not exists bill_url text;
alter table public.payments add column if not exists payment_status text default 'PAID';
alter table public.payments add column if not exists created_at timestamptz default now();

alter table public.payment_history add column if not exists gym_owner_id text;
alter table public.payment_history add column if not exists member_id text;
alter table public.payment_history add column if not exists payment_id uuid;
alter table public.payment_history add column if not exists transaction_id text;
alter table public.payment_history add column if not exists amount numeric default 0;
alter table public.payment_history add column if not exists payment_date date;
alter table public.payment_history add column if not exists bill_url text;
alter table public.payment_history add column if not exists created_at timestamptz default now();

alter table public.payments alter column member_id type text using member_id::text;
alter table public.payment_history alter column member_id type text using member_id::text;

create index if not exists idx_gymassist_payments_owner on public.payments (gym_owner_id);
create index if not exists idx_gymassist_payment_history_owner_date on public.payment_history (gym_owner_id, payment_date desc);

alter table public.payments enable row level security;
alter table public.payment_history enable row level security;
revoke all on table public.payments, public.payment_history from anon, authenticated;
grant all on table public.payments, public.payment_history to service_role;

create or replace function public.gymassist_member_table_name(owner_username text)
returns text
language plpgsql
immutable
as $$
declare
  raw_owner text;
  raw_slug text;
  safe_slug text;
  exact_name text;
begin
  raw_owner := coalesce(nullif(trim(owner_username), ''), 'owner');
  exact_name := 'GYM AI_' || raw_owner;

  if length(exact_name) <= 63 then
    return exact_name;
  end if;

  raw_slug := lower(regexp_replace(raw_owner, '[^a-zA-Z0-9]+', '_', 'g'));
  safe_slug := regexp_replace(raw_slug, '^_+|_+$', '', 'g');

  if safe_slug = '' then
    safe_slug := 'owner';
  end if;

  if length('GYM AI_' || safe_slug) > 63 then
    safe_slug := left(safe_slug, 47) || '_' || left(md5(owner_username), 8);
  end if;

  return 'GYM AI_' || safe_slug;
end;
$$;

create or replace function public.ensure_gymassist_member_table(owner_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_table text;
  pk_constraint text;
  end_date_index text;
  status_index text;
  primary_key_count integer;
  existing_relation_kind "char";
  backup_relation_name text;
begin
  target_table := public.gymassist_member_table_name(owner_username);
  pk_constraint := 'pk_gymassist_' || left(md5(target_table), 18);
  end_date_index := 'idx_gymassist_' || left(md5(target_table || '_end_date'), 16);
  status_index := 'idx_gymassist_' || left(md5(target_table || '_status'), 16);

  select c.relkind
  into existing_relation_kind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = target_table;

  if existing_relation_kind in ('v', 'm') then
    backup_relation_name := left(target_table || '_view_backup_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS'), 63);

    if existing_relation_kind = 'v' then
      execute format('alter view %I.%I rename to %I', 'public', target_table, backup_relation_name);
    else
      execute format('alter materialized view %I.%I rename to %I', 'public', target_table, backup_relation_name);
    end if;
  elsif existing_relation_kind is not null and existing_relation_kind not in ('r', 'p') then
    raise exception 'Cannot create member table %. Existing relation has unsupported type %.', target_table, existing_relation_kind;
  end if;

  execute format(
    'create table if not exists %I (
      name text not null,
      phone text not null,
      "plan type" text null,
      "start date" date null,
      "end date" date null,
      status text null,
      email text null,
      "upi id" text null,
      fee numeric null,
      amount_paid numeric null,
      pending_dues numeric null,
      payment_status text null,
      "amount paid" numeric null,
      member_id text null,
      total_fee numeric null,
      recurring_fee numeric null,
      renewal_count integer not null default 0,
      last_renewal_date date null,
      last_renewal_plan text null,
      current_period_start date null,
      constraint %I primary key (name)
    ) TABLESPACE pg_default',
    target_table,
    pk_constraint
  );

  execute format('alter table %I add column if not exists name text', target_table);
  execute format('alter table %I add column if not exists phone text', target_table);
  execute format('alter table %I add column if not exists "plan type" text', target_table);
  execute format('alter table %I add column if not exists "start date" date', target_table);
  execute format('alter table %I add column if not exists "end date" date', target_table);
  execute format('alter table %I add column if not exists email text', target_table);
  execute format('alter table %I add column if not exists "upi id" text', target_table);
  execute format('alter table %I add column if not exists fee numeric', target_table);
  execute format('alter table %I add column if not exists amount_paid numeric', target_table);
  execute format('alter table %I add column if not exists pending_dues numeric', target_table);
  execute format('alter table %I add column if not exists payment_status text', target_table);
  execute format('alter table %I add column if not exists "amount paid" numeric', target_table);
  execute format('alter table %I add column if not exists member_id text', target_table);
  execute format('alter table %I add column if not exists total_fee numeric', target_table);
  execute format('alter table %I add column if not exists recurring_fee numeric', target_table);
  execute format('alter table %I add column if not exists renewal_count integer not null default 0', target_table);
  execute format('alter table %I add column if not exists last_renewal_date date', target_table);
  execute format('alter table %I add column if not exists last_renewal_plan text', target_table);
  execute format('alter table %I add column if not exists current_period_start date', target_table);
  execute format('alter table %I add column if not exists status text', target_table);

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = target_table and column_name = 'member_name'
  ) then
    execute format('update %I set name = member_name where name is null and member_name is not null', target_table);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = target_table and column_name = 'member_id'
  ) then
    execute format('update %I set name = member_id where name is null and member_id is not null', target_table);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = target_table and column_name = 'id'
  ) then
    execute format('update %I set name = id::text where name is null', target_table);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = target_table and column_name = 'membership_plan'
  ) then
    execute format('update %I set "plan type" = membership_plan where "plan type" is null', target_table);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = target_table and column_name = 'membership_start'
  ) then
    execute format('update %I set "start date" = membership_start where "start date" is null', target_table);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = target_table and column_name = 'membership_end'
  ) then
    execute format('update %I set "end date" = membership_end where "end date" is null', target_table);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = target_table and column_name = 'amuont_paid'
  ) then
    execute format('update %I set "amount paid" = amuont_paid where "amount paid" is null', target_table);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = target_table and column_name = 'amuont paid'
  ) then
    execute format('update %I set "amount paid" = "amuont paid" where "amount paid" is null', target_table);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = target_table and column_name = 'member_upi_id'
  ) then
    execute format('update %I set "upi id" = member_upi_id where "upi id" is null', target_table);
  end if;

  execute format('update %I set total_fee = fee where total_fee is null and fee is not null', target_table);
  execute format('update %I set amount_paid = "amount paid" where amount_paid is null and "amount paid" is not null', target_table);
  execute format('update %I set "amount paid" = amount_paid where "amount paid" is null and amount_paid is not null', target_table);
  execute format('update %I set pending_dues = greatest(coalesce(total_fee, fee, 0) - coalesce(amount_paid, "amount paid", 0), 0) where pending_dues is null', target_table);
  execute format(
    'update %I set payment_status = case
       when coalesce(total_fee, fee, 0) > 0 and coalesce(pending_dues, 0) = 0 then ''Fully Paid''
       when coalesce(amount_paid, "amount paid", 0) > 0 then ''Partially Paid''
       else ''Pending''
     end
     where payment_status is null',
    target_table
  );

  execute format('update %I set name = ''member_'' || regexp_replace(ctid::text, ''[^0-9]+'', ''_'', ''g'') where name is null', target_table);
  execute format('update %I set phone = '''' where phone is null', target_table);
  execute format('alter table %I alter column name set not null', target_table);
  execute format('alter table %I alter column phone set not null', target_table);

  select count(*)
  into primary_key_count
  from information_schema.table_constraints
  where table_schema = 'public'
    and table_name = target_table
    and constraint_type = 'PRIMARY KEY';

  if primary_key_count = 0 then
    execute format('alter table %I add constraint %I primary key (name)', target_table, pk_constraint);
  end if;

  execute format('create index if not exists %I on %I ("end date")', end_date_index, target_table);
  execute format('create index if not exists %I on %I (status)', status_index, target_table);
  execute format(
    'create unique index if not exists %I on %I (member_id) where member_id is not null and trim(member_id) <> ''''',
    'idx_gymassist_' || left(md5(target_table || '_member_id_unique'), 16),
    target_table
  );
  execute format('alter table %I enable row level security', target_table);
  execute format('revoke all on table %I from anon, authenticated', target_table);
  execute format('grant all on table %I to service_role', target_table);

  notify pgrst, 'reload schema';
  return target_table;
end;
$$;

revoke all on function public.ensure_gymassist_member_table(text) from public;
grant execute on function public.ensure_gymassist_member_table(text) to service_role;

do $$
declare
  account record;
  old_table text;
  new_table text;
  old_relation_kind "char";
  new_relation_kind "char";
  backup_relation_name text;
begin
  if to_regclass('public.users') is not null then
    for account in
      select username, email
      from public.users
      where nullif(trim(username), '') is not null
        and nullif(trim(email), '') is not null
    loop
      old_table := public.gymassist_member_table_name(account.email);
      new_table := public.gymassist_member_table_name(account.username);

      select c.relkind
      into new_relation_kind
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = new_table;

      if new_relation_kind in ('v', 'm') then
        backup_relation_name := left(new_table || '_view_backup_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS'), 63);

        if new_relation_kind = 'v' then
          execute format('alter view %I.%I rename to %I', 'public', new_table, backup_relation_name);
        else
          execute format('alter materialized view %I.%I rename to %I', 'public', new_table, backup_relation_name);
        end if;
      end if;

      select c.relkind
      into old_relation_kind
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = old_table;

      if old_table <> new_table
        and to_regclass(format('%I.%I', 'public', old_table)) is not null
        and to_regclass(format('%I.%I', 'public', new_table)) is null
        and old_relation_kind in ('r', 'p')
      then
        execute format('alter table %I.%I rename to %I', 'public', old_table, new_table);
      end if;

      perform public.ensure_gymassist_member_table(account.username);
    end loop;
  end if;
end;
$$;
