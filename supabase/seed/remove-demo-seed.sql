-- =============================================================================
-- Removes every database row the demo seed created. One statement.
-- =============================================================================
-- scripts/seed-demo.mjs marks everything it creates with the id prefix
-- `5eed0000-`: seeded users are created with chosen ids, and their photos,
-- candidate sets, candidates and likes get fixed ids with the same prefix.
--
-- Deleting the seeded auth users cascades through profiles to photos,
-- preferences, availability, candidates, decisions, matches and meets —
-- including rows the app created later (a match made by liking a seeded
-- member, a meet booked with one). Two things do not cascade, so the
-- statement reaches them directly:
--
--   candidate_sets  belong to the dev account, not to a seeded member
--   audit_log       has no foreign keys by design; the "verified" rows the
--                   seed caused carry the seeded profile id in entity_id
--
-- NOT COVERED: the photo FILES in Storage (profile-photos/5eed0000-…/).
-- Supabase does not allow deleting Storage objects from SQL, because it
-- would orphan the files. Either run
--     SUPABASE_SERVICE_ROLE_KEY=… node scripts/seed-demo.mjs --remove
-- (files and rows together), or delete the 5eed0000-… folders under
-- Storage → profile-photos in the dashboard.
--
-- A real uuid starting with 5eed0000- has odds of about one in four billion;
-- the SELECT at the end reports counts so a surprise would show.
-- =============================================================================

with
  sets as (
    delete from public.candidate_sets where id::text like '5eed0000-%' returning 1
  ),
  members as (
    delete from auth.users where id::text like '5eed0000-%' returning 1
  ),
  audit as (
    delete from public.audit_log where entity_id like '5eed0000-%' returning 1
  )
select
  (select count(*) from members) as seeded_members,
  (select count(*) from sets)    as candidate_sets,
  (select count(*) from audit)   as audit_rows;
