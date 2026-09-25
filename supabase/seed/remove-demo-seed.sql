-- =============================================================================
-- Removes every database row the demo seed created. One statement.
-- =============================================================================
-- scripts/seed-demo.mjs marks everything it creates with the id prefix
-- `5eed0000-`: seeded users are created with chosen ids, and their photos,
-- candidate sets, candidates, likes, cafés and café hours get fixed ids with
-- the same prefix.
--
-- Deleting the seeded auth users cascades through profiles to photos,
-- preferences, availability, candidates, decisions, matches and meets —
-- including rows the app created later (a match made by liking a seeded
-- member, a meet booked with one). Deleting the seeded cafés cascades to their
-- hours. The rest is reached directly:
--
--   candidate_sets  belong to the dev account, not to a seeded member
--   meets at a      meets.cafe_id is ON DELETE RESTRICT, so a meet between
--   seeded café     two real accounts at a seeded café would block the café.
--                   Every meet at a seeded café is deleted here outright, not
--                   left to a cascade, so none is still there when the
--                   restrict check runs at the end of the statement.
--   audit_log       has no foreign keys by design; the "verified" rows the
--                   seed caused carry the seeded profile id in entity_id
--
-- NOT COVERED: the photo FILES in Storage (profile-photos/5eed0000-…/).
-- Supabase does not allow deleting Storage objects from SQL, because it
-- would orphan the files. Either run
--     SUPABASE_SERVICE_ROLE_KEY=… node scripts/seed-demo.mjs --remove
-- (files and rows together, in an explicit order, then checked), or delete
-- the 5eed0000-… folders under Storage → profile-photos in the dashboard.
--
-- To see what it would remove without removing it, run it between `begin;`
-- and `rollback;`.
--
-- A real uuid starting with 5eed0000- has odds of about one in four billion;
-- the SELECT at the end reports counts so a surprise would show.
-- =============================================================================

with
  sets as (
    delete from public.candidate_sets where id::text like '5eed0000-%' returning 1
  ),
  cafe_meets as (
    delete from public.meets where cafe_id::text like '5eed0000-%' returning 1
  ),
  cafes as (
    delete from public.cafes where id::text like '5eed0000-%' returning 1
  ),
  members as (
    delete from auth.users where id::text like '5eed0000-%' returning 1
  ),
  audit as (
    delete from public.audit_log where entity_id like '5eed0000-%' returning 1
  )
select
  (select count(*) from members)    as seeded_members,
  (select count(*) from sets)       as candidate_sets,
  (select count(*) from cafes)      as cafes,
  (select count(*) from cafe_meets) as meets_at_seeded_cafes,
  (select count(*) from audit)      as audit_rows;
