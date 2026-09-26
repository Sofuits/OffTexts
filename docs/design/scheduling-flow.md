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

**The members agree the day and the time. Staff choose the café**, afterwards,
in the admin portal (§5). Nothing about a venue appears anywhere in the
member's flow.

### One meaning for "confirmed"

**Confirmed means a table is booked**, and nothing else — `meets.status =
'confirmed'`, set when staff assign a café (§7). The members reaching the same
day and time is **agreed**: the session's stage is `agreed`, and the meeting it
creates is `pending` until staff book a table. No screen, stage, column or
function in this flow says "confirmed" for anything short of a booked table.

### The table that looks like it would help, and does not

`public.availability` exists, but it holds **recurring weekly windows** —
"most Tuesdays I'm free 6–9pm" — scoped to a member, not to a meeting. Its own
comment says so. It feeds the matching algorithm. **Leave it alone.** It
answers a different question, and conflating the two will break matching.

---

## 1. The flow

Exactly the ten mockup steps. There is no café screen, and no screen names a
café.

| #   | Screen              | What it does                                                                                                                                                                                                                                                                                          |
| --- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **SchedulingStart** | From a match. Explains the steps. The mockup puts a heart between the two avatars — use the café cup instead. Offtexts serves four purposes; only one is romantic.                                                                                                                                    |
| 2   | **SelectDates**     | Month calendar, multi-select, spanning weeks or months. Chips below for what is picked.                                                                                                                                                                                                               |
| 3   | **SharedDates**     | Two-column table, you and them. Green row = both free. Your own column stays editable.                                                                                                                                                                                                                |
| 4   | **ChooseDay**       | Radio list of the overlap only.                                                                                                                                                                                                                                                                       |
| 5   | **DayChosen**       | The chosen day, with a "Change" affordance. The mockup's "Friday, Oct 9 is confirmed!" becomes "…is chosen" — nothing is confirmed yet (§0).                                                                                                                                                          |
| 6   | **SelectTimes**     | Slot list for the chosen day, multi-select, the city's timezone shown. **Only start times at which at least one partner café in the city is open for the whole meeting** (§4, `bookable_times`).                                                                                                      |
| 7   | **SharedTimes**     | Same two-column table, for times.                                                                                                                                                                                                                                                                     |
| 8   | **ChooseTime**      | Radio list of the overlap. **Choosing settles the day and time**: the session becomes `agreed` and the meeting is created. No café is chosen or assigned here (§4, `choose_time`).                                                                                                                    |
| 9   | **Agreed**          | The day and time are agreed and the meeting exists. Both members and the admin are notified. The mockup's "Meeting confirmed!" must become wording that does not say confirmed — e.g. "It's agreed" — because no table is booked yet (§0). **No venue** — not a name, not "to be confirmed", nothing. |
| 10  | **EditScheduling**  | Edit dates · edit times · cancel.                                                                                                                                                                                                                                                                     |

Steps 3 and 7 are the same component with different data. Steps 4 and 8 are
the same component. Build two, use them twice.

---

## 2. Schema — migration 0012

