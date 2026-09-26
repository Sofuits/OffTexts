# Offtexts — mutual scheduling flow (phase 2)

**Build this after the UI rebuild (steps 4 and 5) lands.**

Reference mockups: `docs/design/offtexts-flow/` — ten steps, already drawn,
and the source of the palette in `ui-rebuild-brief.md`.

---

## 0. Read this first

The booking screen currently in the app — café, then a row of day chips, then
a row of time chips, then "Ask for this table" — is not a bug and not a wrong
implementation of these mockups. It is the pre-phase-2 screen: one member
proposes, the other accepts. It was built before the mockups existed and it is
what this document replaces.

What the mockups describe is a **negotiation, not a proposal**. Both members
independently mark when they are free, each sees the other's marks, and the
meeting exists only when both land on the same slot. That needs per-session,
per-member, per-date and per-time state that both members can read, and
nothing in the schema holds that today. It is a migration, not a restyle.

**The members negotiate the day and the time. They do not choose the café:
the server assigns it** (§5).

### The table that looks like it would help, and does not

`public.availability` exists, but it holds **recurring weekly windows** —
"most Tuesdays I'm free 6–9pm" — scoped to a member, not to a meeting. Its own
comment says so. It feeds the matching algorithm. **Leave it alone.** It
answers a different question, and conflating the two will break matching.

---

## 1. The flow

Exactly the ten mockup steps. There is no café screen.

| #   | Screen              | What it does                                                                                                                                                                            |
| --- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **SchedulingStart** | From a match. Explains the steps. The mockup puts a heart between the two avatars — use the café cup instead. Offtexts serves four purposes; only one is romantic.                      |
| 2   | **SelectDates**     | Month calendar, multi-select, spanning weeks or months. Chips below for what is picked.                                                                                                 |
| 3   | **SharedDates**     | Two-column table, you and them. Green row = both free. Your own column stays editable.                                                                                                  |
| 4   | **ChooseDay**       | Radio list of the overlap only.                                                                                                                                                         |
| 5   | **DayConfirmed**    | Confirmation beat, with a "Change" affordance.                                                                                                                                          |
| 6   | **SelectTimes**     | Slot list for the chosen day, multi-select, the cafés' timezone shown. **Only start times at which at least one partner café is open for the whole meeting and has a free table** (§5). |
| 7   | **SharedTimes**     | Same two-column table, for times.                                                                                                                                                       |
| 8   | **ChooseTime**      | Radio list of the overlap. **Choosing confirms the meeting**: the server assigns a café and books it (§4, `choose_time`).                                                               |
| 9   | **Confirmed**       | The meeting exists. Both members and the admin are notified. Whether this screen names the café is an open decision (§5, §9).                                                           |
| 10  | **EditScheduling**  | Edit dates · edit times · cancel.                                                                                                                                                       |

Steps 3 and 7 are the same component with different data. Steps 4 and 8 are
the same component. Build two, use them twice.

---

## 2. Schema — migration 0012

