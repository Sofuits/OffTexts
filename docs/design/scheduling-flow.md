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

### The table that looks like it would help, and does not

`public.availability` exists, but it holds **recurring weekly windows** —
"most Tuesdays I'm free 6–9pm" — scoped to a member, not to a meeting. Its own
comment says so. It feeds the matching algorithm. **Leave it alone.** It
answers a different question, and conflating the two will break matching.

---

## 1. The flow

| #   | Screen              | What it does                                                                                                                                                            |
| --- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **SchedulingStart** | From a match. Explains the five steps. The mockup puts a heart between the two avatars — use the café cup instead. Offtexts serves four purposes; only one is romantic. |
| 2   | **SelectDates**     | Month calendar, multi-select, spanning weeks or months. Chips below for what is picked.                                                                                 |
| 3   | **SharedDates**     | Two-column table, you and them. Green row = both free. Your own column stays editable.                                                                                  |
| 4   | **ChooseDay**       | Radio list of the overlap only.                                                                                                                                         |
| 5   | **DayConfirmed**    | Confirmation beat, with a "Change" affordance.                                                                                                                          |
| 6   | **SelectTimes**     | Slot list for the chosen day, multi-select, the café city's timezone shown. **Only times at which at least one partner café is open** — see §4, `choose_time`.          |
| 7   | **SharedTimes**     | Same two-column table, for times.                                                                                                                                       |
| 8   | **ChooseTime**      | Radio list of the overlap.                                                                                                                                              |
| 8.5 | **ChooseVenue**     | New — not in the mockups. See §5. Every partner café open at the agreed time, by area. One member picks; the other confirms or vetoes once.                             |
| 9   | **Confirmed**       | The meeting exists. Both members and the admin are notified.                                                                                                            |
| 10  | **EditScheduling**  | Edit dates · edit times · cancel, until confirmed.                                                                                                                      |

Steps 3 and 7 are the same component with different data. Steps 4 and 8 are
the same component. Build two, use them twice.

---

## 2. Schema — migration 0011

```sql
create type public.scheduling_stage as enum
  ('dates', 'times', 'venue', 'confirmed', 'cancelled');

create table public.scheduling_sessions (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches (id) on delete cascade,
  stage       public.scheduling_stage not null default 'dates',

  chosen_date       date,
  chosen_starts_at  time,
  chosen_ends_at    time,
  -- Who chose the time. That member picks the café (§5).
  time_chosen_by    uuid references public.profiles (id) on delete set null,

  -- The café picked, awaiting the other member's confirmation or veto.
  cafe_id           uuid references public.cafes (id) on delete restrict,
  -- One veto per session. Once used, the next pick confirms directly.
  vetoed_cafe_id    uuid references public.cafes (id) on delete set null,

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
timezone` trigger rejects a name Postgres does not know. `choose_venue` builds
the instant as `(chosen_date + chosen_starts_at) at time zone cafes.timezone`.

The members' own timezone is irrelevant: the slot is when the café's doors are
open. SelectTimes shows the zone as a label (e.g. "IST") and offers no choice.

### No location columns in v1

Member location is deferred — see §6. Nothing is added to `profiles`, and
`profiles` must never gain location columns: its `select` policy lets any
signed-in member read every verified profile row, and the app reads it with
`select('*')`. RLS is per row, not per column, so a column there is readable by
everyone who can see the profile.

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
returns void
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

  -- … stage and rule checks, then the write …
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
- Confirming the same slot twice — two concurrent `confirm_venue` calls —
  produces **one** meeting.
- `reopen_scheduling(…, 'dates')` deletes **both** members' time options.
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

