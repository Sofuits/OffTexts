#!/usr/bin/env node
/**
 * Demo members for walking the app against a real Supabase project.
 *
 * Today is empty on a fresh project: nobody else is verified, and nothing has
 * generated a candidate set. This creates eight verified members in the dev
 * account's city — two for each purpose, so dating, life partner, networking
 * and co-founder can all be walked — each with a photo uploaded to Storage,
 * and puts four of them (one per purpose) in the dev account's set for today.
 * Two of those four have already liked the dev account, so liking them back
 * makes a match and the Matches and booking flows can be walked too.
 *
 * EVERYTHING IT CREATES CARRIES ONE MARK: THE ID PREFIX `5eed0000-`.
 * Seeded users are created with a chosen id, so their profiles, photo rows,
 * candidate sets, candidates and decisions all start with it, and so does
 * every Storage path (`profile-photos/5eed0000-…/`). Rows created as side
 * effects are reachable through it too: matches and meets cascade from the
 * seeded profiles, and the audit rows for "verified" carry the profile id in
 * `audit_log.entity_id`. The whole database side is removed by the single
 * statement in supabase/seed/remove-demo-seed.sql. Storage files cannot be
 * deleted from SQL — Supabase blocks it, because it would orphan the files —
 * so `--remove` here deletes both, through the API.
 *
 * NEEDS THE SERVICE ROLE KEY, which bypasses RLS. It is read from
 * SUPABASE_SERVICE_ROLE_KEY in the shell, for this one command, and must never
 * be put in .env: everything in .env can end up in the app bundle.
 *
 * Usage (Git Bash; prefix the variable the same way in any POSIX shell):
 *   SUPABASE_SERVICE_ROLE_KEY=… node scripts/seed-demo.mjs                 # dry run: prints the plan
 *   SUPABASE_SERVICE_ROLE_KEY=… node scripts/seed-demo.mjs --apply         # creates it
 *   SUPABASE_SERVICE_ROLE_KEY=… node scripts/seed-demo.mjs --remove        # deletes all of it
 *
 * Options:
 *   --member <email>   the dev account to seed for (default: EXPO_PUBLIC_DEMO_EMAIL)
 *   --date YYYY-MM-DD  the day to build a set for (default: today, local time —
 *                      the same local date the app asks for). Odd days get the
 *                      first four members, even days the other four.
 *
 * Safe to run again: every write is an upsert on a fixed id.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PHOTOS = join(ROOT, 'supabase', 'seed', 'photos');
const BUCKET = 'profile-photos';

/** The mark. Everything seeded starts with it; see supabase/seed/remove-demo-seed.sql. */
const PREFIX = '5eed0000';
const RULE_VERSION = 'demo-seed';
const EMAIL_DOMAIN = 'seed.offtexts.invalid';

/** Ids are the prefix, a kind, and a number: readable in the table editor. */
const KIND = { member: '0001', photo: '0002', set: '0003', candidate: '0004', decision: '0005' };
const seedId = (kind, n) => `${PREFIX}-${KIND[kind]}-4000-8000-${String(n).padStart(12, '0')}`;

/**
 * Eight members, two per purpose. `likesYou` marks the ones who have already
 * liked the dev account. Copy follows the app's own rule: a founder looking for
 * a co-founder should be happy reading any of it.
 */