```sql
create type public.scheduling_stage as enum
  ('dates', 'times', 'confirmed', 'cancelled');

create table public.scheduling_sessions (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches (id) on delete cascade,
  stage       public.scheduling_stage not null default 'dates',

  chosen_date       date,
  chosen_starts_at  time,
  chosen_ends_at    time,

  -- Assigned by choose_time (§5), never chosen by a member. Set together with
  -- the time and the meeting, in one transaction.
  cafe_id           uuid references public.cafes (id) on delete restrict,

  -- Set only on confirmation. The meeting is the output of this negotiation.
  meet_id           uuid references public.meets (id) on delete set null,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,

  constraint scheduling_confirmed_has_everything check (
    (stage <> 'confirmed') or
    (chosen_date is not null and chosen_starts_at is not null
     and cafe_id is not null and meet_id is not null and confirmed_at is not null)
  ),
  constraint scheduling_cancelled_has_stamp check (
    (stage = 'cancelled') = (cancelled_at is not null)
  )
);

-- One live negotiation per match. A cancelled one may sit alongside a new one,
-- which is why this is partial rather than a plain unique constraint.
create unique index scheduling_one_live_per_match
  on public.scheduling_sessions (match_id)
  where stage <> 'cancelled';

create table public.scheduling_date_options (
  session_id uuid not null references public.scheduling_sessions (id) on delete cascade,
  member_id  uuid not null references public.profiles (id) on delete cascade,
  for_date   date not null,
  created_at timestamptz not null default now(),
  primary key (session_id, member_id, for_date)
);

-- Times are for the session's chosen_date. They have no date of their own,
-- which is why reopening to 'dates' must delete them (§4, reopen_scheduling).
create table public.scheduling_time_options (
  session_id uuid not null references public.scheduling_sessions (id) on delete cascade,
  member_id  uuid not null references public.profiles (id) on delete cascade,
  starts_at  time not null,
  created_at timestamptz not null default now(),
  primary key (session_id, member_id, starts_at)
);

create index scheduling_date_options_session_idx on public.scheduling_date_options (session_id);
create index scheduling_time_options_session_idx on public.scheduling_time_options (session_id);
create index scheduling_sessions_match_idx on public.scheduling_sessions (match_id);
```

Times are stored as `time`, not `timestamptz`, because a slot means "9am where
the café is". The café's local day is the reference, and `meets.scheduled_for`
becomes the absolute instant at confirmation.

### The café's timezone

The reference is the café, so the zone belongs to the café — not to the city,
and not to the member. It stays right if a second city is ever added.

```sql
alter table public.cafes
  add column timezone text not null default 'Asia/Kolkata';
```

A `CHECK` cannot query `pg_timezone_names`, so a `before insert or update of
timezone` trigger rejects a name Postgres does not know. `choose_time` builds
the instant from the café it assigns: `(chosen_date + chosen_starts_at) at time
zone cafes.timezone`.

The members' own timezone is irrelevant: the slot is when the café's doors are
open. SelectTimes shows the zone of the city's partner cafés as a label (e.g.
"IST") and offers no choice. All partner cafés in one city share a zone; an
assertion should fail if an active café's zone differs from the rest of its
city, because then "9am" would not mean one thing across the candidates.

### No location columns

Member location is not part of v1 — see §6. `profiles` must never gain
location columns: its `select` policy lets any signed-in member read every
verified profile row, and the app reads it with `select('*')`. RLS is per row,
not per column, so a column there is readable by everyone who can see the
profile.

---

## 3. Row Level Security

This is the first place in the product where one member reads another
member's rows. Everywhere else that is forbidden; here it is the feature. So
scope it precisely: a member may read the other member's options only for a
session belonging to a match they are in, and may write only their own.

```sql
alter table public.scheduling_sessions      enable row level security;
alter table public.scheduling_date_options  enable row level security;
alter table public.scheduling_time_options  enable row level security;
alter table public.scheduling_sessions      force row level security;
alter table public.scheduling_date_options  force row level security;
alter table public.scheduling_time_options  force row level security;

-- For the option tables' policies. Reads scheduling_sessions under that
-- table's own policy, which checks matches directly — so no recursion.
create or replace function public.in_session(p_session_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1
    from public.scheduling_sessions s
    join public.matches m on m.id = s.match_id
    where s.id = p_session_id
      and (select auth.uid()) in (m.member_a, m.member_b)
  );
$$;

-- NOT in_session(id): that would query this table from inside this table's
-- own policy, and Postgres stops with "infinite recursion detected in policy".
create policy "sessions: read own match" on public.scheduling_sessions
  for select to authenticated using (
    exists (
      select 1 from public.matches m
      where m.id = match_id
        and (select auth.uid()) in (m.member_a, m.member_b)
    )
    or public.is_staff()
  );

create policy "date options: read within my session" on public.scheduling_date_options
  for select to authenticated using (public.in_session(session_id));

create policy "date options: write own" on public.scheduling_date_options
  for insert to authenticated
  with check (member_id = (select auth.uid()) and public.in_session(session_id));

create policy "date options: delete own" on public.scheduling_date_options
  for delete to authenticated
  using (member_id = (select auth.uid()) and public.in_session(session_id));
```

