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
 * It also creates five partner cafés in Pune, because a match with nowhere to
 * book dead-ends. They are invented — every name ends "(demo)" and every
 * address says it is not real — because a real café's name in the app claims a
 * partnership that business never agreed to, and a tester could turn up at a
 * real address expecting a table. Their hours differ enough that each café
 * offers a different list of times, and two are closed one day a week.
 *
 * EVERYTHING IT CREATES CARRIES ONE MARK: THE ID PREFIX `5eed0000-`.
 * Seeded users are created with a chosen id, so their profiles, photo rows,
 * candidate sets, candidates, decisions, cafés and café hours all start with
 * it, and so does every Storage path (`profile-photos/5eed0000-…/`). Rows created as side
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
 * Safe to run again, including after a run that failed part-way: a member who
 * already exists is not created again (and is reported as such), and every
 * write is an upsert on a fixed id, so a half-made member is finished rather
 * than left. `--remove` finds seeded members by prefix rather than by this
 * file's list, copes with any subset of them being present, and then checks
 * that nothing with the prefix is left.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomInt } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PHOTOS = join(ROOT, 'supabase', 'seed', 'photos');
const BUCKET = 'profile-photos';

/** The mark. Everything seeded starts with it; see supabase/seed/remove-demo-seed.sql. */
export const PREFIX = '5eed0000';
const RULE_VERSION = 'demo-seed';
const EMAIL_DOMAIN = 'seed.offtexts.invalid';

/** Ids are the prefix, a kind, and a number: readable in the table editor. */
const KIND = {
  member: '0001',
  photo: '0002',
  set: '0003',
  candidate: '0004',
  decision: '0005',
  cafe: '0006',
  hours: '0007',
};
const seedId = (kind, n) => `${PREFIX}-${KIND[kind]}-4000-8000-${String(n).padStart(12, '0')}`;

const ID_LOW = `${PREFIX}-0000-0000-0000-000000000000`;
const ID_HIGH = `${PREFIX}-ffff-ffff-ffff-ffffffffffff`;

/**
 * Eight members, two per purpose. `likesYou` marks the ones who have already
 * liked the dev account. Copy follows the app's own rule: a founder looking for
 * a co-founder should be happy reading any of it.
 */
