/**
 * Tests for scripts/seed-demo.mjs, against an in-memory stand-in for the
 * Supabase client. Run with `npm run test:scripts` (part of `npm run verify`).
 *
 * The stand-in enforces the project's Auth password policy and cascades the
 * way the foreign keys do, so the failure that broke the first real run —
 * members created, then a password rejected half-way through — can be
 * replayed here exactly.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CAFES,
  makePassword,
  PASSWORD_CLASSES,
  PEOPLE,
  PREFIX,
  remove,
  seed,
  SeedError,
} from './seed-demo.mjs';

const DEV = { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'dev@offtexts.test' };
const quiet = () => {};

describe('makePassword', () => {
  it('always has one character of every class the policy asks for', () => {
    for (let run = 0; run < 2000; run += 1) {
      const password = makePassword();
      assert.equal(password.length, 64);
      for (const set of PASSWORD_CLASSES) {
        assert.ok(
          [...password].some((char) => set.includes(char)),
          `missing one of ${set}`,
        );
      }
    }
  });

  it('does not always put the guaranteed characters in the same place', () => {
    const firsts = new Set(Array.from({ length: 200 }, () => makePassword()[0]));
    assert.ok(firsts.size > 20);
  });
});

describe('seed', () => {
  it('seeds from empty', async () => {
    const db = fakeSupabase();

    const result = await seed(db.client, apply());

    assert.equal(result.created.length, PEOPLE.length);
    assert.deepEqual(result.existing, []);
    assert.equal(db.users.size, PEOPLE.length + 1);
    assert.equal(db.files.size, PEOPLE.length);
    assert.equal(db.table('candidates').length, 4);
    assert.ok(
      db.table('profiles').every((row) => row.id === DEV.id || row.verification === 'verified'),
    );
  });

  it('picks up after a run that died part-way, and says what it skipped', async () => {
    const db = fakeSupabase({ failCreateFor: 'Arjun Deshpande' });

    await assert.rejects(seed(db.client, apply()), /creating Arjun Deshpande/);
    assert.equal(seededUserCount(db), 1); // Meera, and nobody else.

    db.failCreateFor = null;
    const lines = [];
    const result = await seed(
      db.client,
      apply((line) => lines.push(line)),
    );

    assert.deepEqual(result.existing, ['Meera Kulkarni']);
    assert.equal(result.created.length, PEOPLE.length - 1);
    assert.equal(seededUserCount(db), PEOPLE.length);
    assert.ok(lines.some((line) => line.includes('Skipped: Meera Kulkarni')));
  });

  it('finishes a member who was created but never filled in', async () => {
    const db = fakeSupabase({ failProfileFor: PEOPLE[0].id });
    await assert.rejects(seed(db.client, apply()), /writing the profile for Meera/);

    db.failProfileFor = null;
    await seed(db.client, apply());

    const meera = db.table('profiles').find((row) => row.id === PEOPLE[0].id);
    assert.equal(meera.verification, 'verified');
    assert.equal(meera.name, 'Meera Kulkarni');
  });

  it('is a no-op the second time', async () => {
    const db = fakeSupabase();
    await seed(db.client, apply());
    const before = JSON.stringify(db.snapshot());

    const result = await seed(db.client, apply());

    assert.equal(result.created.length, 0);
    assert.equal(result.existing.length, PEOPLE.length);
    assert.equal(stripTimes(JSON.stringify(db.snapshot())), stripTimes(before));
  });

  it('stops, rather than guessing, when a member cannot be looked up', async () => {
    const db = fakeSupabase({ lookupError: { status: 401, message: 'Invalid API key' } });

    await assert.rejects(seed(db.client, apply()), /looking up Meera Kulkarni: Invalid API key/);
    assert.equal(seededUserCount(db), 0);
  });

  it('leaves a set it did not create alone', async () => {
    const db = fakeSupabase();
    db.table('candidate_sets').push({
      id: 'bbbbbbbb-0000-4000-8000-000000000001',
      member_id: DEV.id,
      for_date: '2026-09-25',
      rule_version: 'v1',
    });

    await assert.rejects(seed(db.client, apply()), (error) => error instanceof SeedError);
    assert.equal(seededUserCount(db), 0);
  });
});

describe('cafés', () => {
  it('seeds bookable, obviously fictional cafés with their hours', async () => {
    const db = fakeSupabase();

    await seed(db.client, apply());

    const cafes = db.table('cafes');
    assert.equal(cafes.length, CAFES.length);
    for (const cafe of cafes) {
      assert.equal(cafe.status, 'active');
      assert.equal(cafe.city, 'Pune');
      assert.match(cafe.name, /\(demo\)$/);
      assert.match(cafe.address_line, /not a real address/);
      assert.ok(cafe.id.startsWith(PREFIX));
    }
    const hours = db.table('cafe_hours');
    assert.equal(hours.length, CAFES.flatMap((cafe) => cafe.hours).length);
    assert.ok(hours.every((row) => row.weekday >= 1 && row.weekday <= 7)); // ISO, as the table says
  });

  it('has at least one café closed on a day of the week', () => {
    const closed = CAFES.filter(
      (cafe) => new Set(cafe.hours.map((interval) => interval.weekday)).size < 7,
    );
    assert.ok(closed.length >= 1);
  });

  it('does not duplicate hours on a second run', async () => {
    const db = fakeSupabase();
    await seed(db.client, apply());
    const before = db.table('cafe_hours').length;

    await seed(db.client, apply());

    assert.equal(db.table('cafe_hours').length, before);
  });
});

describe('remove', () => {
  it('cleans up a half-finished run: some members present, others never created', async () => {
    const db = fakeSupabase({ failCreateFor: 'Kavya Iyer' });
    await assert.rejects(seed(db.client, apply()), /creating Kavya Iyer/);
    assert.equal(seededUserCount(db), 2);
    assert.equal(db.files.size, 2);

    const result = await remove(db.client, { log: quiet });

    assert.equal(result.members, 2);
    assert.equal(result.absent, PEOPLE.length - 2);
    assert.equal(result.files, 2);
    assertOnlyDevLeft(db);
  });

  it('cleans up a complete run, including what cascades and what does not', async () => {
    const db = fakeSupabase();
    await seed(db.client, apply());

    await remove(db.client, { log: quiet });

    assertOnlyDevLeft(db);
    assert.equal(db.table('candidate_sets').length, 0);
    assert.equal(db.table('candidates').length, 0);
    assert.equal(db.table('decisions').length, 0);
    assert.equal(db.table('photos').length, 0);
  });

  it('removes cafés even when real accounts booked a meet at one', async () => {
    const db = fakeSupabase();
    await seed(db.client, apply());
    const otherReal = { id: 'cccccccc-0000-4000-8000-000000000001', email: 'tester@offtexts.test' };
    db.addUser(otherReal);
    const seededCafe = CAFES[0].id;
    db.table('meets').push(
      // With a seeded member: goes with the member.
      { id: 'm1', requester_id: DEV.id, recipient_id: PEOPLE[0].id, cafe_id: seededCafe },
      // Two real accounts at a seeded café: RESTRICT would block the café.
      { id: 'm2', requester_id: DEV.id, recipient_id: otherReal.id, cafe_id: seededCafe },
      // Two real accounts at a real café: none of the seed's business.
      { id: 'm3', requester_id: DEV.id, recipient_id: otherReal.id, cafe_id: 'real-cafe' },
    );

    const result = await remove(db.client, { log: quiet });

    assert.equal(result.cafes, CAFES.length);
    assert.equal(result.meets, 1);
    assert.deepEqual(
      db.table('meets').map((meet) => meet.id),
      ['m3'],
    );
    assert.equal(db.table('cafe_hours').length, 0);
  });

  it('also removes a seeded member this version of the list does not know', async () => {
    const db = fakeSupabase();
    db.addUser({ id: `${PREFIX}-0001-4000-8000-000000000099`, email: 'old@seed.offtexts.invalid' });
    db.files.set(`${PREFIX}-0001-4000-8000-000000000099/old.jpg`, new Uint8Array(1));

    const result = await remove(db.client, { log: quiet });

    assert.equal(result.members, 1);
    assert.equal(result.files, 1);
    assertOnlyDevLeft(db);
  });

  it('succeeds on an already clean project', async () => {
    const db = fakeSupabase();

    const result = await remove(db.client, { log: quiet });

    assert.equal(result.members, 0);
    assert.equal(result.absent, PEOPLE.length);
  });

  it('fails loudly if anything is still there afterwards', async () => {
    const db = fakeSupabase();
    await seed(db.client, apply());
    db.ignoreStorageRemoves = true;

    await assert.rejects(remove(db.client, { log: quiet }), /Still present after removal: .*files/);
  });
});

/* ------------------------------------------------------------- helpers --- */

