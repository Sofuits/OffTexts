# Supabase

The database, in two files you run once.

```
migrations/0001_initial_schema.sql        tables, enums, indexes, triggers, storage bucket
migrations/0002_row_level_security.sql    the policies — not optional
```

## Setting it up

1. Create a project at [supabase.com](https://supabase.com). **Pick the Mumbai
   region** — lowest latency for members in Pune.
2. Dashboard → **SQL Editor** → New query → paste `0001_initial_schema.sql` →
   Run.
3. Same again with `0002_row_level_security.sql`. **The order matters** — the
   policies reference tables created by the first file.
4. Settings → API → copy the **Project URL** and the **anon public key** into
   `.env`:

   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhb...
   ```

5. Regenerate the TypeScript types so they match what actually exists:

   ```bash
   npx supabase gen types typescript --project-id <id> > src/infrastructure/supabase/database.types.ts
   ```

   From then on, never edit that file by hand. Generating it is what makes a
   column rename a compile error instead of an `undefined` at runtime.

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

After any change, regenerate `database.types.ts` and run `npm run verify`.
