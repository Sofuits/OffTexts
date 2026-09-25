# Supabase

```
migrations/0001_initial_schema.sql              profiles, meets, reviews, the photo bucket
migrations/0002_row_level_security.sql          the policies — not optional
migrations/0003_staff_and_admin_access.sql      staff, is_staff(), what the admin portal may read
migrations/0004_member_profile_and_preferences.sql
                                                gender, date of birth, preferences, photos, availability
migrations/0005_cafes.sql                       partner venues, contacts, opening hours
migrations/0006_candidates_decisions_matches.sql
                                                the nightly feed, likes and passes, mutual matches
migrations/0007_meetings_and_payments.sql       meets extended; Razorpay orders, refunds, webhook ledger
migrations/0008_safety_notifications_audit.sql  reports, notifications, push tokens, the audit log
migrations/0009_rls_and_storage.sql             RLS and grants for all of the above, two more buckets
migrations/0010_api_v1.sql                      the published contract — see docs/api/v1.md
migrations/0011_three_candidates_per_day.sql    generate_candidates() defaults to three a day, not five

tests/_harness.sql       fakes the auth and storage schemas Supabase provides
tests/assertions.sql     structural rules: RLS, grants, search_path, card data, indexes
tests/behaviour.sql      78 checks, 28 of them policy tests run as a real member
tests/replay.sh          applies everything from empty and runs both

seed/photos/             placeholder portraits for the demo members
seed/remove-demo-seed.sql  deletes every demo row in one statement
```

## Testing before pushing

```bash
supabase/tests/replay.sh
```

Recreates a scratch database on a local Postgres, applies every migration in
order, and then checks the result. It needs a Postgres running locally; set
`PGHOST_DIR` and `PGPORT` if yours is not on the default socket.

This exists because `supabase db push` is otherwise the only way to find out
whether a migration works, and it finds out by running it on the real database.
A migration that fails halfway leaves a schema matching neither the old state
nor the new one. Replaying locally turns that into a test that costs a second.

It has already earned it: the structural assertions found a missing index on
`reviews.author_id` that had shipped in 0001, and the behaviour tests found a
trigger that would have failed on the first refund, because `set search_path =
''` means an unqualified type name does not resolve.

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

Confirm every migration is recorded:

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

### Two dashboard steps the CLI cannot do

**1. Expose `api_v1`.** Project Settings → API → **Exposed schemas** → add
`api_v1` next to `public`. PostgREST refuses to serve an unexposed schema, and
the error it returns does not say "add it to the list" — it says the schema
must be one of the exposed ones, which sends you looking in the wrong place.

**2. Grant yourself staff access**, if you have not already. There is
deliberately no UI for this, because a portal that can grant portal access is
one compromised account away from being wide open:

```sql
insert into public.staff (id, role, note)
select id, 'admin', 'Your name' from auth.users where email = 'you@example.com';
```

### Types

```bash
npx supabase gen types typescript \
  --project-id dxggtnpnyxqjyarxvczh \
  --schema public,api_v1 \
  > src/infrastructure/supabase/database.types.ts
```

`--schema` takes one comma-separated value, not a repeated flag. Both schemas
in one file is what keeps `.schema('api_v1')` typed — the generated `Database`
type is keyed by schema name.

From then on, never edit that file by hand. Generating it is what makes a column
rename a compile error instead of an `undefined` at runtime.

The moment both `.env` values are present, the composition root wires the
Supabase repositories instead of the in-memory ones. Nothing else changes.

## Demo members

A fresh project has nobody for Today to show. `scripts/seed-demo.mjs` creates
eight verified members in the dev account's city, two per purpose, each with a
photo in Storage, and puts three of them in the dev account's set for today —
a different purpose left out each day, so all four come round within four days,
and always someone who has already liked the account, so a match can be made.
`--all-purposes` serves one of each purpose instead. It also creates five partner
cafés in Pune with realistic hours (two closed one day a week), so a match can
be booked. They are fictional on purpose: every name ends "(demo)" and every
address says it is not real:

```bash
SUPABASE_SERVICE_ROLE_KEY=… node scripts/seed-demo.mjs --member you@example.com           # dry run
SUPABASE_SERVICE_ROLE_KEY=… node scripts/seed-demo.mjs --member you@example.com --apply
```

**Every seeded row has an id starting `5eed0000-`**, and so does every Storage
path. Remove all of it before real members arrive, with either
`node scripts/seed-demo.mjs --remove` (rows and files) or the one statement in
`seed/remove-demo-seed.sql` (rows; the files then need deleting from the
dashboard, because Storage objects cannot be deleted from SQL).

The service role key goes on the command line for that one command, never in
`.env` — the script refuses to run if it finds one there.

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

Add a new numbered file — `0011_whatever.sql` — rather than editing an existing
one. A migration that has already run on the production database cannot be
edited; it can only be followed by another.

Run `supabase/tests/replay.sh` before `supabase db push`, every time.

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

## Scheduled work

Two functions are written to run on a schedule and nothing currently runs them:

| Function                | When    | What it does                                                                                 |
| ----------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `generate_candidates()` | nightly | Builds each active member's feed for the day. Idempotent per date, so a retry is safe        |
| `refresh_ages()`        | nightly | Recomputes `profiles.age` from `date_of_birth`, which drifts while nobody is writing the row |

Both return a count rather than void, so a scheduled run logs something more
useful than "ok".

Under `pg_cron` this is:

```sql
select cron.schedule('nightly-candidates', '30 22 * * *',
  $$ select public.refresh_ages(), public.generate_candidates() $$);
```

(22:30 UTC is 04:00 IST — before anyone opens the app, after the day's activity
has settled.)

**Check first that `pg_cron` is available on the Free plan.** Supabase's
documentation does not state it either way, and I would rather say that than
have you design around an assumption. Dashboard → Integrations → Cron. If it is
not there, an Edge Function called by any external scheduler does the same job —
the functions do not care what invokes them, which is why the scheduling is not
baked into them.

## What is not switched on

- **Payments.** `current_booking_fee_paise()` returns `0` and no Razorpay
  integration is deployed. The schema is ready; nothing charges anybody.
- **Notifications.** The table, policies and read path exist. Nothing writes a
  row yet, because what should — a trigger, a job, an Edge Function — has not
  been decided.
- **Realtime.** Not enabled on any table. A subscription is a read, so it would
  need its own policy review.

See the "Open questions for product" section of `docs/api/v1.md`.
