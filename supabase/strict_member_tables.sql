create or replace function public.gymassist_member_table_name(owner_username text)
returns text
language plpgsql
immutable
as $gymassist_member_table_name$
declare
  raw_owner text;
  safe_owner text;
  exact_name text;
begin
  raw_owner := coalesce(nullif(trim(owner_username), ''), 'owner');
  exact_name := 'GYM AI_' || raw_owner;

  if length(exact_name) <= 63 then
    return exact_name;
  end if;

  safe_owner := lower(regexp_replace(raw_owner, '[^a-zA-Z0-9]+', '_', 'g'));
  safe_owner := regexp_replace(safe_owner, '^_+|_+$', '', 'g');

  if safe_owner = '' then
    safe_owner := 'owner';
  end if;

  return 'GYM AI_' || left(safe_owner, 47) || '_' || left(md5(raw_owner), 8);
end;
$gymassist_member_table_name$;

create or replace function public.ensure_gymassist_member_table(owner_username text)
returns text
language plpgsql
security definer
set search_path = public
as $ensure_gymassist_member_table$
declare
  target_table text;
  pk_constraint text;
  end_date_index text;
  status_index text;
  member_id_index text;
begin
  target_table := public.gymassist_member_table_name(owner_username);
  pk_constraint := 'pk_gymassist_' || left(md5(target_table), 18);
  end_date_index := 'idx_gymassist_' || left(md5(target_table || '_end_date'), 16);
  status_index := 'idx_gymassist_' || left(md5(target_table || '_status'), 16);
  member_id_index := 'idx_gymassist_' || left(md5(target_table || '_member_id_unique'), 16);

  execute format(
    'create table if not exists public.%I (
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
    ) tablespace pg_default',
    target_table,
    pk_constraint
  );

  execute format('alter table public.%I add column if not exists name text', target_table);
  execute format('alter table public.%I add column if not exists phone text', target_table);
  execute format('alter table public.%I add column if not exists "plan type" text', target_table);
  execute format('alter table public.%I add column if not exists "start date" date', target_table);
  execute format('alter table public.%I add column if not exists "end date" date', target_table);
  execute format('alter table public.%I add column if not exists status text', target_table);
  execute format('alter table public.%I add column if not exists email text', target_table);
  execute format('alter table public.%I add column if not exists "upi id" text', target_table);
  execute format('alter table public.%I add column if not exists fee numeric', target_table);
  execute format('alter table public.%I add column if not exists amount_paid numeric', target_table);
  execute format('alter table public.%I add column if not exists pending_dues numeric', target_table);
  execute format('alter table public.%I add column if not exists payment_status text', target_table);
  execute format('alter table public.%I add column if not exists "amount paid" numeric', target_table);
  execute format('alter table public.%I add column if not exists member_id text', target_table);
  execute format('alter table public.%I add column if not exists total_fee numeric', target_table);
  execute format('alter table public.%I add column if not exists recurring_fee numeric', target_table);
  execute format('alter table public.%I add column if not exists renewal_count integer not null default 0', target_table);
  execute format('alter table public.%I add column if not exists last_renewal_date date', target_table);
  execute format('alter table public.%I add column if not exists last_renewal_plan text', target_table);
  execute format('alter table public.%I add column if not exists current_period_start date', target_table);

  execute format('update public.%I set total_fee = fee where total_fee is null and fee is not null', target_table);
  execute format('update public.%I set amount_paid = "amount paid" where amount_paid is null and "amount paid" is not null', target_table);
  execute format('update public.%I set "amount paid" = amount_paid where "amount paid" is null and amount_paid is not null', target_table);
  execute format('update public.%I set pending_dues = greatest(coalesce(total_fee, fee, 0) - coalesce(amount_paid, "amount paid", 0), 0) where pending_dues is null', target_table);
  execute format('update public.%I set payment_status = case when coalesce(total_fee, fee, 0) > 0 and coalesce(pending_dues, 0) = 0 then ''Fully Paid'' when coalesce(amount_paid, "amount paid", 0) > 0 then ''Partially Paid'' else ''Pending'' end where payment_status is null', target_table);

  execute format('alter table public.%I alter column name set not null', target_table);
  execute format('alter table public.%I alter column phone set not null', target_table);
  execute format('create index if not exists %I on public.%I ("end date")', end_date_index, target_table);
  execute format('create index if not exists %I on public.%I (status)', status_index, target_table);
  execute format('create unique index if not exists %I on public.%I (member_id) where member_id is not null and trim(member_id) <> ''''', member_id_index, target_table);
  execute format('alter table public.%I enable row level security', target_table);
  execute format('revoke all on table public.%I from anon, authenticated', target_table);
  execute format('grant all on table public.%I to service_role', target_table);

  perform pg_notify('pgrst', 'reload schema');
  return target_table;
end;
$ensure_gymassist_member_table$;

revoke all on function public.ensure_gymassist_member_table(text) from public;
grant execute on function public.ensure_gymassist_member_table(text) to service_role;
select pg_notify('pgrst', 'reload schema');
