# Supabase

The database, in two files you run once.

```
migrations/0001_initial_schema.sql        tables, enums, indexes, triggers, storage bucket
migrations/0002_row_level_security.sql    the policies — not optional
```

## The project

|              |                                   |
| ------------ | --------------------------------- |
| Organisation | Sofuits                           |
| Project      | OffTexts                          |
| Reference    | `dxggtnpnyxqjyarxvczh`            |
| Region       | South Asia (Mumbai), `ap-south-1` |

The reference is not a secret — it is half of the URL that ships inside the app
bundle. What protects the data is Row Level Security, not obscurity.

## Setting it up

**Apply migrations with the CLI, never by pasting into the SQL Editor.**

That is not a style preference. Supabase records which migrations have run in
`supabase_migrations.schema_migrations`, and the SQL Editor does not write to
it. Paste the SQL by hand and the database is correct but the ledger is empty —
so the GitHub integration, which deploys migrations on every push to `main`,
tries to run them again and fails with `type "meet_intent" already exists`. The
database stays fine and every deployment after that shows red.

`supabase db push` applies **and** records. That is the entire difference.

```bash
npx supabase login                                    # once per machine
npx supabase link --project-ref dxggtnpnyxqjyarxvczh  # asks for the DB password
npx supabase db push                                  # lists what it will apply
```

Then Settings → **API Keys** → copy the **Project URL** and the **anon public
key** into `.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://dxggtnpnyxqjyarxvczh.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhb...
```

Confirm both migrations are recorded:

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

Then regenerate the TypeScript types so they match what actually exists:

```bash
npx supabase gen types typescript --project-id dxggtnpnyxqjyarxvczh > src/infrastructure/supabase/database.types.ts
```

From then on, never edit that file by hand. Generating it is what makes a column
rename a compile error instead of an `undefined` at runtime.

The moment both `.env` values are present, the composition root wires the
Supabase repositories instead of the in-memory ones. Nothing else changes.

## Verify RLS actually works

Do this before anyone signs up. It takes a minute and it is the difference
between a private database and a public one.

In the SQL editor:

```sql
set role anon;
select * from public.profiles;   -- must return 0 rows
select * from public.meets;      -- must return 0 rows
reset role;
```

**If any of those return rows, stop.** The anon key is inside the app bundle and
readable by anyone who downloads it — the policies are the only thing standing
between a stranger and every member's name, city, email and photos.

Also check Dashboard → Authentication → Policies: all three tables must show
**RLS enabled**.

## What the policies actually say

| Table                    | Read                                | Write                                                                  |
| ------------------------ | ----------------------------------- | ---------------------------------------------------------------------- |
| `profiles`               | Your own, plus **verified** members | Only your own row                                                      |
| `meets`                  | Only meets you are in               | Insert as the requester, and only with a verified counterpart          |
| `reviews`                | Only for meets you attended         | Only after the meet has happened, once per person, editable for 1 hour |
| storage `profile-photos` | Public                              | Only inside a folder named with your own user id                       |

Three of those are product rules living where they cannot be bypassed:

- **Unverified profiles are invisible.** The `.eq('verification','verified')` in
  the Discover repository is a query optimisation; this policy is the control.
- **You cannot review a meet you have not been to yet.** The policy checks
  `scheduled_for < now()`.
- **You cannot overwrite someone else's photos.** Uploads are confined to
  `<your-user-id>/…`.

## The identity model

`profiles.id` **is** `auth.users.id`. One identity, not two.

An earlier draft had a separate `user_id`, which meant `meets.requester_id` held
an auth id while `recipient_id` held a profile id — two different values for the
same person, so a meet could never match its own participants. Collapsing them
also makes every policy a direct `auth.uid() = id` comparison rather than a
subquery.

A profile row is created automatically by the `handle_new_user` trigger the
moment someone signs up, seeded with the name Google provides. Without it there
is a window where a member is authenticated but has no profile, and every screen
would have to handle it.

## Changing the schema later

Add a new numbered file — `0003_whatever.sql` — rather than editing an existing
one. A migration that has already run on the production database cannot be
edited; it can only be followed by another.

The repository is connected to this project through Supabase's GitHub
integration, with `main` as the production branch, so merging a PR that adds a
file to `migrations/` applies it automatically. Nobody runs anything by hand.

The flow is therefore: write the new file, `supabase db push` to apply it from
your branch, open a PR. The merge is a no-op, because the ledger already records
it — which is exactly why the CLI and not the SQL Editor.

After any change, regenerate `database.types.ts` and run `npm run verify`.

**Do not enable Supabase Branching** — a separate preview database per git
branch — without discussing it first. It is billed by usage and, unlike
everything else on this account, **is not covered by the Spend Cap**. It is the
one setting here that can produce a real invoice.