function apply(log = quiet) {
  return { memberEmail: DEV.email, forDate: '2026-09-25', apply: true, log };
}

function seededUserCount(db) {
  return [...db.users.keys()].filter((id) => id.startsWith(PREFIX)).length;
}

function assertOnlyDevLeft(db) {
  assert.deepEqual(
    [...db.users.keys()].filter((id) => id.startsWith(PREFIX)),
    [],
  );
  assert.ok(db.users.has(DEV.id));
  assert.equal(db.files.size, 0);
  for (const [name, rows] of Object.entries(db.snapshot().tables)) {
    const marked = rows.filter((row) => JSON.stringify(row).includes(PREFIX));
    assert.deepEqual(marked, [], `${name} still has seeded rows`);
  }
}

function stripTimes(json) {
  return json.replace(/"moderated_at":"[^"]*"/g, '');
}

/**
 * Just enough of supabase-js for this script: auth admin, a query builder over
 * in-memory tables, and a Storage bucket. Foreign keys cascade from a deleted
 * user the way they do in the real schema.
 */
function fakeSupabase(options = {}) {
  const users = new Map();
  const tables = {
    profiles: [],
    photos: [],
    candidate_sets: [],
    candidates: [],
    decisions: [],
    audit_log: [],
    cafes: [],
    cafe_hours: [],
    meets: [],
  };
  const files = new Map();
  const table = (name) => tables[name];

  const db = {
    users,
    files,
    table,
    failCreateFor: options.failCreateFor ?? null,
    failProfileFor: options.failProfileFor ?? null,
    ignoreStorageRemoves: false,
    snapshot: () => ({ users: [...users.keys()], files: [...files.keys()], tables }),
    addUser(user) {
      users.set(user.id, user);
      // handle_new_user(): every auth user gets a profile row.
      tables.profiles.push({
        id: user.id,
        name: 'New member',
        city: 'Pune',
        verification: 'unverified',
      });
    },
  };
  db.addUser(DEV);

  const notFound = { status: 404, code: 'user_not_found', message: 'User not found' };

  const auth = {
    admin: {
      async getUserById(id) {
        if (options.lookupError) return { data: { user: null }, error: options.lookupError };
        const user = users.get(id);
        return user ? { data: { user }, error: null } : { data: { user: null }, error: notFound };
      },
      async createUser(attributes) {
        const person = PEOPLE.find((p) => p.id === attributes.id);
        if (db.failCreateFor && person?.name === db.failCreateFor) {
          return {
            data: { user: null },
            error: { status: 422, message: 'Password should contain…' },
          };
        }
        if (
          !PASSWORD_CLASSES.every((set) => [...attributes.password].some((c) => set.includes(c)))
        ) {
          return { data: { user: null }, error: { status: 422, message: 'weak_password' } };
        }
        if ([...users.values()].some((user) => user.email === attributes.email)) {
          return { data: { user: null }, error: { status: 422, code: 'email_exists' } };
        }
        const user = { id: attributes.id, email: attributes.email };
        db.addUser(user);
        return { data: { user }, error: null };
      },
      async deleteUser(id) {
        if (!users.has(id)) return { data: null, error: notFound };
        users.delete(id);
        // on delete cascade, from auth.users through profiles.
        tables.profiles = tables.profiles.filter((row) => row.id !== id);
        tables.photos = tables.photos.filter((row) => row.member_id !== id);
        tables.candidates = tables.candidates.filter(
          (row) => row.member_id !== id && row.subject_id !== id,
        );
        tables.decisions = tables.decisions.filter(
          (row) => row.actor_id !== id && row.subject_id !== id,
        );
        tables.meets = tables.meets.filter(
          (row) => row.requester_id !== id && row.recipient_id !== id,
        );
        return { data: null, error: null };
      },
      async listUsers({ page, perPage }) {
        const all = [...users.values()];
        return { data: { users: all.slice((page - 1) * perPage, page * perPage) }, error: null };
      },
    },
  };

  function from(name) {
    const filters = [];
    let op = { kind: 'select' };
    let mode = 'many';

    const builder = {
      select(_columns, opts) {
        op = { kind: 'select', head: opts?.head };
        return builder;
      },
      update(values) {
        op = { kind: 'update', values };
        return builder;
      },
      upsert(rows) {
        op = { kind: 'upsert', rows: Array.isArray(rows) ? rows : [rows] };
        return builder;
      },
      insert(rows) {
        op = { kind: 'insert', rows: Array.isArray(rows) ? rows : [rows] };
        return builder;
      },
      delete() {
        op = { kind: 'delete' };
        return builder;
      },
      eq(column, value) {
        filters.push((row) => row[column] === value);
        return builder;
      },
      gte(column, value) {
        filters.push((row) => String(row[column]) >= value);
        return builder;
      },
      lte(column, value) {
        filters.push((row) => String(row[column]) <= value);
        return builder;
      },
      like(column, pattern) {
        const start = pattern.replace(/%$/, '');
        filters.push((row) => String(row[column] ?? '').startsWith(start));
        return builder;
      },
      single() {
        mode = 'single';
        return builder;
      },
      maybeSingle() {
        mode = 'maybe';
        return builder;
      },
      then(resolve, reject) {
        return Promise.resolve(run()).then(resolve, reject);
      },
    };

    function run() {
      const rows = tables[name];
      const match = (row) => filters.every((test) => test(row));

      if (op.kind === 'upsert') {
        for (const incoming of op.rows) {
          const at = rows.findIndex((row) => row.id === incoming.id);
          if (at >= 0) rows[at] = { ...rows[at], ...incoming };
          else rows.push({ ...incoming });
        }
        return { data: null, error: null };
      }
      if (op.kind === 'insert') {
        for (const incoming of op.rows) {
          // cafe_hours_no_duplicate, and the primary key.
          const clash = rows.some(
            (row) =>
              row.id === incoming.id ||
              (name === 'cafe_hours' &&
                row.cafe_id === incoming.cafe_id &&
                row.weekday === incoming.weekday &&
                row.opens_at === incoming.opens_at),
          );
          if (clash) return { data: null, error: { code: '23505', message: 'duplicate key' } };
          rows.push({ ...incoming });
        }
        return { data: null, error: null };
      }
      if (op.kind === 'update') {
        const targets = rows.filter(match);
        if (
          db.failProfileFor &&
          name === 'profiles' &&
          targets.some((r) => r.id === db.failProfileFor)
        ) {
          return { data: null, error: { message: 'connection reset' } };
        }
        for (const row of targets) {
          if (
            name === 'profiles' &&
            op.values.verification &&
            row.verification !== op.values.verification
          ) {
            // profiles_verification_audit
            tables.audit_log.push({
              id: tables.audit_log.length + 1,
              entity_table: 'profiles',
              entity_id: row.id,
            });
          }
          Object.assign(row, op.values);
        }
        return { data: null, error: null };
      }
      if (op.kind === 'delete') {
        const kept = rows.filter((row) => !match(row));
        const count = rows.length - kept.length;
        const removedIds = new Set(rows.filter(match).map((row) => row.id));
        // meets.cafe_id is ON DELETE RESTRICT.
        if (name === 'cafes' && tables.meets.some((meet) => removedIds.has(meet.cafe_id))) {
          return { data: null, error: { code: '23503', message: 'still referenced from meets' } };
        }
        tables[name] = kept;
        if (name === 'cafes') {
          tables.cafe_hours = tables.cafe_hours.filter((row) => !removedIds.has(row.cafe_id));
        }
        if (name === 'candidate_sets') {
          tables.candidates = tables.candidates.filter((row) => !removedIds.has(row.set_id));
        }
        return { data: null, count, error: null };
      }

      const found = rows.filter(match);
      if (op.head) return { data: null, count: found.length, error: null };
      if (mode === 'single') {
        return found.length === 1
          ? { data: found[0], error: null }
          : { data: null, error: { code: 'PGRST116', message: 'not one row' } };
      }
      if (mode === 'maybe') return { data: found[0] ?? null, error: null };
      return { data: found, error: null };
    }

    return builder;
  }

  const storage = {
    from() {
      return {
        async upload(path, bytes) {
          files.set(path, bytes);
          return { data: { path }, error: null };
        },
        getPublicUrl(path) {
          return {
            data: {
              publicUrl: `https://example.supabase.co/storage/v1/object/public/profile-photos/${path}`,
            },
          };
        },
        async list(folder, opts = {}) {
          if (folder === '') {
            const top = new Set([...files.keys()].map((key) => key.split('/')[0]));
            const names = [...top].filter((n) => !opts.search || n.includes(opts.search));
            return { data: names.map((n) => ({ name: n, id: null })), error: null };
          }
          const inside = [...files.keys()]
            .filter((key) => key.startsWith(`${folder}/`))
            .map((key) => ({ name: key.slice(folder.length + 1) }));
          return { data: inside, error: null };
        },
        async remove(paths) {
          if (!db.ignoreStorageRemoves) for (const path of paths) files.delete(path);
          return { data: null, error: null };
        },
      };
    },
  };

  db.client = { auth, from, storage };
  return db;
}