```sql
create type public.scheduling_stage as enum
  ('dates', 'times', 'agreed', 'cancelled');

create table public.scheduling_sessions (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches (id) on delete cascade,
  stage       public.scheduling_stage not null default 'dates',

  chosen_date       date,
  chosen_starts_at  time,
  chosen_ends_at    time,

  -- Set only on agreement. The meeting is the output of this negotiation.
  -- The café is not here: staff set it on the meeting (meets.cafe_id), which
  -- is the one place it lives (§5, §7).
  meet_id           uuid references public.meets (id) on delete set null,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  agreed_at    timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,

  -- Agreed means the day and the time are settled and the meeting exists.
  -- It does NOT mean a café or a booked table: those come later, from staff,
  -- on the meeting — and only then is anything "confirmed" (§0).
  constraint scheduling_agreed_has_everything check (
    (stage <> 'agreed') or
    (chosen_date is not null and chosen_starts_at is not null
     and meet_id is not null and agreed_at is not null)
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

Times are stored as `time`, not `timestamptz`, because a slot means "9am in the
city where they will meet". `meets.scheduled_for` becomes the absolute instant
at agreement.

### A meeting with no café: nothing to change on `meets`

`meets.cafe_id` is **already nullable** — migration 0007 added it without
`not null`, because rows booked before the cafés table existed have none. A
meeting created with no café is therefore valid today, and needs **no
migration against `meets`**:

- `venue_name` is `not null default 'To be confirmed'`, and `venue_area`
  defaults to `''`. The `meets_sync_venue` trigger only overwrites them when
  `cafe_id` is set, so a café-less meeting keeps those defaults until staff
  set one.
- `request_meeting` inserts whatever `p_cafe_id` it is given, including null.

The only constraint that assumed a café was this document's own session
constraint, now `scheduling_agreed_has_everything`. It lives in migration 0012, which is
not written yet, so the change is to 0012 as specified above — not a separate
migration. The session no longer has a `cafe_id` at all: one café per meeting,
kept on the meeting.

**`api_v1.meetings` still returns `venue_name`**, which for a café-less meeting
reads "To be confirmed". The app must not render it — see §7.

### The timezone

The instant is built when the day and time are agreed, before any café is
chosen, so it cannot come from a café. It comes from the city:

```sql
alter table public.cafes
  add column timezone text not null default 'Asia/Kolkata';
```

A `CHECK` cannot query `pg_timezone_names`, so a `before insert or update of
timezone` trigger rejects a name Postgres does not know. **An assertion fails
if the active partner cafés in one city disagree on their timezone**; given
that, "the city's zone" is well defined, and `choose_time` builds the instant
as `(chosen_date + chosen_starts_at) at time zone <the city's zone>`. Staff
may only assign a café in that city (§7), so the instant stays right once a
café is set.

The members' own timezone is irrelevant. SelectTimes shows the city's zone as
a label (e.g. "IST") and offers no choice.

### No location columns

The app does not collect member location (§6). `profiles` must never gain
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
date, chosen time and agreement are set by the functions in §4 and by
nothing else — two clients can reach the same slot within the same second, and
a read-then-write would create two meetings or none. Grant `select` only; the
functions that write sessions are `security definer` for exactly that reason.

### Hardening the security definer functions

They run with the owner's rights and bypass RLS, which makes them the main
privilege-escalation surface in the project. Every one of them:

- `set search_path = ''`, with every name schema-qualified.
- `revoke execute … from public, anon;` then `grant execute … to authenticated;`.
  Postgres grants EXECUTE to PUBLIC on every new function by default, and anon
  inherits it through PUBLIC, so the revoke is not optional.
- Its own authorisation check, trusting no argument. The caller is
  `auth.uid()` and nothing else. For member functions the members are derived
  from the session's match, never passed in: the session is loaded
  `for update`, joined to an **active** match the caller is in, and a miss
  raises the same error whether the session does not exist or is someone
  else's — saying which would leak that it exists. For the staff function
  (§7) the check is `public.is_staff()`.

