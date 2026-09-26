# Offtexts — mutual scheduling flow

**Phase 2. Do not build this during the UI rebuild.**

Reference mockups: `docs/design/offtexts-flow/` (ten steps, already drawn and
already on-brand — they are also the source of the palette in
`ui-rebuild-brief.md`).

This document exists because the flow in those mockups is **not what the app
currently does**, and the difference is a migration, not a restyle.

---

## 1. What changes, and why it is not a UI task

**Today (built and working):** one member picks a café, a day and a time, and
sends a request. The other accepts or declines. `RequestMeetScreen.tsx` →
`api_v1.request_meeting(match, cafe, when)` → a `meets` row at `pending`.

**Wanted:** both members independently mark the dates they are free; each sees
the other's marks in a shared table; they pick a day from the overlap; the same
again for times; the meeting confirms when both land on the same slot.

That is a **negotiation**, not a proposal. It needs state that does not exist:
per-session, per-member, per-date and per-time selections that **both members
can read**. Nothing in the schema holds that today.

### The table that looks like it would help, and does not

`public.availability` exists, but it is **recurring weekly windows** — "most
Tuesdays I'm free 6–9pm" — scoped to a member, not to a meeting. Its comment
says so explicitly. It feeds the matching algorithm. **Leave it alone**; it is
answering a different question and the two must not be conflated.

---

## 2. The flow, with the venue step inserted

The mockups have no café step. The product owner has confirmed **members pick
the café**, so it has to go somewhere.

**Recommended: after the time is agreed, before confirmation.** The café is
then filtered to those actually open at the agreed time, which reuses
`hoursOn()` and `startTimesOn()` in `src/domain/entities/Venue.ts` — already
written and covered by tests — rather than throwing them away.

The alternative is café-first, which constrains the date grid to that café's
opening days. It is defensible and it makes the negotiation three-dimensional.
Ask before choosing it.

| #       | Screen            | What it does                                                  |
| ------- | ----------------- | ------------------------------------------------------------- |
| 1       | `SchedulingStart` | From a match. Explains the five steps. "Find a time to meet." |
| 2       | `SelectDates`     | Month calendar, multi-select. Chips below for what is picked. |
| 3       | `SharedDates`     | Two-column table, you and them. Green row = both free.        |
| 4       | `ChooseDay`       | Radio list of the **overlap only**.                           |
| 5       | `DayConfirmed`    | Confirmation beat, with a "Change" affordance.                |
| 6       | `SelectTimes`     | Slot list for the chosen day, multi-select, timezone shown.   |
| 7       | `SharedTimes`     | Same two-column table, for times.                             |
| 8       | `ChooseTime`      | Radio list of the overlap.                                    |
| **8.5** | `ChooseVenue`     | **New.** Partner cafés open at that time, in the shared city. |
| 9       | `Confirmed`       | The meeting exists. Both members and the admin are notified.  |
| 10      | `EditScheduling`  | Edit dates · edit times · cancel, until confirmed.            |

Steps 3 and 7 are the same component with different data. Steps 4 and 8 are the
same component. Build two, use them twice.

---

## 3. Schema — migration `0011`

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

---

## 4. Row Level Security — the part to get right

This is the **first place in the product where one member reads another
member's rows.** Everywhere else that is forbidden. Here it is the feature. So
scope it precisely: a member may read the other member's options **only for a
session belonging to a match they are in**, and may write **only their own**.