The same three for `scheduling_time_options`.

**No client-side INSERT or UPDATE on `scheduling_sessions`.** Stage, chosen
date, chosen time, café and confirmation are set by the functions in §4 and by
nothing else — two clients can reach the same slot within the same second, and
a read-then-write would confirm twice or not at all. Grant `select` only; the
functions that write sessions are `security definer` for exactly that reason.

### Hardening the security definer functions

They run with the owner's rights and bypass RLS, which makes them the main
privilege-escalation surface in the project. Every one of them:

- `set search_path = ''`, with every name schema-qualified.
- `revoke execute … from public, anon;` then `grant execute … to authenticated;`.
  Postgres grants EXECUTE to PUBLIC on every new function by default, and anon
  inherits it through PUBLIC, so the revoke is not optional.
- Its own membership check, trusting no argument. The caller is `auth.uid()`
  and nothing else; the members are derived from the session's match, never
  passed in. The session is loaded `for update`, joined to an **active** match
  the caller is in, and a miss raises the same error whether the session does
  not exist or is someone else's — confirming which would leak that it exists.

```sql
-- The shape every definer function in §4 follows.
create or replace function api_v1.choose_time(p_session_id uuid, p_starts time)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  s  public.scheduling_sessions;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select ss.* into s
  from public.scheduling_sessions ss
  join public.matches m on m.id = ss.match_id
  where ss.id = p_session_id
    and m.status = 'active'
    and me in (m.member_a, m.member_b)
  for update of ss;

  if not found then
    raise exception 'No such session' using errcode = '42501';
  end if;

  -- … stage and rule checks, the assignment (§5), then the write …
end;
$$;

revoke execute on function api_v1.choose_time(uuid, time) from public, anon;
grant  execute on function api_v1.choose_time(uuid, time) to authenticated;
```

### Tests that must exist

Structural assertions in `supabase/tests/assertions.sql`, behaviour in
`behaviour.sql`. In particular:

- A member outside the match sees nothing — sessions, date options, time
  options, grid.
- A member inside the match cannot write the other's rows.
- Every definer function refuses a session id from somebody else's match.
- Two concurrent `choose_time` calls on one session produce **one** meeting.
- **Capacity:** two sessions choosing the same slot when a café has one table
  left — one gets that café, the other is assigned a different qualifying café
  or refused with `no_table`. Never two meetings over capacity.
- `bookable_times` never returns a start time at which no partner café is open
  for the whole meeting with a free table.
- `choose_time` refused with `no_table` leaves the session at `times`, with
  both members' time options intact.
- `reopen_scheduling` deletes **both** members' time options.
- **Assertion:** no `security definer` function in `api_v1` is executable by
  `PUBLIC` or `anon`:

  ```sql
  select p.oid::regprocedure
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'api_v1'
    and p.prosecdef
    and (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      or exists (
        select 1
        from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where a.grantee = 0 and a.privilege_type = 'EXECUTE'  -- 0 is PUBLIC
      )
    );
  -- must return no rows
  ```

### Do not repeat the api_v1 mistake

Every view added here goes in `api_v1` with `security_invoker = true`, and
`api_v1` must be in the project's **Exposed schemas** in the Supabase
dashboard. That setting was missing and silently broke every api_v1 read in
the app — Today, Matches, preferences, photos, venues and booking — for as
long as it went unnoticed.

It lives in the dashboard, not the database, so `assertions.sql` cannot see
it. The smoke test is an HTTP call with the anon key:

```
POST {SUPABASE_URL}/rest/v1/rpc/contract_version
Content-Profile: api_v1
→ 200 "1.0.0"      (PGRST106 means api_v1 is not exposed)
```

Run it against every environment after deploying, and in CI where a project
is available.

---

## 4. api_v1 contract additions

`set search_path = ''` on all of them. **D** = `security definer`, hardened as
in §3. **I** = `security invoker`, under RLS.