```sql
-- The shape every member definer function in §4 follows.
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

  -- … stage and rule checks, then create the meeting with no café …
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
- Every member definer function refuses a session id from somebody else's
  match. The staff function refuses anyone who is not staff.
- Two concurrent `choose_time` calls on one session produce **one** meeting.
- `choose_time` creates a meeting with `cafe_id` null, and the session reaches
  `agreed` without one — the session constraint does not require it.
- `bookable_times` never returns a start time at which no active partner café
  in the city is open for the whole meeting.
- `reopen_scheduling` deletes **both** members' time options.
- The staff assignment (§7) refuses a café that is not active, not in the
  meeting's city, not open for the whole meeting, or full at that slot.
- **Assertion:** active partner cafés in one city share one timezone.
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

| Function                                               |     | Does                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------ | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start_scheduling(p_match_id uuid) → uuid`             | D   | Creates the session, or returns the live one. Refuses if the caller is not in an active match, or if the two members have no shared city with an active partner café (§5).                                                                                                                                           |
| `set_date_options(p_session_id uuid, p_dates date[])`  | I   | Replaces the caller's dates in one statement. Only while the stage is `dates`.                                                                                                                                                                                                                                       |
| `choose_date(p_session_id uuid, p_date date)`          | D   | Only if both members marked it. Sets `chosen_date`, stage → `times`.                                                                                                                                                                                                                                                 |
| `bookable_times(p_session_id uuid) → setof time`       | I   | The start times on `chosen_date` at which at least one active partner café in the shared city is open for the whole meeting. **Opening hours only** — no capacity: nothing is claimed at scheduling time. Invoker: café hours are already readable, and a member can read their own session.                         |
| `set_time_options(p_session_id uuid, p_starts time[])` | I   | Replaces the caller's times. Only while the stage is `times`.                                                                                                                                                                                                                                                        |
| `choose_time(p_session_id uuid, p_starts time) → uuid` | D   | **Terminal.** Only if both members marked the time, and it is still in `bookable_times`. Builds the instant in the city's zone (§2); runs the `request_meeting` logic **with no café**; sets the time and `meet_id`; stage → `agreed`; notifies both members and staff. Returns the meeting id. **Assigns nothing.** |
| `reopen_scheduling(p_session_id uuid)`                 | D   | Step 10, "Edit dates". From `times` back to `dates`: clears `chosen_date` **and deletes both members' time options**. Refused once agreed. ("Edit times" needs no function: at `times`, a member edits their options with `set_time_options`.)                                                                       |
| `cancel_scheduling(p_session_id uuid, p_reason text)`  | D   | Either member. Stage → `cancelled`. If the session was agreed, cancels its meeting too, and with it any café staff had set.                                                                                                                                                                                          |

`set_date_options`, `set_time_options` and `bookable_times` stay invoker: they
only touch the caller's own rows or data every member may already read.
Everything that writes a session, deletes the other member's rows, creates a
meeting or notifies somebody else is definer, because a member has none of
those rights directly.

**Concurrency.** `choose_time` holds the session row `for update` from the
membership check to the end and re-checks `stage = 'times'` after taking the
lock; the second of two simultaneous calls waits, sees `agreed`, and
returns the existing `meet_id` rather than creating another.

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

## 5. The café is chosen by staff

Members never choose the café, and the app never assigns one. When the members
agree a day and a time, `choose_time` creates the meeting **with no café**.
Staff then choose one in the admin portal (§7). There is no assignment
algorithm: no ranking, no preferred area, no distance.

### What scheduling still checks

Only that the meeting could be hosted at all:

- **A shared city.** The two members' `profiles.city`, compared
  case-insensitively after trimming, must be the same, and it must have at
  least one active partner café. Otherwise `start_scheduling` refuses, and the
  match screen says scheduling is not available there yet — two people should
  not spend five steps agreeing a time nobody can host.
- **Opening hours.** Step 6 offers only start times at which at least one
  active partner café in that city is open for the whole meeting
  (`bookable_times`), and `choose_time` re-checks the chosen one.

**Capacity is not checked at scheduling time.** No table is claimed when the
members agree a time — nothing is held until staff choose a café — so there is
nothing to count. Capacity matters at the moment staff assign a café, and is
checked there (§7).

If `bookable_times` returns nothing for the chosen day, SelectTimes says no
partner café is open then and offers "Change date" (`reopen_scheduling`).

### What the member sees

**Nothing about a venue, anywhere in the member's flow:** not step 9, not Meet
details, not the Meets tab — not a café name, not an area, not "to be
confirmed". **The app never shows the café.** Once staff have chosen one, staff
tell the two members where to go, outside the app (§9).

### Where cafés come from

