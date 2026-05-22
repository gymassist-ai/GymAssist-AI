create extension if not exists pgcrypto;

create or replace function public.gymassist_payment_table_name(owner_username text)
returns text
language plpgsql
immutable
as $$
declare
  raw_owner text;
  safe_owner text;
  exact_name text;
begin
  raw_owner := coalesce(nullif(trim(owner_username), ''), 'owner');
  exact_name := raw_owner || '_payments';

  if length(exact_name) <= 63 then
    return exact_name;
  end if;

  safe_owner := lower(regexp_replace(raw_owner, '[^a-zA-Z0-9_]+', '_', 'g'));
  safe_owner := regexp_replace(safe_owner, '^_+|_+$', '', 'g');

  if safe_owner = '' then
    safe_owner := 'owner';
  end if;

  return left(safe_owner, 45) || '_' || left(md5(raw_owner), 8) || '_payments';
end;
$$;

create or replace function public.ensure_gymassist_payment_table(owner_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_table text;
  pk_constraint text;
begin
  target_table := public.gymassist_payment_table_name(owner_username);
  pk_constraint := left(regexp_replace(target_table, '[^a-zA-Z0-9_]+', '_', 'g') || '_pkey', 63);

  execute format(
    'create table if not exists %I (
      transaction_id text not null,
      member_id text not null,
      amount_paid text null,
      previous_due text null,
      remaining_due text null,
      payment_date text null,
      notes text null,
      member_record_id text null,
      member_name text null,
      payment_status text null,
      member_upi_id text null,
      owner_upi_id text null,
      bill_url text null,
      payment_type text null,
      renewal_plan text null,
      renewal_months integer null,
      renewal_fee numeric null,
      previous_membership_end date null,
      renewal_start_date date null,
      new_membership_end date null,
      total_fee_after numeric null,
      amount_paid_after numeric null,
      pending_dues_after numeric null,
      created_at timestamp with time zone not null default now(),
      constraint %I primary key (transaction_id)
    ) TABLESPACE pg_default',
    target_table,
    pk_constraint
  );

  execute format('alter table %I add column if not exists transaction_id text', target_table);
  execute format('alter table %I add column if not exists member_id text not null default ''N/A''', target_table);
  execute format('alter table %I add column if not exists amount_paid text', target_table);
  execute format('alter table %I add column if not exists previous_due text', target_table);
  execute format('alter table %I add column if not exists remaining_due text', target_table);
  execute format('alter table %I add column if not exists payment_date text', target_table);
  execute format('alter table %I add column if not exists notes text', target_table);
  execute format('alter table %I add column if not exists member_record_id text', target_table);
  execute format('alter table %I add column if not exists member_name text', target_table);
  execute format('alter table %I add column if not exists payment_status text', target_table);
  execute format('alter table %I add column if not exists member_upi_id text', target_table);
  execute format('alter table %I add column if not exists owner_upi_id text', target_table);
  execute format('alter table %I add column if not exists bill_url text', target_table);
  execute format('alter table %I add column if not exists payment_type text', target_table);
  execute format('alter table %I add column if not exists renewal_plan text', target_table);
  execute format('alter table %I add column if not exists renewal_months integer', target_table);
  execute format('alter table %I add column if not exists renewal_fee numeric', target_table);
  execute format('alter table %I add column if not exists previous_membership_end date', target_table);
  execute format('alter table %I add column if not exists renewal_start_date date', target_table);
  execute format('alter table %I add column if not exists new_membership_end date', target_table);
  execute format('alter table %I add column if not exists total_fee_after numeric', target_table);
  execute format('alter table %I add column if not exists amount_paid_after numeric', target_table);
  execute format('alter table %I add column if not exists pending_dues_after numeric', target_table);
  execute format('alter table %I add column if not exists created_at timestamp with time zone not null default now()', target_table);

  execute format('alter table %I enable row level security', target_table);
  execute format('revoke all on table %I from anon, authenticated', target_table);
  execute format('grant all on table %I to service_role', target_table);

  notify pgrst, 'reload schema';

  return target_table;
end;
$$;

revoke all on function public.ensure_gymassist_payment_table(text) from public;
grant execute on function public.ensure_gymassist_payment_table(text) to service_role;

select public.ensure_gymassist_payment_table('jayz');
select to_regclass('public.jayz_payments') as created_payment_table;
select pg_notify('pgrst', 'reload schema');