| Function                                               |     | Does                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------ | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start_scheduling(p_match_id uuid) → uuid`             | D   | Creates the session, or returns the live one. Refuses if the caller is not in an active match, or if the two members have no shared city with an active partner café (§5).                                                                                                                                                                                                                        |
| `set_date_options(p_session_id uuid, p_dates date[])`  | I   | Replaces the caller's dates in one statement. Only while the stage is `dates`.                                                                                                                                                                                                                                                                                                                    |
| `choose_date(p_session_id uuid, p_date date)`          | D   | Only if both members marked it. Sets `chosen_date`, stage → `times`.                                                                                                                                                                                                                                                                                                                              |
| `bookable_times(p_session_id uuid) → setof time`       | D   | The start times on `chosen_date` at which at least one partner café in the shared city is open for the whole meeting **and has a free table**. Step 6 offers only these. Definer because capacity counts other members' meetings, which no member can read; it returns start times and nothing else — no café, no count.                                                                          |
| `set_time_options(p_session_id uuid, p_starts time[])` | I   | Replaces the caller's times. Only while the stage is `times`.                                                                                                                                                                                                                                                                                                                                     |
| `choose_time(p_session_id uuid, p_starts time) → uuid` | D   | **Terminal.** Only if both members marked the time. Assigns a café by the rules in §5, checking hours and capacity under lock; builds the instant in that café's `timezone`; runs the `request_meeting` logic; sets the time, `cafe_id` and `meet_id`; stage → `confirmed`; notifies both members and staff. Returns the meeting id. If no café qualifies, raises `no_table` and changes nothing. |
| `reopen_scheduling(p_session_id uuid)`                 | D   | Step 10, "Edit dates". From `times` back to `dates`: clears `chosen_date` **and deletes both members' time options**. Refused once confirmed. ("Edit times" needs no function: at `times`, a member edits their options with `set_time_options`.)                                                                                                                                                 |
| `cancel_scheduling(p_session_id uuid, p_reason text)`  | D   | Either member. Stage → `cancelled`. If the session was confirmed, cancels its meeting too, so the café's table is released.                                                                                                                                                                                                                                                                       |

`set_date_options` and `set_time_options` stay invoker: they only write the
caller's own option rows, which RLS already scopes. Everything that writes a
session, deletes the other member's rows, reads other members' meetings,
creates a meeting or notifies somebody else is definer, because a member has
none of those rights directly.

**Concurrency.** `choose_time` holds the session row `for update` from the
membership check to the end and re-checks `stage = 'times'` after taking the
lock; the second of two simultaneous calls on one session waits, sees
`confirmed`, and returns the existing `meet_id`. Across sessions, the
assignment locks the candidate café's row (`select … from public.cafes …
for update`) before counting its meetings at that slot, so two sessions cannot
both take a café's last table (§5).

Views, both `security_invoker`:

- `api_v1.my_scheduling_sessions` — the session for each of my active
  matches, with the other member resolved.
- `api_v1.scheduling_grid` — one row per (session, date-or-time, mine,
  theirs, both). Steps 3 and 7 render this directly. **Do not make the phone
  compute the intersection from two lists**; that is a correctness problem
  disguised as a UI problem.

Keep `api_v1.request_meeting`. `choose_time` uses its logic. The direct-booking
path stays available for staff and for a future "arrange without negotiating".

---

## 5. How the server assigns the café

Members never choose the café. When they agree a time, `choose_time` assigns
one. There is no café step, so there is **no fallback**: nobody can look at an
unsuitable café and pick another. Everything below exists because of that.

### Which cafés qualify

A café qualifies for a session's agreed date and time when all of these hold:

1. **Partner and active.** `public.cafes.status = 'active'` — a business that
   has agreed to hold a table (see "Where cafés come from").
2. **In the shared city.** The two members' `profiles.city`, compared
   case-insensitively after trimming, must be the same, and the café must be in
   it. A match whose members name different cities has no shared city;
   `start_scheduling` refuses it with an explanation rather than letting two
   people negotiate a time no café can host.
3. **Open for the whole meeting.** The café's `cafe_hours` for that ISO weekday
   (`extract(isodow …)` of the date, in the café's `timezone`) contain the
   interval from the start time to the start plus the meeting's duration.
4. **A free table.** Fewer of its meetings overlap that interval — status
   `pending` or `confirmed` — than its `concurrent_meet_capacity`.

### Capacity is checked when assigning, not only when offering

`bookable_times` (step 6) applies all four rules, so members are only offered
times that can be hosted. But it answers for a moment that has passed by the
time step 8 is tapped: another pair can take the last table in between. So
`choose_time` applies them again, under lock:

- It locks the candidate café's row, then counts that café's overlapping
  meetings, then books. Two sessions racing for the last table serialise on
  the lock; the second one to arrive sees the table gone.
- It takes the candidates in the order below and books the first that still
  qualifies after its lock.

Opening hours alone are not enough: a café that is open but full is not a
place anyone should be sent.

### The order, in v1

Without member location (§6), distance cannot be a factor. Among qualifying
cafés, `choose_time` takes:

1. the one with the **most free tables** at that slot — it leaves the most
   room, and spreads meetings rather than filling one café first;
2. then the one with the **fewest meetings already that day**;
3. then the **lowest id**, so the result is deterministic and testable.

This is a placeholder rule and knows nothing about where either member is: it
can send two people who both live in Kharadi to Baner. That is the weakest
part of assigning without a choice, and it is why distance is an open decision
(§9), not a closed one. §6 describes how to add it.

### When nothing qualifies

- **At step 6, for the chosen day:** `bookable_times` returns nothing. The
  screen says no partner café has a table that day and offers "Change date"
  (`reopen_scheduling`).
- **At step 8, between offer and choice:** the table went to someone else.
  `choose_time` raises `no_table`, changes nothing — the session stays at
  `times`, both members' time options stay — and the screen says that time was
  just taken and shows the remaining overlap, refreshed from `bookable_times`.
  If none remains, it offers "Edit times" and "Change date".
- **Before the negotiation starts:** no shared city, or no active partner café
  in it. `start_scheduling` refuses, and the match screen says scheduling is
  not available in that city yet. Two people should not spend five steps
  agreeing a time the product cannot host.

### When the member learns which café — a decision

**The mockups do not settle this.** No café appears in any of the ten steps;
step 9 shows the date, the time, the two members and "Both participants and the
admin have been notified", and nothing about where.

- **On the confirmation screen (step 9).** Honest only if the table is really
  held at the moment of assignment — that is, if the partner café has agreed to
  take Offtexts bookings without being asked each time.
- **Later, with the admin's confirmation.** Needed if staff still contact the
  café for each booking (§9, question 1): the café can say no, and showing it
  early would send two people somewhere that has not agreed. Step 9 then says
  the table is being arranged and the café follows.

Which is right depends on §9's first question, and is **for the product owner
to decide**. Until it is decided, step 9 must not name a café as booked.

### Where cafés come from

Two different things, repeatedly conflated. Keep them apart. With the server
assigning cafés, the difference matters more than before: a member no longer
looks at a café and chooses it — the app sends them.

1. **Partner cafés — `public.cafes`.** Businesses that have agreed to hold a
   table. This is the only list the server may assign from, because the app
   tells members "We hold the table and tell them — there is nothing to
   message." That promise is false at any café that has not agreed to it. This
   list is curated by business development and arrives through the admin
   portal. It is small, and it should be.

2. **Nearby-café discovery — optional, for a map view only.** If the product
   wants to show what is around, the legitimate sources are:
   - **OpenStreetMap via the Overpass API** — open data, free, ODbL licensed.
     Requires attribution and share-alike on derived databases. Sufficient for
     distance, geocoding and "what cafés exist near here".
   - **Google Places API** — licensed and paid. Gives photos and ratings.
     Caching is restricted: place IDs may be stored indefinitely, most other
     content may not be retained beyond the terms' limit.

   Neither is ever an assignment source.

**Do not scrape Google Maps.** The Google Maps Platform Terms of Service
prohibit extracting or exporting Maps content for use outside Google's
services, and that applies equally to a third-party scraping tool. Beyond the
licensing question, scraped businesses are not partners, so a member sent to
one arrives at a café that has never heard of Offtexts and has no table held.
If a scraping approach is proposed, say so and stop rather than implementing
it.

### Must be resolved before launch: real café names in seed data

`src/shared/constants/seedData.ts` on `main` names real Pune businesses —
**Pagdandi**, **Vohuman Café** and **The Daily Grind** — with addresses, as the
in-memory venues and seeded meets. (`src/domain/entities/__tests__/Venue.test.ts`
and `RequestMeetScreen.test.tsx` use the same names.) They are not in any
migration, so they never reach the production database; they are what the app
shows when it runs without Supabase or with `DEV_SKIP_AUTH`, which is every
demo, screenshot and review build.

With the app assigning venues, that becomes a real-world instruction: a demo
build will tell two people to meet at Pagdandi, a business that has not agreed
to hold a table and has never heard of Offtexts. **Replace them with obviously
fictional names and addresses before launch** — the Supabase demo seed
(`scripts/seed-demo.mjs`) already does this: every name ends "(demo)" and every
address says it is not real.

---

## 6. Location — a server-side input only

**Not in v1.** Kept here so it can be added without re-deciding it.

If distance becomes a factor in assignment, member location comes back in one
role only: **an input to the assigner.** It is never shown to anyone — not to
the other member, not to the member themselves as a distance, not in any view,
and not returned by any function. The only thing that leaves the database is
the café `choose_time` assigns.

**This is a better privacy position than the earlier design.** Before, a
member chose from a list, so the design had to compute each member's distance
to every café and send the caller theirs; a derived distance was an output,
and every output is a surface. With assignment, nothing derived from location
is output at all. What remains is a weak signal in the result itself: the café
chosen to minimise the longer journey says something, coarsely, about where
the other member might be. With ~1 km rounding and a dozen or more cafés that
signal is faint, but it is not zero, and it should be named rather than
assumed away.

### The rule

Among qualifying cafés (§5), rank by `max(distance to A, distance to B)`
ascending — minimising the worse journey, which is what "fair" means here; a
midpoint can sit a long way from both. Break ties with the v1 order (§5). If
either member has no location, assign by the v1 order alone.

### Storage

Not on `profiles` — see §2. A separate table, **written by its owner, read by
nobody but the assigner**:

```sql
create table public.member_locations (
  member_id  uuid primary key references public.profiles (id) on delete cascade,
  -- Rounded to two decimals (~1 km) BEFORE it reaches the database.
  -- Same type as public.cafes.latitude/longitude.
  area_lat   numeric(9, 6) not null check (area_lat = round(area_lat, 2)),
  area_lng   numeric(9, 6) not null check (area_lng = round(area_lng, 2)),
  updated_at timestamptz not null default now()
);
-- RLS: insert, update, delete where member_id = auth.uid(). NO select policy —
-- not even for the owner. Only choose_time, a hardened definer function, reads it.
```

No `area_label`: nothing displays the location, so there is nothing to label.
Distances are haversine in SQL — `public.cafes` uses plain `numeric`
coordinates, not PostGIS, and one extension for one distance calculation is not
worth the operational surface.

### The rules

Members' locations are the most sensitive data this product would hold, and
this is a dating app among other things.

- Ask at the point of use — when scheduling starts, with a plain explanation
  ("so we can pick a café that's fair for both of you") — not at sign-up, and
  never as a blocking permission. Refusing must not block scheduling: that
  member is assigned by the v1 order.
- Store area-level only. Round to roughly 1 km on the phone, before it is
  sent. Precise coordinates are not stored, not logged, and not sent to the
  server.
- Readable by no member, including its owner. Nothing in `api_v1` selects
  from it or returns anything computed from it.
- **Assertions** in `supabase/tests/assertions.sql`: `member_locations` has no
  select policy; no `api_v1` view references it; the only function that
  references it is `choose_time`. The same class of guard as the card-data
  assertion.

---

## 7. App layer

- **Domain:** `SchedulingSession`, `DateOption`, `TimeOption` and
  `SchedulingStage` in `domain/entities/Scheduling.ts`. A
  `SchedulingRepository` interface with one method per RPC. A use case only if
  a rule lives above the repository — if it is a pass-through, do not create
  one (see `domain/usecases/index.ts`).
- **Data:** `SupabaseSchedulingRepository`, and an
  `InMemorySchedulingRepository` with a fake second member who marks a
  plausible overlap and an in-memory assigner over the seed venues, so the
  whole flow is walkable with no backend. Mapper, container wiring. Weekdays
  from the API are ISO (7 = Sunday); convert as `toVenue` does.
- **Presentation:** the screens in §1, `useScheduling*` query hooks, and
  invalidation of `queryKeys.matching.matches()` and `queryKeys.meets.all` on
  confirm. Step 8 handles `no_table` as described in §5.
- **Replaces the preview:** `feature/availability-calendar` has steps 1–5 as a
  placeholder (`DateSharingRepository`, which invents the other member's
  dates). Phase 2 replaces that repository with `SchedulingRepository`, moves
  the intersection to `api_v1.scheduling_grid`, and removes the placeholder
  notice and the production gate.
- **Replaced:** `RequestMeetScreen.tsx` and its test. Restyle it during the UI
  rebuild so it is not the one ugly screen, but do not invest in it.
- **Admin portal:** a confirmed meeting needs a staff view. Separate repo.

### Seed support

Extend `scripts/seed-demo.mjs`. Everything keeps the `5eed0000-` prefix and
stays covered by `--remove` and its self-check.

- **`--pair <emailA> <emailB>`** puts each account in the other's candidate
  set for today, with no likes pre-created, so two real people can genuinely
  decide. There is one set per member per day, so this **adds to an existing
  set** (the demo seed's, if it ran today) rather than creating a second one;
  it refuses to touch a set the seed did not create, as the member seed
  already does.
- **`--remove` clears scheduling sessions before cafés.**
  `scheduling_sessions.cafe_id` is `on delete restrict`, like `meets.cafe_id`,
  so sessions at a seeded café must go first; sessions of matches with seeded
  members cascade with the members.
- **`--respond`** makes the demo members in a live session mark plausible
  date and time options, so the shared grid has something in it without a
  second phone. A session only exists once a real member starts one, so this is
  re-run after tapping "start". **Build it only when the flow exists to respond
  to.**

---

## 8. Build order

1. Migration 0012 + RLS + assertions. Nothing else starts until the tests for
   "outside the match sees nothing" pass.
2. `api_v1` functions and the two views, with the definer hardening and its
   assertion.
3. Domain entities + repository interface + in-memory implementation.
4. Screens, against the in-memory repository, walkable end to end with no
   backend.
5. Supabase repository + container wiring.
6. Assignment: `bookable_times`, `choose_time`'s assignment under the capacity
   lock, and every "nothing qualifies" path in §5, with the capacity-race
   test.
7. Seed `--pair` and `--respond`, then two-device testing.

Steps 1–6 are testable on one device. Step 7 is what needs two people.

---

## 9. Still open — decide before step 6

1. **Does the admin still book the table once the café is assigned?** The
   mockups say "both participants and the admin have been notified", which
   suggests staff act afterwards. If so, `meets.status` stays `pending` until
   staff confirm, and the app must say so rather than implying a held table.
2. **When does the member learn which café?** On the confirmation screen, or
   later with the admin's confirmation. The mockups do not show a café
   anywhere; the answer depends on question 1. See §5.
3. **Is distance an assignment input at launch?** Without it, the v1 order can
   send two people across the city to a café far from both of them, and they
   have no way to choose another. §6 is the design if the answer is yes.
4. **Expiry.** A negotiation nobody finishes should not sit open forever.
   Recommend 14 days, then auto-cancel with a notification.
5. **Café discovery (§5).** The curated partner list is not optional and is
   the only assignment source. Whether to add OSM or Places discovery for a
   map view is a product call.

**Must be resolved before launch, not a decision:** the real Pune business
names in `src/shared/constants/seedData.ts` (§5).

Decided: the timezone is the café's (§2). The café is assigned by the server,
not chosen (§5). Member location, if it comes, is a server-side input only and
is never shown (§6).
