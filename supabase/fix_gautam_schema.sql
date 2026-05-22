begin;

alter table public."GYM AI_gautam"
  add column if not exists member_id text,
  add column if not exists total_fee numeric,
  add column if not exists amount_paid numeric,
  add column if not exists pending_dues numeric,
  add column if not exists payment_status text,
  add column if not exists "amount paid" numeric;

alter table public."GYM AI_gautam"
  drop constraint if exists "GYM AI_gautam_pkey";

alter table public."GYM AI_gautam"
  alter column member_id drop not null;

alter table public."GYM AI_gautam"
  alter column pending_dues type numeric
  using nullif(regexp_replace(coalesce(pending_dues::text, ''), '[^0-9.-]', '', 'g'), '')::numeric;

create unique index if not exists idx_gym_ai_gautam_member_id_unique
  on public."GYM AI_gautam" (member_id)
  where member_id is not null and trim(member_id) <> '';

update public."GYM AI_gautam"
set
  total_fee = coalesce(total_fee, fee, 0),
  amount_paid = coalesce(amount_paid, "amount paid", 0),
  "amount paid" = coalesce("amount paid", amount_paid, 0);

update public."GYM AI_gautam"
set pending_dues = greatest(coalesce(total_fee, fee, 0) - coalesce(amount_paid, "amount paid", 0), 0)
where pending_dues is null;

update public."GYM AI_gautam"
set payment_status = case
  when coalesce(total_fee, fee, 0) > 0 and coalesce(pending_dues, 0) = 0 then 'Fully Paid'
  when coalesce(amount_paid, "amount paid", 0) > 0 then 'Partially Paid'
  else 'Pending'
end
where payment_status is null;

create table if not exists public.gautam_payments (
  transaction_id text not null,
  member_id text not null default 'N/A',
  amount_paid text null,
  previous_due text null,
  remaining_due text null,
  payment_date text null,
  notes text null,
  constraint gautam_payments_pkey primary key (transaction_id)
) TABLESPACE pg_default;

alter table public.gautam_payments
  add column if not exists transaction_id text,
  add column if not exists member_id text default 'N/A',
  add column if not exists amount_paid text,
  add column if not exists previous_due text,
  add column if not exists remaining_due text,
  add column if not exists payment_date text,
  add column if not exists notes text,
  add column if not exists member_record_id text,
  add column if not exists member_name text,
  add column if not exists payment_status text,
  add column if not exists member_upi_id text,
  add column if not exists owner_upi_id text,
  add column if not exists bill_url text,
  add column if not exists created_at timestamptz not null default now();

alter table public.gautam_payments
  alter column member_id set default 'N/A';

alter table public.gautam_payments enable row level security;
revoke all on table public.gautam_payments from anon, authenticated;
grant all on table public.gautam_payments to service_role;

commit;

select pg_notify('pgrst', 'reload schema');