```sql
alter table public.scheduling_sessions      enable row level security;
alter table public.scheduling_date_options  enable row level security;
alter table public.scheduling_time_options  enable row level security;
alter table public.scheduling_sessions      force row level security;
alter table public.scheduling_date_options  force row level security;
alter table public.scheduling_time_options  force row level security;

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

create policy "sessions: read own match" on public.scheduling_sessions
  for select to authenticated using (public.in_session(id) or public.is_staff());

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

**No client-side UPDATE on `scheduling_sessions`.** The stage, the chosen date,
the chosen time and the confirmation are set by the RPCs in §5 and by nothing
else, because two clients can reach the same slot within the same second and a
read-then-write would confirm twice or not at all. Grant `select` only.

Add the structural assertions to `supabase/tests/assertions.sql` and behaviour
tests to `behaviour.sql` — in particular: **a member outside the match sees
nothing**, and **a member inside the match cannot write the other's rows**.

---

## 5. `api_v1` contract additions

All `security invoker`, all `set search_path = ''`.

| Function                                               | Does                                                                                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start_scheduling(p_match_id uuid) → uuid`             | Creates the session, or returns the live one. Refuses if the caller is not in an active match.                                                    |
| `set_date_options(p_session_id uuid, p_dates date[])`  | Replaces the caller's dates in one statement.                                                                                                     |
| `choose_date(p_session_id uuid, p_date date)`          | Only if **both** members marked it. Sets `chosen_date`, stage → `times`.                                                                          |
| `set_time_options(p_session_id uuid, p_starts time[])` | Replaces the caller's times.                                                                                                                      |
| `choose_time(p_session_id uuid, p_starts time)`        | Only if both marked it. Sets the time, stage → `venue`.                                                                                           |
| `choose_venue(p_session_id uuid, p_cafe_id uuid)`      | Checks the café is open then, calls the existing `request_meeting` logic, writes `meet_id`, stage → `confirmed`, notifies both members and staff. |
| `reopen_scheduling(p_session_id uuid, p_to stage)`     | Step 10. Clears the later choices. Refused once `confirmed`.                                                                                      |
| `cancel_scheduling(p_session_id uuid, p_reason text)`  | Either member. Stage → `cancelled`.                                                                                                               |

Views, both `security_invoker`:

- `api_v1.my_scheduling_sessions` — the session for each of my active matches,
  with the other member resolved.
- `api_v1.scheduling_grid` — one row per (session, date-or-time, mine, theirs,
  both). This is what steps 3 and 7 render directly; do not make the phone
  compute the intersection from two lists.

**Keep `api_v1.request_meeting`.** `choose_venue` uses it. The direct-booking
path stays available for staff and for a future "arrange without negotiating".

---

## 6. App layer

- **Domain:** `SchedulingSession`, `DateOption`, `TimeOption`, `SchedulingStage`
  in `domain/entities/Scheduling.ts`. A `SchedulingRepository` interface with
  one method per RPC. A `ChooseSlot` use case only if a rule lives above the
  repository — if it is a pass-through, do not create one (see
  `domain/usecases/index.ts`).
- **Data:** `SupabaseSchedulingRepository`, `InMemorySchedulingRepository`
  (with a fake second member who marks a plausible overlap, so the whole flow
  is walkable with no backend), mapper, container wiring.
- **Presentation:** the screens in §2, `useScheduling*` query hooks, and
  invalidation of `queryKeys.matching.matches()` and `queryKeys.meets.all` on
  confirm.
- **Replaced:** `RequestMeetScreen.tsx` and its test. Restyle it during the
  rebuild, but do not invest in it.
- **Admin portal:** a confirmed meeting needs a staff view. Separate repo.

---

## 7. Product decisions still open

1. **Café first or café last** (§2). Recommended: last, filtered to open cafés.
2. **Does the admin still book the table** once members have chosen the café?
   The mockups say "both participants and the admin have been notified", which
   suggests staff act afterwards. If so, `meets.status` stays `pending` until
   staff confirm, and the app should say so rather than implying a held table.
3. **Expiry.** A negotiation nobody finishes should not sit open forever.
   Recommend 14 days, then auto-cancel with a notification.
4. **Timezones.** The mockups show an `IST` selector. The database stores
   `time` against the café's local day; if members can genuinely be in different
   zones, the selector needs to mean something. Simplest honest answer: both
   members and the café are in one city, so display the city's zone and do not
   offer a choice.