const PEOPLE = [
  // First four: odd dates.
  {
    name: 'Meera Kulkarni',
    gender: 'woman',
    dateOfBirth: '1997-03-14',
    intents: ['dating'],
    headline: 'Architect. Happiest with a sketchbook and a long lunch.',
    bio: 'Designs homes for a small studio. Weekends are for walking old parts of the city.',
    interests: ['Design', 'Coffee', 'Art', 'Travel'],
    likesYou: true,
  },
  {
    name: 'Arjun Deshpande',
    gender: 'man',
    dateOfBirth: '1992-08-02',
    intents: ['life_partner'],
    headline: 'Looking for something lasting, and saying so.',
    bio: 'Teaches maths at a college. Cooks for friends more often than they would like.',
    interests: ['Cooking', 'Books', 'Cricket'],
    likesYou: false,
  },
  {
    name: 'Kavya Iyer',
    gender: 'woman',
    dateOfBirth: '1995-11-21',
    intents: ['networking'],
    headline: 'Product manager in health tech. Always up for comparing notes.',
    bio: 'Eight years building software for clinics. Interested in how small teams ship.',
    interests: ['Startups', 'Podcasts', 'Running', 'Writing'],
    likesYou: true,
  },
  {
    name: 'Nikhil Joshi',
    gender: 'man',
    dateOfBirth: '1990-05-09',
    intents: ['co_founder'],
    headline: 'Backend engineer looking for a commercial co-founder.',
    bio: 'Built payments infrastructure for six years. Has a prototype and needs someone who can sell it.',
    interests: ['Startups', 'Investing', 'Cycling'],
    likesYou: false,
  },
  // Second four: even dates.
  {
    name: 'Ishaan Patil',
    gender: 'man',
    dateOfBirth: '1999-01-27',
    intents: ['dating'],
    headline: 'Would rather meet over coffee than over text.',
    bio: 'Photographer by weekend, analyst by weekday. Knows every good bakery in the city.',
    interests: ['Photography', 'Food', 'Live music'],
    likesYou: false,
  },
  {
    name: 'Sana Sheikh',
    gender: 'woman',
    dateOfBirth: '1993-06-18',
    intents: ['life_partner'],
    headline: 'Doctor. Looking for someone to build a calm life with.',
    bio: 'Paediatrician at a city hospital. Reads crime fiction and swims in the mornings.',
    interests: ['Books', 'Yoga', 'Travel'],
    likesYou: true,
  },
  {
    name: 'Riya Menon',
    gender: 'non_binary',
    dateOfBirth: '2000-09-03',
    intents: ['networking'],
    headline: 'Designer moving into research. Keen to meet people doing it well.',
    bio: 'Three years in UX at an agency. Organises a monthly design meetup.',
    interests: ['Design', 'Board games', 'Theatre'],
    likesYou: false,
  },
  {
    name: 'Aditya Chauhan',
    gender: 'man',
    dateOfBirth: '1988-12-11',
    intents: ['co_founder', 'networking'],
    headline: 'Second-time founder in climate tech. Looking for a technical partner.',
    bio: 'Sold a logistics start-up in 2023. Now working on carbon accounting for manufacturers.',
    interests: ['Startups', 'Climbing', 'Investing', 'Hiking'],
    likesYou: true,
  },
].map((person, index) => ({ ...person, n: index + 1, id: seedId('member', index + 1) }));

/* ---------------------------------------------------------------- setup --- */

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};

const mode = flag('--remove') ? 'remove' : flag('--apply') ? 'apply' : 'plan';

// The URL and demo email come from .env, like the app. The service role key
// must not: refuse outright if somebody has put it there.
const envPath = join(ROOT, '.env');
if (existsSync(envPath)) {
  if (/^\s*[A-Z_]*SERVICE_ROLE[A-Z_]*\s*=\s*\S/m.test(readFileSync(envPath, 'utf8'))) {
    fail(
      '.env contains a service role key. Remove it and rotate it: anything in .env can be bundled into the app.',
    );
  }
  process.loadEnvFile(envPath);
}

const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const memberEmail = option('--member') || process.env.EXPO_PUBLIC_DEMO_EMAIL;
const forDate = option('--date') || localIsoDate(new Date());

