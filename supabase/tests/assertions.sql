-- =============================================================================
-- Offtexts — schema assertions
-- =============================================================================
-- Structural rules that must hold after every migration has been applied.
-- Each one raises, so replay.sh stops on the first violation.
--
-- These are not tests of behaviour — they are tests of the things that are
-- catastrophic when forgotten and invisible when they are. Every one of them
-- exists because the failure mode is silent: a table without RLS returns every
-- row to anyone holding the anon key, and looks perfectly healthy while it does
-- it.
-- =============================================================================

\echo '  checking every public table has RLS enabled and forced'
do $$
declare
  offenders text;
begin
  select string_agg(format('%s (enabled=%s forced=%s)', c.relname, c.relrowsecurity, c.relforcerowsecurity), ', ' order by c.relname)
    into offenders
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not (c.relrowsecurity and c.relforcerowsecurity);

  if offenders is not null then
    raise exception E'Tables without RLS enabled AND forced: %\n'
      '  The anon key ships in the app bundle. A table without RLS is public.', offenders;
  end if;
end;
$$;


\echo '  checking every public table has at least one policy'
do $$
declare
  offenders text;
begin
  -- A table with RLS on and no policies denies everything, which is safe but
  -- almost always a mistake — it means a feature silently returns nothing.
  -- The exceptions below are deliberate: tables only ever touched by the
  -- service role or by SECURITY DEFINER functions, where "deny all" IS the
  -- policy and a permissive one would be the bug.
  select string_agg(c.relname, ', ' order by c.relname) into offenders
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname not in ('staff', 'payment_webhook_events', 'audit_log')
    and not exists (
      select 1 from pg_policy p where p.polrelid = c.oid
    );

  if offenders is not null then
    raise exception 'Tables with RLS but no policies (so every query returns nothing): %', offenders;
  end if;
end;
$$;


\echo '  checking every SECURITY DEFINER function pins its search_path'
do $$
declare
  offenders text;
begin
  -- Without `set search_path`, a caller can create a schema earlier in the
  -- path holding a function or table of the same name, and the definer
  -- function runs their object with the owner's privileges. This is the
  -- single most common way a Postgres privilege escalation happens.
  select string_agg(format('%s.%s', n.nspname, p.proname), ', ' order by p.proname)
    into offenders
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'api_v1')
    and p.prosecdef
    and (p.proconfig is null or not exists (
      select 1 from unnest(p.proconfig) cfg where cfg like 'search\_path=%'
    ));

  if offenders is not null then
    raise exception 'SECURITY DEFINER functions without a pinned search_path: %', offenders;
  end if;
end;
$$;


\echo '  checking every api_v1 view is security_invoker'
do $$
declare
  offenders text;
  has_schema boolean;
begin
  select exists (select 1 from pg_namespace where nspname = 'api_v1') into has_schema;
  if not has_schema then
    return;
  end if;

  -- A view without security_invoker runs as its OWNER, which on Supabase is a
  -- superuser-adjacent role. The base table's RLS is then evaluated as that
  -- owner, not as the caller — so one omitted setting turns a view over a
  -- protected table into a full dump of it. There is no way to put a policy on
  -- a view to compensate; this setting is the whole control.
  select string_agg(c.relname, ', ' order by c.relname) into offenders
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'api_v1'
    and c.relkind = 'v'
    and not coalesce(
      (select option_value from pg_options_to_table(c.reloptions)
       where option_name = 'security_invoker') = 'true',
      false
    );

  if offenders is not null then
    raise exception E'api_v1 views missing security_invoker=true: %\n'
      '  Each one returns every row of its base table to anyone with the anon key.', offenders;
  end if;
end;
$$;


\echo '  checking the anon role can reach nothing'
do $$
declare
  offenders text;
begin
  -- 0009 revokes everything in `public` from anon, but that only covers the
  -- tables that existed when it ran. Supabase's default privileges grant anon
  -- access to new tables automatically, so a table added in a later migration
  -- gets it back unless somebody remembers. Nobody remembers; this does.
  --
  -- Every policy in this schema is `to authenticated`, so anon having no
  -- grants changes no behaviour — it is the second lock on the same door.
  select string_agg(distinct table_name, ', ') into offenders
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'anon';

  if offenders is not null then
    raise exception E'Tables the anon role can reach: %\n'
      '  Add them to the REVOKE in the newest RLS migration.', offenders;
  end if;
end;
$$;


\echo '  checking no table stores card data'
do $$
declare
  offenders text;
begin
  -- RBI's card-on-file rules (in force since 1 October 2022) forbid merchants
  -- storing the PAN, expiry, cardholder name or BIN; PCI DSS forbids the CVV
  -- to everyone, always. Only last4 and the network may be kept.
  --
  -- A column name is a blunt instrument, but the realistic way this rule gets
  -- broken is somebody adding `card_number` in a hurry, and a blunt instrument
  -- catches that.
  select string_agg(format('%s.%s', table_name, column_name), ', ')
    into offenders
  from information_schema.columns
  where table_schema = 'public'
    and (
      column_name ~* '(card_number|card_pan|^pan$|cvv|cvc|card_expiry|expiry_month|expiry_year|card_bin|^bin$|card_holder|cardholder)'
    );

  if offenders is not null then
    raise exception E'Columns that look like prohibited card data: %\n'
      '  RBI forbids storing PAN, expiry, cardholder name and BIN. PCI DSS forbids CVV.', offenders;
  end if;
end;
$$;


\echo '  checking money columns are integer paise, not floats'
do $$
declare
  offenders text;
begin
  -- Razorpay speaks paise. A rupee stored as a float is a reconciliation bug
  -- waiting for a number that does not round.
  select string_agg(format('%s.%s (%s)', table_name, column_name, data_type), ', ')
    into offenders
  from information_schema.columns
  where table_schema = 'public'
    and column_name ~* '(amount|fee|price|total)'
    and data_type in ('real', 'double precision', 'numeric');

  if offenders is not null then
    raise exception 'Money columns that are not integers: %', offenders;
  end if;
end;
$$;


\echo '  checking every foreign key is indexed'
do $$
declare
  offenders text;
begin
  -- An unindexed foreign key makes every DELETE on the parent scan this whole
  -- table to check the constraint. It is invisible until the table is large,
  -- and then it is a production incident.
  select string_agg(format('%s(%s)', rel.relname, col.attname), ', ' order by rel.relname)
    into offenders
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  join lateral unnest(con.conkey) as k(attnum) on true
  join pg_attribute col on col.attrelid = rel.oid and col.attnum = k.attnum
  where con.contype = 'f'
    and nsp.nspname = 'public'
    and array_length(con.conkey, 1) = 1
    and not exists (
      select 1 from pg_index i
      where i.indrelid = con.conrelid
        and i.indkey[0] = k.attnum
    );

  if offenders is not null then
    raise exception 'Foreign keys with no index on the referencing column: %', offenders;
  end if;
end;
$$;