Two different things, repeatedly conflated. Keep them apart.

1. **Partner cafés — `public.cafes`.** Businesses that have agreed to hold a
   table. This is the only list staff may choose from, because the app tells
   members "We hold the table and tell them — there is nothing to message."
   That promise is false at any café that has not agreed to it. This list is
   curated by business development and arrives through the admin portal. It is
   small, and it should be.

2. **Nearby-café discovery — optional, for a map view only.** If the product
   wants to show what is around, the legitimate sources are:
   - **OpenStreetMap via the Overpass API** — open data, free, ODbL licensed.
     Requires attribution and share-alike on derived databases. Sufficient for
     distance, geocoding and "what cafés exist near here".
   - **Google Places API** — licensed and paid. Gives photos and ratings.
     Caching is restricted: place IDs may be stored indefinitely, most other
     content may not be retained beyond the terms' limit.

   Neither is ever a source staff choose from.

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
demo, screenshot and review build, and what an admin portal built against the
same in-memory data would offer staff to choose from.

A demo that tells two people — or a member of staff — that a meeting is at
Pagdandi names a business that has not agreed to hold a table and has never
heard of Offtexts. **Replace them with obviously fictional names and addresses
before launch** — the Supabase demo seed (`scripts/seed-demo.mjs`) already
does this: every name ends "(demo)" and every address says it is not real.

---

## 6. Location — not collected

The app collects no member location. Staff choose the café (§5), so there is
no algorithm that could use one, and no screen that would show one.

If that ever changes, the constraints already established stand: never on
`profiles` (§2), never readable by another member, rounded to about 1 km
before it leaves the phone, and never exposed through `api_v1`. Design it
then, against whatever is using it.

---

## 7. App layer

- **Domain:** `SchedulingSession`, `DateOption`, `TimeOption` and
  `SchedulingStage` in `domain/entities/Scheduling.ts`. A
  `SchedulingRepository` interface with one method per RPC. A use case only if
  a rule lives above the repository — if it is a pass-through, do not create
  one (see `domain/usecases/index.ts`).
- **Data:** `SupabaseSchedulingRepository`, and an
  `InMemorySchedulingRepository` with a fake second member who marks a
  plausible overlap, creating meetings with no café, so the whole flow is
  walkable with no backend. Mapper, container wiring. Weekdays from the API
  are ISO (7 = Sunday); convert as `toVenue` does.
- **Presentation:** the screens in §1, `useScheduling*` query hooks, and
  invalidation of `queryKeys.matching.matches()` and `queryKeys.meets.all`
  when the session is agreed.
- **App task — the "To be confirmed" leak. A change to existing screens, and it
  lands with phase 2.** `api_v1.meetings` returns `venue_name` for every
  meeting, and for a café-less one that is the column default, "To be
  confirmed". The Upcoming cards on the Meets tab (`MeetListItem`) and Meet
  details render `venueName` / `venueArea` today, so the first meeting phase 2
  creates would show members exactly the venue field this document removes.
  **Both screens drop the venue row entirely** — not hidden when empty, gone —
  in the same release as phase 2, not after it. Not new work: it is removing a
  row from two screens that already exist.
- **Replaces the preview:** `feature/availability-calendar` has steps 1–5 as a
  placeholder (`DateSharingRepository`, which invents the other member's
  dates). Phase 2 replaces that repository with `SchedulingRepository`, moves
  the intersection to `api_v1.scheduling_grid`, and removes the placeholder
  notice and the production gate.
- **Replaced:** `RequestMeetScreen.tsx` and its test. Restyle it during the UI
  rebuild so it is not the one ugly screen, but do not invest in it.

### Admin portal — blocking

**No meeting can happen until staff set its café.** The admin portal (separate
repo) is therefore a dependency of phase 2, not a follow-up. It needs:

- **A queue of agreed meetings with no café** — `meets` where
  `cafe_id is null` and `status = 'pending'`, earliest `scheduled_for` first,
  with the city, the local date and time, and the two members. A staff-only
  view in `api_v1`, `security_invoker`, following `api_v1.staff_meetings`.
