-- =============================================================================
-- Offtexts — safety cases, notifications, audit
-- =============================================================================
-- The three domains that exist for when something goes wrong: a member reports
-- another, the product needs to tell somebody something, and afterwards
-- somebody needs to be able to reconstruct who did what.
--
-- A NOTE ON DELETION, WHICH RUNS THROUGH ALL THREE
-- Everywhere else in this schema, deleting a member deletes their data. Here
-- it deliberately does not. A safety report has to outlive the account that
-- filed it, or deleting your account becomes a way to erase the complaint
-- against you. The audit log has no foreign keys at all for the same reason:
-- a log that can be deleted by the person it incriminates is not a log.
-- =============================================================================


-- ----------------------------------------------------------------- enums ----

create type report_category as enum (
  'harassment',
  'safety',                 -- felt unsafe, was followed, was pressured to leave
  'fake_profile',
  'inappropriate_content',
  'no_show',
  'spam',
  'other'
);

-- Assessed by staff, not by the reporter. Someone filing a report is in no
-- position to triage it, and asking them to rate their own distress is both
-- unkind and useless.
create type report_severity as enum ('low', 'medium', 'high', 'critical');

create type report_status as enum ('open', 'investigating', 'actioned', 'dismissed');

create type notification_kind as enum (
  'new_candidates',
  'new_match',
  'meet_requested',
  'meet_confirmed',
  'meet_cancelled',
  'meet_reminder',
  'review_requested',
  'payment_receipt',
  'payment_failed',
  'photo_approved',
  'photo_rejected',
  'verification_approved',
  'verification_rejected',
  'safety_update'
);

create type device_platform as enum ('ios', 'android', 'web');


-- --------------------------------------------------------------- reports ----

create table public.reports (
  id uuid primary key default gen_random_uuid(),

  -- NULLABLE and `on delete set null`, unlike almost every other member
  -- reference in this schema. If the reporter deletes their account the report
  -- must remain, or "delete your account" becomes a way to withdraw a
  -- complaint you no longer want investigated — or worse, a way for a
  -- compromised account to erase the evidence against its owner.
  reporter_id uuid references public.profiles (id) on delete set null,

  -- The subject cascades, because a report about a member who no longer
  -- exists has nobody to act against. If retention beyond that is ever
  -- required, this becomes `set null` plus a denormalised reference, the same
  -- treatment payments got.
  subject_id uuid not null references public.profiles (id) on delete cascade,

  -- Which meeting it relates to, when it relates to one.
  meet_id uuid references public.meets (id) on delete set null,

  category report_category not null,
  severity report_severity not null default 'medium',

  details text not null check (char_length(trim(details)) between 10 and 2000),

  status report_status not null default 'open',

  -- Staff, not members. `on delete set null` so removing someone's admin
  -- access does not delete the case they were handling — it unassigns it,
  -- which is what should happen and is visible in the queue.
  assigned_to uuid references public.staff (id) on delete set null,

  resolution text check (char_length(resolution) <= 2000),
  resolved_at timestamptz,
  resolved_by uuid references public.staff (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reports_not_self check (reporter_id is null or reporter_id <> subject_id),

  -- A case is closed exactly when it has been actioned or dismissed, and
  -- closing one requires writing down why. "Dismissed, no reason given" is
  -- the state this constraint exists to make impossible.
  constraint reports_closed_has_stamp check (
    (status in ('actioned', 'dismissed')) = (resolved_at is not null)
  ),
  constraint reports_closed_has_resolution check (
    resolved_at is null or char_length(trim(coalesce(resolution, ''))) >= 10
  )
);

comment on table public.reports is
  'Safety cases. Survives deletion of the reporter by design — see the reporter_id comment.';

create index reports_subject_idx on public.reports (subject_id, created_at desc);
create index reports_reporter_idx on public.reports (reporter_id);
create index reports_meet_idx on public.reports (meet_id);
create index reports_assigned_idx on public.reports (assigned_to);
create index reports_resolved_by_idx on public.reports (resolved_by);

-- The queue staff actually look at: open cases, worst first, oldest first.
create index reports_queue_idx
  on public.reports (severity desc, created_at)
  where status in ('open', 'investigating');

create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();


-- -------------------------------------------------------- report evidence ---

-- Screenshots and photographs attached to a case. In a PRIVATE bucket — see
-- 0009 — reached only through short-lived signed URLs. These are the most
-- sensitive objects the product will ever hold, and a public URL for one is
-- forever, because a signed URL that has been issued cannot be revoked by
-- tightening a policy afterwards.
create table public.report_evidence (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,

  storage_path text not null unique check (char_length(storage_path) between 3 and 500),

  -- No `url` column, unlike photos. Deliberately: there is no durable URL for
  -- a private object, and a column that looks like one invites somebody to
  -- store a signed URL in it and wonder why it stops working.
  content_type text not null check (
    content_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
  ),
  bytes int check (bytes > 0 and bytes <= 10485760),   -- 10 MB

  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index report_evidence_report_idx on public.report_evidence (report_id, created_at);
create index report_evidence_uploader_idx on public.report_evidence (uploaded_by);


-- --------------------------------------------------------- notifications ----

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,

  kind notification_kind not null,

  title text not null check (char_length(trim(title)) between 1 and 120),
  body text not null check (char_length(trim(body)) between 1 and 400),

  -- Where tapping it should go: {"screen":"Meet","meetId":"…"}. Deliberately
  -- loose, because the set of destinations changes with every release and a
  -- column per destination would be a migration per release.
  --
  -- It must never carry anything that is not already visible to the recipient.
  -- A notification payload is the easiest place in a system to accidentally
  -- leak, because it is the one object that gets copied to a third party — the
  -- push service — on its way to the device.
  data jsonb not null default '{}',

  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);

-- The badge count query, which runs on every app foreground. Partial, so the
-- index holds only unread rows and stays small however much history builds up.
create index notifications_unread_idx
  on public.notifications (recipient_id)
  where read_at is null;


-- ----------------------------------------------------------- push tokens ----

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,

  -- Unique across the whole table, not per member: one device has one token,
  -- and if it moves to a different account the token must move with it rather
  -- than existing twice and delivering one person's notifications to another.
  token text not null unique check (char_length(token) between 10 and 400),

  platform device_platform not null,

  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  -- Push services reject tokens that have expired or been uninstalled. Rather
  -- than delete the row, mark why: deleting it means the next app open
  -- recreates it and the same rejection happens forever.
  disabled_at timestamptz,
  disabled_reason text check (char_length(disabled_reason) <= 200),

  constraint push_tokens_disabled_has_reason check (
    (disabled_at is null) = (disabled_reason is null)
  )
);

