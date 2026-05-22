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

create or replace function public.record_gymassist_payment(
  p_gym_owner_id text,
  p_member_table text,
  p_payment_table text,
  p_member_record_id text,
  p_transaction_id text,
  p_amount numeric,
  p_payment_date date,
  p_member_upi_id text,
  p_owner_upi_id text default null,
  p_bill_url text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  member_row record;
  actual_member_id text;
  previous_paid numeric;
  total_fee numeric;
  previous_due numeric;
  new_paid numeric;
  remaining_due numeric;
  new_status text;
  payment_table_name text;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;

  if p_transaction_id is null or p_transaction_id !~ '^[A-Za-z0-9][A-Za-z0-9._/-]{2,63}$' then
    raise exception 'Invalid transaction ID.';
  end if;

  if p_member_table is null or p_member_table = '' then
    raise exception 'Missing member table.';
  end if;

  payment_table_name := public.ensure_gymassist_payment_table(coalesce(nullif(p_gym_owner_id, ''), 'owner'));
  if p_payment_table is not null and p_payment_table <> payment_table_name then
    perform public.ensure_gymassist_payment_table(replace(p_payment_table, '_payments', ''));
    payment_table_name := p_payment_table;
  end if;

  execute format('alter table %I add column if not exists member_id text', p_member_table);
  execute format('alter table %I add column if not exists total_fee numeric', p_member_table);
  execute format('alter table %I add column if not exists amount_paid numeric', p_member_table);
  execute format('alter table %I add column if not exists pending_dues numeric', p_member_table);
  execute format('alter table %I add column if not exists payment_status text', p_member_table);
  execute format('alter table %I add column if not exists "amount paid" numeric', p_member_table);

  execute format(
    'select
       name,
       coalesce(nullif(member_id, ''''), ''N/A'') as member_id,
       coalesce(total_fee, fee, 0)::numeric as total_fee,
       coalesce(amount_paid, "amount paid", 0)::numeric as previous_paid,
       coalesce(
         pending_dues,
         greatest(coalesce(total_fee, fee, 0)::numeric - coalesce(amount_paid, "amount paid", 0)::numeric, 0)
       )::numeric as previous_due
     from %I
     where name = $1
     for update',
    p_member_table
  )
  into member_row
  using p_member_record_id;

  if member_row.name is null then
    raise exception 'Member not found.';
  end if;

  actual_member_id := coalesce(nullif(member_row.member_id, ''), 'N/A');
  total_fee := coalesce(member_row.total_fee, 0);
  previous_paid := coalesce(member_row.previous_paid, 0);
  previous_due := greatest(coalesce(member_row.previous_due, total_fee - previous_paid), 0);

  if p_amount > previous_due then
    raise exception 'Payment amount cannot be greater than remaining dues.';
  end if;

  new_paid := previous_paid + p_amount;
  remaining_due := greatest(total_fee - new_paid, 0);
  new_status := case
    when total_fee > 0 and remaining_due = 0 then 'Fully Paid'
    when new_paid > 0 then 'Partially Paid'
    else 'Pending'
  end;

  execute format(
    'update %I
     set total_fee = $1,
         fee = $1,
         amount_paid = $2,
         "amount paid" = $2,
         pending_dues = $3,
         payment_status = $4,
         status = ''Active''
     where name = $5',
    p_member_table
  )
  using total_fee, new_paid, remaining_due, new_status, p_member_record_id;

  execute format(
    'insert into %I (
       transaction_id,
       member_id,
       amount_paid,
       previous_due,
       remaining_due,
       payment_date,
       notes,
       member_record_id,
       member_name,
       payment_status,
       member_upi_id,
       owner_upi_id,
       bill_url
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)',
    payment_table_name
  )
  using
    p_transaction_id,
    actual_member_id,
    p_amount::text,
    previous_due::text,
    remaining_due::text,
    p_payment_date::text,
    p_notes,
    p_member_record_id,
    member_row.name,
    new_status,
    p_member_upi_id,
    p_owner_upi_id,
    p_bill_url;

  return jsonb_build_object(
    'payment', jsonb_build_object(
      'transaction_id', p_transaction_id,
      'member_id', actual_member_id,
      'amount_paid', p_amount,
      'previous_due', previous_due,
      'remaining_due', remaining_due,
      'payment_date', p_payment_date,
      'payment_status', new_status,
      'notes', p_notes
    ),
    'financials', jsonb_build_object(
      'total_fee', total_fee,
      'amount_paid', new_paid,
      'pending_dues', remaining_due,
      'payment_status', new_status
    )
  );
end;
$$;

revoke all on function public.ensure_gymassist_payment_table(text) from public;
revoke all on function public.record_gymassist_payment(text, text, text, text, text, numeric, date, text, text, text, text) from public;
grant execute on function public.ensure_gymassist_payment_table(text) to service_role;
grant execute on function public.record_gymassist_payment(text, text, text, text, text, numeric, date, text, text, text, text) to service_role;

select pg_notify('pgrst', 'reload schema');