- **A way to assign a café** — `api_v1.staff_assign_cafe(p_meet_id uuid,
p_cafe_id uuid)`, security definer, hardened as in §3 with `public.is_staff()`
  as its check. It refuses a café that is not active, not in the meeting's
  city, not open for the whole meeting, or already at its
  `concurrent_meet_capacity` for that slot — **this is where capacity is
  checked**, under a lock on the café's row so two staff members cannot fill
  the same last table. It sets `meets.cafe_id` (the `meets_sync_venue` trigger
  fills `venue_name` and `venue_area`) and moves the meeting to `confirmed`
  with `confirmed_at` — the one place in the whole flow where anything becomes
  confirmed, because this is where a table is booked (§0).
- **A way out** when no café can take it: staff cancel the meeting with a
  reason, which notifies both members.
- The app **does not** tell members the café. Staff do, outside it (§9).

### Seed support

Extend `scripts/seed-demo.mjs`. Everything keeps the `5eed0000-` prefix and
stays covered by `--remove` and its self-check.

- **`--pair <emailA> <emailB>`** puts each account in the other's candidate
  set for today, with no likes pre-created, so two real people can genuinely
  decide. There is one set per member per day, so this **adds to an existing
  set** (the demo seed's, if it ran today) rather than creating a second one;
  it refuses to touch a set the seed did not create, as the member seed
  already does.
- **`--respond`** makes the demo members in a live session mark plausible
  date and time options, so the shared grid has something in it without a
  second phone. A session only exists once a real member starts one, so this is
  re-run after tapping "start". **Build it only when the flow exists to respond
  to.**

`--remove` needs nothing new for sessions: they hold no café, and those of
matches with seeded members cascade with the members. Meetings at seeded cafés
it already clears.

---

## 8. Build order

1. Migration 0012 + RLS + assertions. Nothing else starts until the tests for
   "outside the match sees nothing" pass.
2. `api_v1` functions and the two views, with the definer hardening and its
   assertion.
3. Domain entities + repository interface + in-memory implementation.
4. Screens, against the in-memory repository, walkable end to end with no
   backend — and the venue fields removed from the Meets tab and Meet details.
5. Supabase repository + container wiring.
6. Seed `--pair` and `--respond`, then two-device testing.

In parallel, and required before any real meeting: **the admin portal's queue
and `staff_assign_cafe`** (§7).

Steps 1–5 are testable on one device. Step 6 is what needs two people.

---

## 9. Still open

1. **Expiry.** A negotiation nobody finishes should not sit open forever.
   Recommend 14 days, then auto-cancel with a notification. The same question
   applies to an agreed meeting staff never assign a café to.
2. **Café discovery (§5).** The curated partner list is the only source staff
   choose from. Whether to add OSM or Places discovery for a map view is a
   product call.

**Dependency, not a nice-to-have: the admin portal.** No meeting can happen
until staff set its café; the queue and `staff_assign_cafe` (§7) are required
before phase 2 can go live.

**Must be resolved before launch, not a decision:** the real Pune business
names in `src/shared/constants/seedData.ts` (§5).

### Decided

- **Staff choose the café**, after the members agree the day and time; the app
  assigns nothing (§5).
- **The app never shows the café, anywhere.** Staff tell the two members where
  to go, outside the app. If staff have no channel to reach members, that is an
  operational gap to close, not a question for this spec.
- **"Confirmed" means a table is booked.** The session stage is `agreed`; the
  meeting is `pending` until staff book (§0).
- **Timezone:** the city's, with an assertion that a city's partner cafés share
  one (§2).
- **Capacity** is checked when staff assign a café, under a lock on the café's
  row, not at scheduling time (§5, §7).
- **Staff can cancel** a meeting no café can take, with a reason; both members
  are notified (§7).
- **No member location** is collected (§6).