export const PEOPLE = [
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

/* ---------------------------------------------------------------- cafés --- */

/** Every seeded café is here; the members' city has to match for them to show. */
export const CAFE_CITY = 'Pune';

const MON = 1;
const TUE = 2;
const WED = 3;
const THU = 4;
const FRI = 5;
const SAT = 6;
const SUN = 7;
const WEEKDAYS = [MON, TUE, WED, THU, FRI];

/** `[days, opens, closes]` → one cafe_hours row per day. ISO weekdays, 7 = Sunday. */
const open = (days, opens, closes) => days.map((weekday) => ({ weekday, opens, closes }));

/**
 * Five invented cafés. Real neighbourhoods, because a member picks a part of
 * town first; invented everything else. The hours are chosen to exercise the
 * booking screen: a half-hour opening (the first start rounds up), a lunch
 * closure (two intervals in a day), a breakfast café, a late one, and two
 * closed days — Monday at The Quiet Cup, Sunday at Leaf & Ledger — so the
 * greyed-out day and its caption appear.
 *
 * Coordinates are the neighbourhood to two decimals, about a kilometre: an
 * active café must have them, and they should not point at anybody's door.
 * The app never shows them. The phone numbers are not dialable (a 0 straight
 * after +91).
 */
export const CAFES = [
  {
    name: 'Fern & Filter (demo)',
    slug: 'demo-fern-and-filter',
    area: 'Baner',
    latitude: 18.56,
    longitude: 73.79,
    hours: [...open(WEEKDAYS, '08:00', '21:00'), ...open([SAT, SUN], '09:00', '22:00')],
  },
  {
    name: 'The Quiet Cup (demo)',
    slug: 'demo-the-quiet-cup',
    area: 'Koregaon Park',
    latitude: 18.54,
    longitude: 73.89,
    // Closed Mondays. Opens on the half hour, so the first bookable start is 11.
    hours: open([TUE, WED, THU, FRI, SAT, SUN], '10:30', '19:30'),
  },
  {
    name: 'Two Chairs Coffee Room (demo)',
    slug: 'demo-two-chairs-coffee-room',
    area: 'Aundh',
    latitude: 18.56,
    longitude: 73.81,
    // Shut for the afternoon on weekdays and Saturdays; Sunday mornings only.
    hours: [
      ...open([MON, TUE, WED, THU, FRI, SAT], '08:00', '12:00'),
      ...open([MON, TUE, WED, THU, FRI, SAT], '16:00', '22:00'),
      ...open([SUN], '09:00', '14:00'),
    ],
  },
  {
    name: 'Leaf & Ledger (demo)',
    slug: 'demo-leaf-and-ledger',
    area: 'Viman Nagar',
    latitude: 18.57,
    longitude: 73.91,
    // A breakfast-and-lunch place. Closed Sundays.
    hours: [
      ...open([MON, TUE, WED, THU], '07:30', '15:00'),
      ...open([FRI], '07:30', '18:00'),
      ...open([SAT], '09:00', '13:00'),
    ],
  },
  {
    name: 'Slow Pour House (demo)',
    slug: 'demo-slow-pour-house',
    area: 'Kalyani Nagar',
    latitude: 18.55,
    longitude: 73.9,
    // Afternoons and evenings; late on Friday and Saturday.
    hours: [
      ...open([MON, TUE, WED, THU], '12:00', '22:00'),
      ...open([FRI, SAT], '12:00', '23:59'),
      ...open([SUN], '13:00', '21:00'),
    ],
  },
].map((cafe, index) => ({
  ...cafe,
  n: index + 1,
  id: seedId('cafe', index + 1),
}));

/**
 * The start times the booking screen will offer, per ISO weekday — the same
 * rule as `startTimesOn` in src/domain/entities/Venue.ts, for a 60-minute
 * meet. Printed in the dry run, so the differences between cafés are visible
 * before anything is written.
 */
export function startsByDay(cafe, durationMinutes = 60) {
  const minutes = (clock) => {
    const [h, m] = clock.split(':').map(Number);
    return h * 60 + m;
  };
  const byDay = {};
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    const starts = new Set();
    for (const interval of cafe.hours.filter((h) => h.weekday === weekday)) {
      const last = minutes(interval.closes) - durationMinutes;
      for (let at = Math.ceil(minutes(interval.opens) / 60) * 60; at <= last; at += 60) {
        starts.add(at / 60);
      }
    }
    byDay[weekday] = [...starts].sort((a, b) => a - b);
  }
  return byDay;
}

/* ------------------------------------------------------------ passwords --- */

/**
 * The project's Auth policy wants a lowercase letter, an uppercase letter, a
 * digit and a symbol. Random bytes do not reliably contain all four — base64url
 * never contains a symbol, which is what broke the first run — so one of each
 * is placed by construction, the rest is drawn from all four, and the result
 * is shuffled so the guaranteed ones are not always in front. Long, because
 * nobody ever signs in with these.
 *
 * The symbols are exactly the ones the policy lists.
 */
export const PASSWORD_CLASSES = [
  'abcdefghijklmnopqrstuvwxyz',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  '0123456789',
  '!@#$%^&*()_+-=[]{};\'\\:"|<>?,./`~',
];

