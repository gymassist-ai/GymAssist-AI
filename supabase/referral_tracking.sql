-- Referral tracking for gym owner signup.
-- This stores referral codes only on the owner account table.

alter table public.users
  add column if not exists referral text;

create index if not exists users_referral_idx
on public.users (referral)
where referral is not null and trim(referral) <> '';

-- Cleanup in case an earlier referral migration was run against member tables.
do $$
declare
  member_table record;
begin
  for member_table in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname like 'GYM AI\_%' escape '\'
  loop
    execute format('alter table public.%I drop column if exists referral', member_table.relname);
  end loop;
end;
$$;

drop function if exists public.ensure_gymassist_member_referral_column(text);
drop index if exists public.gymassistai_users_referral_idx;
do $$
begin
  if to_regclass('public.gymassistai_users') is not null then
    alter table public.gymassistai_users drop column if exists referral;
  end if;
end;
$$;

select pg_notify('pgrst', 'reload schema');
