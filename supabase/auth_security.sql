create extension if not exists pgcrypto;

create table if not exists public.users (
  username text not null,
  hashed_password text not null,
  upi_id text,
  created_at timestamptz default current_timestamp,
  referral text,
  email text,
  phone_no text,
  plan_type text,
  gym_name text,
  gst_number text,
  fee_1_month numeric default 0,
  fee_3_months numeric default 0,
  fee_6_months numeric default 0,
  fee_1_year numeric default 0,
  constraint users_pkey primary key (username),
  constraint users_email_key unique (email)
);

alter table public.users add column if not exists username text;
alter table public.users add column if not exists hashed_password text;
alter table public.users add column if not exists upi_id text;
alter table public.users add column if not exists created_at timestamptz default current_timestamp;
alter table public.users add column if not exists referral text;
alter table public.users add column if not exists email text;
alter table public.users add column if not exists phone_no text;
alter table public.users add column if not exists plan_type text;
alter table public.users add column if not exists gym_name text;
alter table public.users add column if not exists gst_number text;
alter table public.users add column if not exists fee_1_month numeric default 0;
alter table public.users add column if not exists fee_3_months numeric default 0;
alter table public.users add column if not exists fee_6_months numeric default 0;
alter table public.users add column if not exists fee_1_year numeric default 0;

do $$
begin
  if exists (
    select 1
    from public.users
    where email is not null
    group by lower(trim(email))
    having count(*) > 1
  ) then
    raise exception 'Duplicate user emails exist. Merge or delete duplicates before adding the unique email index.';
  end if;

  if exists (
    select 1
    from public.users
    where username is not null
    group by lower(trim(username))
    having count(*) > 1
  ) then
    raise exception 'Duplicate usernames exist. Merge or delete duplicates before adding the unique username index.';
  end if;
end;
$$;

create unique index if not exists users_email_unique_idx
on public.users (lower(trim(email)))
where email is not null;

create index if not exists users_created_at_idx
on public.users (created_at desc);

create index if not exists users_referral_idx
on public.users (referral)
where referral is not null and trim(referral) <> '';

alter table public.users enable row level security;
revoke all on table public.users from anon, authenticated;
grant all on table public.users to service_role;

create table if not exists public.gymassistai_users (
  username text primary key,
  "selectedPlan" text,
  "billingCycle" text,
  "paymentLink" text,
  trial_status text,
  auth_status text,
  upi_id text,
  gym_name text,
  gst_number text,
  fee_1_month numeric default 0,
  fee_3_months numeric default 0,
  fee_6_months numeric default 0,
  fee_1_year numeric default 0,
  subscription_status text default 'trialing',
  paid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gymassistai_users add column if not exists username text;
alter table public.gymassistai_users add column if not exists "selectedPlan" text;
alter table public.gymassistai_users add column if not exists "billingCycle" text;
alter table public.gymassistai_users add column if not exists "paymentLink" text;
alter table public.gymassistai_users add column if not exists trial_status text;
alter table public.gymassistai_users add column if not exists auth_status text;
alter table public.gymassistai_users add column if not exists upi_id text;
alter table public.gymassistai_users add column if not exists gym_name text;
alter table public.gymassistai_users add column if not exists gst_number text;
alter table public.gymassistai_users add column if not exists fee_1_month numeric default 0;
alter table public.gymassistai_users add column if not exists fee_3_months numeric default 0;
alter table public.gymassistai_users add column if not exists fee_6_months numeric default 0;
alter table public.gymassistai_users add column if not exists fee_1_year numeric default 0;
alter table public.gymassistai_users add column if not exists subscription_status text default 'trialing';
alter table public.gymassistai_users add column if not exists paid_until timestamptz;
alter table public.gymassistai_users add column if not exists created_at timestamptz not null default now();
alter table public.gymassistai_users add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from public.gymassistai_users
    where username is not null
    group by lower(trim(username))
    having count(*) > 1
  ) then
    raise exception 'Duplicate gymassistai_users usernames exist. Merge or delete duplicates before adding the unique username index.';
  end if;
end;
$$;

create unique index if not exists gymassistai_users_username_unique_idx
on public.gymassistai_users (lower(trim(username)))
where username is not null;

create unique index if not exists gymassistai_users_username_exact_unique_idx
on public.gymassistai_users (username);

alter table public.gymassistai_users enable row level security;
revoke all on table public.gymassistai_users from anon, authenticated;
grant all on table public.gymassistai_users to service_role;