if (!url) fail('No Supabase URL. Set EXPO_PUBLIC_SUPABASE_URL in .env.');
if (!serviceKey) fail('No service role key. Pass SUPABASE_SERVICE_ROLE_KEY for this command.');
if (!/^\d{4}-\d{2}-\d{2}$/.test(forDate)) fail(`--date must be YYYY-MM-DD, not "${forDate}".`);
if (mode !== 'remove' && !memberEmail) {
  fail('Which account? Pass --member <email>, or set EXPO_PUBLIC_DEMO_EMAIL.');
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ----------------------------------------------------------------- main --- */

if (mode === 'remove') {
  await remove();
} else {
  await seed(mode === 'apply');
}

async function seed(apply) {
  const member = await findMember(memberEmail);
  if (member.id.startsWith(PREFIX)) fail('That account is a seeded one. Pick the dev account.');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('city')
    .eq('id', member.id)
    .single();
  check(error, 'reading the dev account profile');
  const city = profile.city;

  const day = Number(forDate.slice(8, 10));
  const group = day % 2 === 1 ? PEOPLE.slice(0, 4) : PEOPLE.slice(4);
  const dateDigits = forDate.replaceAll('-', '');
  const setId = seedId('set', dateDigits);

  console.log(`Project:  ${url}`);
  console.log(`Account:  ${memberEmail} (${member.id}), city ${city}`);
  console.log(`Members:  ${PEOPLE.length}, ids ${PREFIX}-${KIND.member}-…, verified, in ${city}`);
  console.log(
    `Today:    ${forDate}: ${group.map((p) => `${p.name} (${p.intents.join('+')})`).join(', ')}`,
  );
  console.log(
    `Liked by: ${group
      .filter((p) => p.likesYou)
      .map((p) => p.name)
      .join(', ')}`,
  );

  // A set that was not made here belongs to the real matching job. Mixing demo
  // people into it would make those rows impossible to tell apart later.
  const { data: existing, error: setError } = await supabase
    .from('candidate_sets')
    .select('id, rule_version')
    .eq('member_id', member.id)
    .eq('for_date', forDate)
    .maybeSingle();
  check(setError, 'looking for an existing set');
  if (existing && existing.id !== setId) {
    fail(
      `The account already has a candidate set for ${forDate} (${existing.id}, rules ${existing.rule_version}) that this script did not create. Leaving it alone.`,
    );
  }

  if (!apply) {
    console.log('\nDry run. Nothing was written. Run again with --apply.');
    return;
  }

  for (const person of PEOPLE) {
    await upsertMember(person, city);
    await upsertPhoto(person);
    process.stdout.write(`  ✓ ${person.name}\n`);
  }

  const { error: upsertSetError } = await supabase.from('candidate_sets').upsert({
    id: setId,
    member_id: member.id,
    for_date: forDate,
    rule_version: RULE_VERSION,
  });
  check(upsertSetError, 'writing the candidate set');

  const { error: candidatesError } = await supabase.from('candidates').upsert(
    group.map((person, index) => ({
      id: seedId('candidate', `${dateDigits}00${String(index + 1).padStart(2, '0')}`),
      set_id: setId,
      member_id: member.id,
      subject_id: person.id,
      slot: index + 1,
      reason: 'Demo seed',
    })),
  );
  check(candidatesError, 'writing candidates');

  const { error: decisionsError } = await supabase.from('decisions').upsert(
    PEOPLE.filter((person) => person.likesYou).map((person) => ({
      id: seedId('decision', person.n),
      actor_id: person.id,
      subject_id: member.id,
      kind: 'like',
    })),
  );
  check(decisionsError, 'writing likes');

  console.log(`\nDone. Remove it all with: node scripts/seed-demo.mjs --remove`);
}

async function upsertMember(person, city) {
  const { data: found } = await supabase.auth.admin.getUserById(person.id);
  if (!found?.user) {
    const { data, error } = await supabase.auth.admin.createUser({
      id: person.id,
      email: `seed-${String(person.n).padStart(2, '0')}@${EMAIL_DOMAIN}`,
      // Never used, never printed. These accounts are not signed in to.
      password: randomBytes(24).toString('base64url'),
      email_confirm: true,
      user_metadata: { name: person.name, demo_seed: true },
    });
    check(error, `creating ${person.name}`);
    if (data.user.id !== person.id) {
      // Without the chosen id the row would be unmarked. Undo and stop.
      await supabase.auth.admin.deleteUser(data.user.id);
      fail(`Auth ignored the requested id for ${person.name}; nothing of theirs was kept.`);
    }
  }

  // The signup trigger has made the profile row; fill it in. Verified, or
  // nobody else is allowed to read it (see "profiles: read own or verified").
  const { error } = await supabase
    .from('profiles')
    .update({
      name: person.name,
      date_of_birth: person.dateOfBirth,
      gender: person.gender,
      headline: person.headline,
      bio: person.bio,
      city,
      interests: person.interests,
      intents: person.intents,
      verification: 'verified',
    })
    .eq('id', person.id);
  check(error, `writing the profile for ${person.name}`);
}

async function upsertPhoto(person) {
  const file = `seed-${String(person.n).padStart(2, '0')}.jpg`;
  const bytes = readFileSync(join(PHOTOS, file));
  const path = `${person.id}/${file}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
  check(uploadError, `uploading the photo for ${person.name}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

  // Approved, so the sync trigger copies it into profiles.photo_urls, which is
  // what everybody else sees.
  const { error } = await supabase.from('photos').upsert({
    id: seedId('photo', person.n),
    member_id: person.id,
    storage_path: path,
    url: data.publicUrl,
    sort_order: 1,
    moderation: 'approved',
    moderated_at: new Date().toISOString(),
    width: 720,
    height: 900,
    bytes: bytes.length,
  });
  check(error, `recording the photo for ${person.name}`);
}

async function remove() {
  console.log(`Project: ${url}\nRemoving everything with the ${PREFIX}- prefix.`);

  // Files first: they are the one part the SQL statement cannot reach.
  let files = 0;
  for (const person of PEOPLE) {
    const { data: listed, error } = await supabase.storage.from(BUCKET).list(person.id);
    check(error, `listing photos for ${person.name}`);
    if (listed.length > 0) {
      const { error: removeError } = await supabase.storage
        .from(BUCKET)
        .remove(listed.map((entry) => `${person.id}/${entry.name}`));
      check(removeError, `deleting photos for ${person.name}`);
      files += listed.length;
    }
  }

  // Sets are the dev account's rows, so they do not cascade from the seeded
  // users. Everything else does: profiles, photos, candidates, decisions,
  // matches, meets.
  const { count: sets, error: setsError } = await supabase
    .from('candidate_sets')
    .delete({ count: 'exact' })
    .gte('id', `${PREFIX}-0000-0000-0000-000000000000`)
    .lte('id', `${PREFIX}-ffff-ffff-ffff-ffffffffffff`);
  check(setsError, 'deleting candidate sets');

  let users = 0;
  for (const person of PEOPLE) {
    const { error } = await supabase.auth.admin.deleteUser(person.id);
    if (!error) users += 1;
    else if (error.status !== 404) check(error, `deleting ${person.name}`);
  }

  // Last, because deleting a profile could in principle audit something.
  const { count: audit, error: auditError } = await supabase
    .from('audit_log')
    .delete({ count: 'exact' })
    .like('entity_id', `${PREFIX}-%`);
  check(auditError, 'deleting audit rows');

  console.log(
    `Removed ${users} members, ${files} files, ${sets ?? 0} sets, ${audit ?? 0} audit rows.`,
  );
}

/* -------------------------------------------------------------- helpers --- */

async function findMember(email) {
  const wanted = email.trim().toLowerCase();
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    check(error, 'listing users');
    const hit = data.users.find((user) => user.email?.toLowerCase() === wanted);
    if (hit) return hit;
    if (data.users.length < 1000) fail(`No account with the email ${email}.`);
  }
}

/** The same local calendar date the app asks for (SupabaseMatchingRepository.isoDate). */
function localIsoDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function check(error, doing) {
  if (error) fail(`Failed ${doing}: ${error.message ?? error}`);
}

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}