| Function                                                             |     | Does                                                                                                                                                                                                                           |
| -------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `start_scheduling(p_match_id uuid) → uuid`                           | D   | Creates the session, or returns the live one. Refuses if the caller is not in an active match.                                                                                                                                 |
| `set_date_options(p_session_id uuid, p_dates date[])`                | I   | Replaces the caller's dates in one statement. Only while the stage is `dates`.                                                                                                                                                 |
| `choose_date(p_session_id uuid, p_date date)`                        | D   | Only if both members marked it. Sets `chosen_date`, stage → `times`.                                                                                                                                                           |
| `set_time_options(p_session_id uuid, p_starts time[])`               | I   | Replaces the caller's times. Only while the stage is `times`.                                                                                                                                                                  |
| `choose_time(p_session_id uuid, p_starts time)`                      | D   | Only if both marked it **and at least one active partner café is open for the whole meeting then** (café's ISO weekday via `extract(isodow …)`, its hours, its capacity). Sets the time and `time_chosen_by`, stage → `venue`. |
| `suggest_venues(p_session_id uuid) → setof …`                        | I   | Every active partner café open for the whole meeting at the agreed date and time with capacity left, excluding `vetoed_cafe_id`, ordered by area then name. No distance.                                                       |
| `choose_venue(p_session_id uuid, p_cafe_id uuid)`                    | D   | Only the member in `time_chosen_by`. Checks the café is still open and has capacity then. Before a veto: sets `cafe_id`, awaiting the other member. After a veto: confirms directly, as `confirm_venue` does.                  |
| `confirm_venue(p_session_id uuid)`                                   | D   | Only the other member, only with a café picked. Builds the instant in the café's `timezone`, runs the `request_meeting` logic, writes `meet_id`, stage → `confirmed`, notifies both members and staff.                         |
| `veto_venue(p_session_id uuid)`                                      | D   | Only the other member, only while `vetoed_cafe_id` is null. Moves `cafe_id` to `vetoed_cafe_id` and clears it; the chooser picks again from the rest.                                                                          |
| `reopen_scheduling(p_session_id uuid, p_to public.scheduling_stage)` | D   | Step 10. Clears the later choices. To `dates`: clears the chosen date, time and café **and deletes both members' time options**. To `times`: clears the time and café, keeps the time options. Refused once confirmed.         |
| `cancel_scheduling(p_session_id uuid, p_reason text)`                | D   | Either member. Stage → `cancelled`.                                                                                                                                                                                            |

`set_date_options` and `set_time_options` stay invoker: they only write the
caller's own option rows, which RLS already scopes. Everything that writes a
session, deletes the other member's rows, creates a meeting or notifies
somebody else is definer, because a member has none of those rights directly.

**Concurrency.** `confirm_venue` holds the session row `for update` from the
membership check to the end, re-checks `stage = 'venue'` after taking the
lock, and only then creates the meeting. The second of two simultaneous calls
waits, sees `confirmed`, and returns the existing `meet_id` rather than
creating another.

Views, both `security_invoker`:

- `api_v1.my_scheduling_sessions` — the session for each of my active
  matches, with the other member resolved.
- `api_v1.scheduling_grid` — one row per (session, date-or-time, mine,
  theirs, both). Steps 3 and 7 render this directly. **Do not make the phone
  compute the intersection from two lists**; that is a correctness problem
  disguised as a UI problem.

Keep `api_v1.request_meeting`. `confirm_venue` uses its logic. The direct-booking
path stays available for staff and for a future "arrange without negotiating".

---

## 5. Café selection

The mockups have no café step: step 9 confirms the meeting straight after the
time. A café step has to go somewhere, and making it a third negotiation
round would triple the back-and-forth for the least contentious choice.

### The design for v1 — no location

After the time is agreed, `suggest_venues` returns **every partner café open
for the whole meeting at that date and time**, with capacity left, **sorted by
area, then name**. The member who chose the time picks one. The other member
sees it and either confirms or **vetoes once**; a veto excludes that café and
the chooser picks again, and that second pick confirms directly. No third
round.

The time step already guaranteed at least one café is open (`choose_time`), so
this list is never empty unless a café closed or filled up in between — in
which case the screen says so and offers "Change the time" (reopen to `times`).

The app reuses `hoursOn()` and `startTimesOn()` in
`src/domain/entities/Venue.ts` — already written, already tested — for
SelectTimes: the slot list is the union of `startTimesOn()` across the city's
partner cafés on the chosen day, so members are never offered a time nobody
can host. The server re-checks in `choose_time`; the client list is a
convenience, not the rule.

### Why no location in v1

With ten to twenty partner cafés in one city, distance ranking buys very
little. Members know their own city: a list grouped by area — Baner, Kalyani
Nagar, Koregaon Park — is something both can judge at a glance. Against that,
location costs a permission
prompt, a new table, a leak surface on the most sensitive data the product
would hold, and most of the open design questions (city-centre coordinates,
coordinate types, the no-permission fallback, the privacy assertions).

What is lost is automatic fairness: nothing stops the chooser picking a café
on their own side of town. The veto is the counterweight, and it is cheap.

**Revisit when** the catalogue grows past roughly forty cafés, spans more
than one city, or the veto rate shows members are regularly picking unfairly.
The design for that is §6, and nothing in v1 makes it harder to add.

### Where cafés come from

Two different things, repeatedly conflated. Keep them apart.

1. **Partner cafés — `public.cafes`.** Businesses that have agreed to hold a
   table. This is the only list a member can book from, because the app tells
   them "We hold the table and tell them — there is nothing to message." That
   promise is false at any café that has not agreed to it. This list is
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

**Do not scrape Google Maps.** The Google Maps Platform Terms of Service
prohibit extracting or exporting Maps content for use outside Google's
services, and that applies equally to a third-party scraping tool. Beyond the
licensing question, scraped businesses are not partners, so a member sent to
one arrives at a café that has never heard of Offtexts and has no table held.
If a scraping approach is proposed, say so and stop rather than implementing
it.

---

## 6. Location and fairness ranking — designed, not built

Kept here so it can be built later without re-deciding it. **None of this is
in v1.**

### Ranking

Rank by `max(distance to A, distance to B)` ascending, not by distance from the
midpoint. Minimising the worst journey is what "fair" means here; a midpoint
can sit in a place that is a long way from both. Show each member their own
distance only.

### Storage

Not on `profiles` — see §2. A separate table, readable only by its owner:

```sql
create table public.member_locations (
  member_id  uuid primary key references public.profiles (id) on delete cascade,
  -- Rounded to two decimals (~1 km) BEFORE it reaches the database.
  -- Same type as public.cafes.latitude/longitude.
  area_lat   numeric(9, 6) not null check (area_lat = round(area_lat, 2)),
  area_lng   numeric(9, 6) not null check (area_lng = round(area_lng, 2)),
  area_label text,          -- "Baner", shown to the member only
  updated_at timestamptz not null default now()
);
-- RLS: select, insert, update, delete where member_id = auth.uid(). Nothing else.
```

`suggest_venues` becomes `security definer` (hardened as in §3) to read both
members' rows, computes haversine distances in SQL — `public.cafes` uses plain
`numeric` coordinates, not PostGIS, and one extension for one distance
calculation is not worth the operational surface — and returns only the
caller's own distance per café.

### The rules

Members' locations are the most sensitive data this product will hold, and
this is a dating app among other things.

- Ask at the point of use, on the venue step, with a plain explanation — not
  at sign-up, and not as a blocking permission.
- Store area-level only. Round to roughly 1 km before it ever reaches the
  database. Precise coordinates are not stored, not logged, and not sent to
  the server.
- A member's location is never readable by the other member. Not the
  coordinates, not the area label, not a derived distance.
- Distances are computed server-side and only the caller's own distance to
  each café is returned.
- Refusing permission must not block booking. Fall back to the v1 list (§5).
- **Assertion** in `supabase/tests/assertions.sql`: no `api_v1` view selects
  from `member_locations`, and no column of it is granted to `authenticated`
  outside its own-row policy. The same class of guard as the card-data
  assertion.

---

## 7. App layer

- **Domain:** `SchedulingSession`, `DateOption`, `TimeOption`,
  `SchedulingStage`, `VenueSuggestion` in `domain/entities/Scheduling.ts`. A
  `SchedulingRepository` interface with one method per RPC. A use case only if
  a rule lives above the repository — if it is a pass-through, do not create
  one (see `domain/usecases/index.ts`).
- **Data:** `SupabaseSchedulingRepository`, `InMemorySchedulingRepository`
  with a fake second member who marks a plausible overlap and confirms the
  café, so the whole flow is walkable with no backend. Mapper, container
  wiring. Weekdays from the API are ISO (7 = Sunday); convert as
  `toVenue` does.
- **Presentation:** the screens in §1, `useScheduling*` query hooks, and
  invalidation of `queryKeys.matching.matches()` and `queryKeys.meets.all` on
  confirm.
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
  date and time options, and confirm the café when it is their turn, so the
  shared grid has something in it without a second phone. A session only
  exists once a real member starts one, so this is re-run after tapping
  "start". **Build it only when the flow exists to respond to.**

---

## 8. Build order

1. Migration 0011 + RLS + assertions. Nothing else starts until the tests for
   "outside the match sees nothing" pass.
2. `api_v1` functions and the two views, with the definer hardening and its
   assertion.
3. Domain entities + repository interface + in-memory implementation.
4. Screens, against the in-memory repository, walkable end to end with no
   backend.
5. Supabase repository + container wiring.
6. Venue step: the area-sorted list, choose, confirm, veto once.
7. Seed `--pair` and `--respond`, then two-device testing.

Steps 1–6 are testable on one device. Step 7 is what needs two people.

---

## 9. Still open — decide before step 6

1. **Does the admin still book the table once members have chosen the café?**
   The mockups say "both participants and the admin have been notified", which
   suggests staff act afterwards. If so, `meets.status` stays `pending` until
   staff confirm, and the app must say so rather than implying a held table.
2. **Expiry.** A negotiation nobody finishes should not sit open forever.
   Recommend 14 days, then auto-cancel with a notification.
3. **Café sourcing (§5).** The curated partner list is not optional. Whether to
   add OSM or Places discovery on top is a product call.

Decided since the first draft: the timezone is the café's (§2); member
location is deferred to §6, with the v1 venue step working without it (§5).