create index push_tokens_member_idx on public.push_tokens (member_id) where disabled_at is null;


-- ------------------------------------------------------------- audit log ----

-- Append-only. No updates, no deletes, and — the important part — NO FOREIGN
-- KEYS.
--
-- Every other table here cascades on member deletion. If this one did, a
-- member could erase the record of their own behaviour by deleting their
-- account, and a staff member could erase the record of their own actions by
-- having their access revoked. The actor is stored as a bare uuid, so the row
-- survives whoever it describes.
--
-- The cost is that actor_id can point at nobody. That is the correct
-- trade-off for a log, and `actor_label` keeps it readable afterwards.
create table public.audit_log (
  id bigint generated always as identity primary key,

  actor_id uuid,
  actor_kind text not null check (actor_kind in ('member', 'staff', 'system')),

  -- Snapshotted at write time. Resolving a name from an id only works while
  -- the id still resolves, which for an audit log is precisely when it matters
  -- least.
  actor_label text,

  action text not null check (char_length(action) between 2 and 60),

  entity_table text not null check (char_length(entity_table) between 2 and 63),
  entity_id text,

  -- Only the keys that actually changed, not the whole row twice. A full
  -- before-and-after of every profile update would be most of the database
  -- again within a month, and the answer to "what changed" would still need
  -- computing at read time.
  --
  -- Named old_row/new_row rather than before/after: BEFORE and AFTER are
  -- trigger keywords, and a column called `before` is a quoting problem that
  -- surfaces in the one query written under time pressure.
  old_row jsonb,
  new_row jsonb,

  created_at timestamptz not null default now()
);

comment on table public.audit_log is
  'Append-only. No foreign keys, deliberately: the log must outlive whoever it describes.';

create index audit_log_entity_idx on public.audit_log (entity_table, entity_id, created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id, created_at desc);
create index audit_log_recent_idx on public.audit_log (created_at desc);


-- Writes an audit row for whatever table it is attached to.
--
-- One function for every audited table rather than one per table, because the
-- alternative is eight near-identical functions that drift. Which tables are
-- audited is decided by the CREATE TRIGGER statements below, and which columns
-- matter is decided by the `update of (...)` clause on each one — so the
-- policy lives in the trigger definitions, where it can be read at a glance.
create or replace function public.record_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  kind text;
  label text;
  old_json jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  new_json jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  diff_old jsonb;
  diff_new jsonb;
  entity text;
begin
  -- Who.
  if actor is null then
    kind := 'system';
  elsif exists (select 1 from public.staff s where s.id = actor) then
    kind := 'staff';
    select coalesce(st.note, st.role) into label from public.staff st where st.id = actor;
  else
    kind := 'member';
    select p.name into label from public.profiles p where p.id = actor;
  end if;

  -- What changed. On an update, only the differing keys; on an insert or a
  -- delete, the whole row, because that IS the change.
  if tg_op = 'UPDATE' then
    select
      jsonb_object_agg(key, old_json -> key),
      jsonb_object_agg(key, new_json -> key)
      into diff_old, diff_new
    from jsonb_object_keys(new_json) as k(key)
    where new_json -> key is distinct from old_json -> key;

    -- Nothing actually changed — a no-op update. Not worth a row.
    if diff_new is null then
      return null;
    end if;
  else
    diff_old := old_json;
    diff_new := new_json;
  end if;

  entity := coalesce(new_json ->> 'id', old_json ->> 'id');

  insert into public.audit_log
    (actor_id, actor_kind, actor_label, action, entity_table, entity_id, old_row, new_row)
  values
    (actor, kind, label, lower(tg_op), tg_table_name, entity, diff_old, diff_new);

  return null;
end;
$$;


-- WHICH TABLES ARE AUDITED, AND WHY EACH ONE
--
-- Not everything. An audit row costs a write on every change, and a log that
-- records everything is a log nobody reads. These five are the ones where the
-- question "who did this, and when" has a real answer that matters.

-- Who was given or lost admin access. The single most consequential change
-- anyone can make in this system.
create trigger staff_audit
  after insert or update or delete on public.staff
  for each row execute function public.record_audit();

-- Who was let into the discovery feed, or removed from it.
create trigger profiles_verification_audit
  after update of verification on public.profiles
  for each row execute function public.record_audit();

-- Safety cases: every status change, assignment and resolution.
create trigger reports_audit
  after insert or update on public.reports
  for each row execute function public.record_audit();

-- Money. Every state change, for reconciliation and for disputes.
create trigger payments_audit
  after insert or update on public.payments
  for each row execute function public.record_audit();

-- Partner terms and status, because these are commercial commitments.
create trigger cafes_audit
  after insert or update or delete on public.cafes
  for each row execute function public.record_audit();