export function makePassword(length = 64) {
  const all = PASSWORD_CLASSES.join('');
  const chars = PASSWORD_CLASSES.map((set) => set[randomInt(set.length)]);
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  // Fisher–Yates, with the same CSPRNG.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/* ----------------------------------------------------------------- seed --- */

/** A failure the script explains and stops on. */
export class SeedError extends Error {}

/**
 * Seeds for one account and one date. Returns who was created and who was
 * already there, so a re-run after a partial failure says what it found.
 */
export async function seed(supabase, { memberEmail, forDate, apply, log = console.log }) {
  const member = await findMember(supabase, memberEmail);
  if (member.id.startsWith(PREFIX)) {
    throw new SeedError('That account is a seeded one. Pick the dev account.');
  }

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
  const names = (people) => people.map((p) => p.name).join(', ');

  log(`Account:  ${memberEmail} (${member.id}), city ${city}`);
  log(`Members:  ${PEOPLE.length}, ids ${PREFIX}-${KIND.member}-…, verified, in ${city}`);
  log(`Today:    ${forDate}: ${group.map((p) => `${p.name} (${p.intents.join('+')})`).join(', ')}`);
  log(`Liked by: ${names(group.filter((p) => p.likesYou))}`);
  if (city !== CAFE_CITY) {
    log(
      `Warning:  the cafés are in ${CAFE_CITY}, and the booking screen only lists cafés in the member's city (${city}).`,
    );
  }
  log(`Cafés:    ${CAFES.length} in ${CAFE_CITY}, start times per day (Mon…Sun):`);
  const DAY = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  for (const cafe of CAFES) {
    const byDay = startsByDay(cafe);
    const days = Object.entries(byDay).map(([weekday, starts]) =>
      starts.length === 0
        ? `${DAY[weekday]} closed`
        : `${DAY[weekday]} ${starts[0]}–${starts.at(-1)}${starts.length !== starts.at(-1) - starts[0] + 1 ? '*' : ''}`,
    );
    log(`  ${cafe.name.padEnd(30)} ${days.join(', ')}`);
  }
  log('  (* a gap in the day)');

  // A set that was not made here belongs to the real matching job. Mixing demo
  // people into it would make those rows impossible to tell apart later.
  const { data: existingSet, error: setError } = await supabase
    .from('candidate_sets')
    .select('id, rule_version')
    .eq('member_id', member.id)
    .eq('for_date', forDate)
    .maybeSingle();
  check(setError, 'looking for an existing set');
  if (existingSet && existingSet.id !== setId) {
    throw new SeedError(
      `The account already has a candidate set for ${forDate} (${existingSet.id}, rules ${existingSet.rule_version}) that this script did not create. Leaving it alone.`,
    );
  }

  const created = [];
  const existing = [];

  if (!apply) {
    log('\nDry run. Nothing was written. Run again with --apply.');
    return { created, existing };
  }

  for (const person of PEOPLE) {
    const outcome = await upsertMember(supabase, person, city);
    await upsertPhoto(supabase, person);
    (outcome === 'created' ? created : existing).push(person);
    log(`  ${outcome === 'created' ? '✓ created' : '· already there'}  ${person.name}`);
  }

  for (const cafe of CAFES) {
    await upsertCafe(supabase, cafe);
    log(`  ✓ café     ${cafe.name}`);
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

  log(`\nCreated ${created.length}. Already there, not created again: ${existing.length}.`);
  if (existing.length > 0) {
    log(`  Skipped: ${names(existing)}. Their profile and photo were brought up to date.`);
  }
  log('Remove it all with: node scripts/seed-demo.mjs --remove');
  return { created: created.map((p) => p.name), existing: existing.map((p) => p.name) };
}

/**
 * Creates the member unless they already exist. An existing one is not an
 * error — it is exactly what a re-run after a partial failure finds — so it is
 * skipped and reported. Its profile is still written below, though: "exists"
 * can mean "created, then the run died before the profile was filled in", and
 * leaving that member untouched would leave them half-made for good.
 */
async function upsertMember(supabase, person, city) {
  const { data: found, error: lookupError } = await supabase.auth.admin.getUserById(person.id);
  // Only "no such user" means "create it". Anything else — a wrong key, an
  // outage — must stop the run rather than be read as absence.
  if (lookupError && !isUserNotFound(lookupError)) {
    check(lookupError, `looking up ${person.name}`);
  }

  let outcome = 'existing';
  if (!found?.user) {
    const email = `seed-${String(person.n).padStart(2, '0')}@${EMAIL_DOMAIN}`;
    const { data, error } = await supabase.auth.admin.createUser({
      id: person.id,
      email,
      // Never used, never printed. These accounts are not signed in to.
      password: makePassword(),
      email_confirm: true,
      user_metadata: { name: person.name, demo_seed: true },
    });
    if (error && isEmailTaken(error)) {
      throw new SeedError(
        `${email} is already registered to an account without the ${PREFIX}- id, so it could not be removed with the rest. Delete that account first.`,
      );
    }
    check(error, `creating ${person.name}`);
    if (data.user.id !== person.id) {
      // Without the chosen id the row would be unmarked. Undo and stop.
      await supabase.auth.admin.deleteUser(data.user.id);
      throw new SeedError(
        `Auth ignored the requested id for ${person.name}; nothing of theirs was kept.`,
      );
    }
    outcome = 'created';
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
  return outcome;
}

async function upsertPhoto(supabase, person) {
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

/**
 * A bookable café and its hours. The hours are replaced rather than upserted,
 * so a change to the list above (a day closed, a window moved) does not leave
 * the old row behind.
 */
async function upsertCafe(supabase, cafe) {
  const { error } = await supabase.from('cafes').upsert({
    id: cafe.id,
    name: cafe.name,
    slug: cafe.slug,
    status: 'active',
    address_line: `Demo venue, ${cafe.area} — not a real address`,
    area: cafe.area,
    city: CAFE_CITY,
    latitude: cafe.latitude,
    longitude: cafe.longitude,
    phone: `+91 00000 0000${cafe.n}`,
    concurrent_meet_capacity: 2,
    notes: 'Demo seed (scripts/seed-demo.mjs). Fictional: not a real business or address.',
  });
  check(error, `writing ${cafe.name}`);

  const { error: clearError } = await supabase.from('cafe_hours').delete().eq('cafe_id', cafe.id);
  check(clearError, `clearing the hours of ${cafe.name}`);

  const { error: hoursError } = await supabase.from('cafe_hours').insert(
    cafe.hours.map((interval, index) => ({
      id: seedId('hours', cafe.n * 100 + index + 1),
      cafe_id: cafe.id,
      weekday: interval.weekday,
      opens_at: interval.opens,
      closes_at: interval.closes,
    })),
  );
  check(hoursError, `writing the hours of ${cafe.name}`);
}

/* --------------------------------------------------------------- remove --- */

/**
 * Deletes everything with the prefix, whatever subset of it exists.
 *
 * Seeded members and photo folders are FOUND by prefix as well as taken from
 * the list above, so a member created by an older or newer version of the list
 * goes too, and one that was never created is simply counted as absent. Then
 * it looks again, and fails loudly if anything with the prefix is left.
 */
export async function remove(supabase, { log = console.log } = {}) {
  // Files first: they are the one part the SQL statement cannot reach.
  const folders = new Set([...PEOPLE.map((p) => p.id), ...(await seededFolders(supabase))]);
  let files = 0;
  for (const folder of folders) {
    const { data: listed, error } = await supabase.storage.from(BUCKET).list(folder);
    check(error, `listing ${BUCKET}/${folder}`);
    if (listed.length > 0) {
      const { error: removeError } = await supabase.storage
        .from(BUCKET)
        .remove(listed.map((entry) => `${folder}/${entry.name}`));
      check(removeError, `deleting files in ${BUCKET}/${folder}`);
      files += listed.length;
    }
  }

  // Sets are the dev account's rows, so they do not cascade from the seeded
  // users. Everything else does: profiles, photos, candidates, decisions,
  // matches, meets.
  const { count: sets, error: setsError } = await supabase
    .from('candidate_sets')
    .delete({ count: 'exact' })
    .gte('id', ID_LOW)
    .lte('id', ID_HIGH);
  check(setsError, 'deleting candidate sets');

  const ids = new Set([...PEOPLE.map((p) => p.id), ...(await seededUsers(supabase))]);
  let members = 0;
  let absent = 0;
  for (const id of ids) {
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (!error) members += 1;
    else if (isUserNotFound(error)) absent += 1;
    else check(error, `deleting ${id}`);
  }

  // Cafés after members: deleting the members has already removed every meet
  // they were in. A meet between two real accounts at a seeded café is still
  // there, and meets.cafe_id is ON DELETE RESTRICT, so those go explicitly —
  // a booking at a café that is about to stop existing is not one to keep.
  const { count: meets, error: meetsError } = await supabase
    .from('meets')
    .delete({ count: 'exact' })
    .gte('cafe_id', ID_LOW)
    .lte('cafe_id', ID_HIGH);
  check(meetsError, 'deleting meets at seeded cafés');

  // Hours cascade from the café.
  const { count: cafes, error: cafesError } = await supabase
    .from('cafes')
    .delete({ count: 'exact' })
    .gte('id', ID_LOW)
    .lte('id', ID_HIGH);
  check(cafesError, 'deleting cafés');

  // Last, because deleting a profile could in principle audit something.
  const { count: audit, error: auditError } = await supabase
    .from('audit_log')
    .delete({ count: 'exact' })
    .like('entity_id', `${PREFIX}-%`);
  check(auditError, 'deleting audit rows');

  log(
    `Removed ${members} members (${absent} were not there), ${files} files, ` +
      `${sets ?? 0} candidate sets, ${cafes ?? 0} cafés, ${meets ?? 0} other meets at them, ` +
      `${audit ?? 0} audit rows.`,
  );

  const left = await leftovers(supabase);
  if (left.length > 0) throw new SeedError(`Still present after removal: ${left.join('; ')}.`);
  log('Checked: nothing with the prefix is left in Auth, profiles, sets, cafés, audit or Storage.');
  return {
    members,
    absent,
    files,
    sets: sets ?? 0,
    cafes: cafes ?? 0,
    meets: meets ?? 0,
    audit: audit ?? 0,
  };
}

/** Anything with the prefix still present, described. Empty when clean. */
async function leftovers(supabase) {
  const left = [];

  const users = await seededUsers(supabase);
  if (users.length > 0) left.push(`${users.length} auth users`);

  const count = async (table, narrow) => {
    const { count: n, error } = await narrow(
      supabase.from(table).select('id', { count: 'exact', head: true }),
    );
    check(error, `checking ${table}`);
    if (n) left.push(`${n} rows in ${table}`);
  };
  // Profiles cascade from auth.users; counting them checks the cascade ran.
  await count('profiles', (q) => q.gte('id', ID_LOW).lte('id', ID_HIGH));
  await count('candidate_sets', (q) => q.gte('id', ID_LOW).lte('id', ID_HIGH));
  await count('cafes', (q) => q.gte('id', ID_LOW).lte('id', ID_HIGH));
  // Cascade from the café; counted to check the cascade ran.
  await count('cafe_hours', (q) => q.gte('cafe_id', ID_LOW).lte('cafe_id', ID_HIGH));
  await count('meets', (q) => q.gte('cafe_id', ID_LOW).lte('cafe_id', ID_HIGH));
  await count('audit_log', (q) => q.like('entity_id', `${PREFIX}-%`));

  for (const folder of await seededFolders(supabase)) {
    const { data, error } = await supabase.storage.from(BUCKET).list(folder);
    check(error, `checking ${BUCKET}/${folder}`);
    if (data.length > 0) left.push(`${data.length} files in ${BUCKET}/${folder}`);
  }
  return left;
}

/** Ids of every auth user with the prefix. */
async function seededUsers(supabase) {
  const found = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    check(error, 'listing users');
    found.push(...data.users.filter((user) => user.id.startsWith(PREFIX)).map((user) => user.id));
    if (data.users.length < 1000) return found;
  }
}

/** Names of every top-level Storage folder with the prefix. */
async function seededFolders(supabase) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list('', { limit: 1000, search: PREFIX });
  check(error, `listing ${BUCKET}`);
  return data.map((entry) => entry.name).filter((name) => name.startsWith(PREFIX));
}

/* -------------------------------------------------------------- helpers --- */

async function findMember(supabase, email) {
  const wanted = email.trim().toLowerCase();
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    check(error, 'listing users');
    const hit = data.users.find((user) => user.email?.toLowerCase() === wanted);
    if (hit) return hit;
    if (data.users.length < 1000) throw new SeedError(`No account with the email ${email}.`);
  }
}

function isUserNotFound(error) {
  return error?.status === 404 || error?.code === 'user_not_found';
}

function isEmailTaken(error) {
  return error?.code === 'email_exists' || /already (been )?registered/i.test(error?.message ?? '');
}

/** The same local calendar date the app asks for (SupabaseMatchingRepository.isoDate). */
function localIsoDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function check(error, doing) {
  if (error) throw new SeedError(`Failed ${doing}: ${error.message ?? error}`);
}

/* ----------------------------------------------------------------- main --- */

async function main() {
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
      throw new SeedError(
        '.env contains a service role key. Remove it and rotate it: anything in .env can be bundled into the app.',
      );
    }
    process.loadEnvFile(envPath);
  }

  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const memberEmail = option('--member') || process.env.EXPO_PUBLIC_DEMO_EMAIL;
  const forDate = option('--date') || localIsoDate(new Date());

  if (!url) throw new SeedError('No Supabase URL. Set EXPO_PUBLIC_SUPABASE_URL in .env.');
  if (!serviceKey) {
    throw new SeedError('No service role key. Pass SUPABASE_SERVICE_ROLE_KEY for this command.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(forDate)) {
    throw new SeedError(`--date must be YYYY-MM-DD, not "${forDate}".`);
  }
  if (mode !== 'remove' && !memberEmail) {
    throw new SeedError('Which account? Pass --member <email>, or set EXPO_PUBLIC_DEMO_EMAIL.');
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Project:  ${url}`);
  if (mode === 'remove') {
    console.log(`Removing everything with the ${PREFIX}- prefix.`);
    await remove(supabase);
  } else {
    await seed(supabase, { memberEmail, forDate, apply: mode === 'apply' });
  }
}

// Run only when invoked directly, so the test can import the functions above.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`\n✗ ${error instanceof SeedError ? error.message : error.stack}`);
    process.exit(1);
  });
}
