#!/usr/bin/env node
/**
 * Generates src/infrastructure/supabase/database.types.ts from a live schema.
 *
 * WHY THIS EXISTS WHEN `supabase gen types` EXISTS
 * The CLI's `gen types --db-url` shells out to Docker, and there is no Docker
 * in every environment this needs to run in. This reads the same catalogs the
 * CLI reads — information_schema, pg_type, pg_proc — through psql, and emits
 * the same shape supabase-js expects:
 *
 *   Database[schema]['Tables'][name]['Row' | 'Insert' | 'Update']
 *   Database[schema]['Views'][name]['Row']
 *   Database[schema]['Functions'][name]['Args' | 'Returns']
 *   Database[schema]['Enums'][name]
 *
 * Point it at the scratch database supabase/tests/replay.sh builds and the
 * output is, by construction, the types for exactly what the migrations
 * produce. Point it at the real project and it is the types for what is
 * actually deployed. Those should be the same thing, and if they are not,
 * that is worth knowing.
 *
 * `npx supabase gen types typescript --project-id <ref> --schema public,api_v1`
 * remains the canonical command wherever Docker is available. Its output and
 * this script's are interchangeable; neither should ever be edited by hand.
 *
 * Usage:
 *   node scripts/generate-types.mjs "postgresql://..." > src/infrastructure/supabase/database.types.ts
 *   node scripts/generate-types.mjs --local          # the replay.sh database
 */

import { execFileSync } from 'node:child_process';

const SCHEMAS = ['public', 'api_v1'];

const arg = process.argv[2];
const LOCAL = 'postgresql://postgres@localhost:5433/offtexts_test?host=/home/pgtest/pg/sock';
const connection = !arg || arg === '--local' ? LOCAL : arg;

/** Runs a query and returns the single JSON value it selects. */
function query(sql) {
  const out = execFileSync('psql', [connection, '-X', '-A', '-t', '-c', sql], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out.trim() || 'null') ?? [];
}

const list = SCHEMAS.map((s) => `'${s}'`).join(', ');

/* ------------------------------------------------------------------ read -- */

const enums = query(`
  select coalesce(json_agg(json_build_object(
    'schema', n.nspname, 'name', t.typname,
    'values', (select json_agg(e.enumlabel order by e.enumsortorder)
               from pg_enum e where e.enumtypid = t.oid)
  ) order by n.nspname, t.typname), '[]')
  from pg_type t join pg_namespace n on n.oid = t.typnamespace
  where t.typtype = 'e' and n.nspname in (${list})
`);

const relations = query(`
  select coalesce(json_agg(r order by r.table_schema, r.table_name), '[]') from (
    select
      c.table_schema, c.table_name,
      cls.relkind as kind,
      json_agg(json_build_object(
        'name', c.column_name,
        'type', c.data_type,
        'udt', c.udt_name,
        'nullable', c.is_nullable = 'YES',
        'has_default', c.column_default is not null,
        'generated', c.is_generated = 'ALWAYS' or c.identity_generation = 'ALWAYS'
      ) order by c.ordinal_position) as columns
    from information_schema.columns c
    join pg_class cls on cls.relname = c.table_name
    join pg_namespace n on n.oid = cls.relnamespace and n.nspname = c.table_schema
    where c.table_schema in (${list}) and cls.relkind in ('r', 'v', 'm')
    group by c.table_schema, c.table_name, cls.relkind
  ) r
`);

const routines = query(`
  select coalesce(json_agg(json_build_object(
    'schema', n.nspname,
    'name', p.proname,
    -- Indexed rather than unnested in parallel. proargnames includes OUT
    -- parameter names while proargtypes holds only the IN types, so unnesting
    -- the two together misaligns them the moment a function has an OUT
    -- parameter — and pads the short side with nulls rather than failing.
    -- proargtypes is an oidvector and therefore 0-based; proargnames is a
    -- text[] and 1-based.
    'args', (
      select coalesce(json_agg(json_build_object(
        'name', p.proargnames[i],
        'udt', format_type(p.proargtypes[i - 1], null),
        'optional', i > p.pronargs - p.pronargdefaults
      ) order by i), '[]')
      from generate_series(1, p.pronargs) i
    ),
    'returns', format_type(p.prorettype, null),
    'returns_set', p.proretset
  ) order by n.nspname, p.proname), '[]')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in (${list})
    -- Trigger functions are not callable through PostgREST and would only be
    -- noise in the generated type.
    and p.prorettype <> 'trigger'::regtype::oid
    and p.prokind = 'f'
    -- Functions that belong to an extension. pgcrypto alone installs three
    -- dozen into public — armor(), digest(), crypt() and the rest — and they
    -- are not this project's API. Several are overloaded, which would also
    -- emit duplicate keys and make the file fail to compile.
    and not exists (
      select 1 from pg_depend d
      where d.objid = p.oid and d.classid = 'pg_proc'::regclass and d.deptype = 'e'
    )
`);

/* --------------------------------------------------------------- mapping -- */

const enumsBySchema = new Map();
for (const e of enums) {
  if (!enumsBySchema.has(e.schema)) enumsBySchema.set(e.schema, new Map());
  enumsBySchema.get(e.schema).set(e.name, e.values);
}

const enumRef = (udt) => {
  for (const [schema, map] of enumsBySchema) {
    if (map.has(udt)) return `Database['${schema}']['Enums']['${udt}']`;
  }
  return null;
};

const SCALARS = {
  uuid: 'string',
  text: 'string',
  'character varying': 'string',
  character: 'string',
  citext: 'string',
  name: 'string',
  smallint: 'number',
  integer: 'number',
  bigint: 'number',
  numeric: 'number',
  real: 'number',
  'double precision': 'number',
  boolean: 'boolean',
  json: 'Json',
  jsonb: 'Json',
  // Postgres returns these over the wire as ISO strings, not Date objects.
  // Typing them as Date would be a lie that only shows up at runtime.
  'timestamp with time zone': 'string',
  'timestamp without time zone': 'string',
  date: 'string',
  'time without time zone': 'string',
  'time with time zone': 'string',
  interval: 'string',
  bytea: 'string',
};

function tsType(column) {
  // information_schema reports an array as data_type 'ARRAY' with the element
  // type in udt_name, prefixed with an underscore.
  if (column.type === 'ARRAY') {
    const element = column.udt.replace(/^_/, '');
    const inner = enumRef(element) ?? SCALARS[element] ?? mapUdt(element) ?? 'unknown';
    return `${inner}[]`;
  }
  if (column.type === 'USER-DEFINED') {
    return enumRef(column.udt) ?? 'unknown';
  }
  return SCALARS[column.type] ?? mapUdt(column.udt) ?? 'unknown';
}

function mapUdt(udt) {
  const byUdt = {
    int2: 'number',
    int4: 'number',
    int8: 'number',
    float4: 'number',
    float8: 'number',
    numeric: 'number',
    bool: 'boolean',
    varchar: 'string',
    bpchar: 'string',
    text: 'string',
    uuid: 'string',
    json: 'Json',
    jsonb: 'Json',
    timestamptz: 'string',
    timestamp: 'string',
    date: 'string',
    time: 'string',
    timetz: 'string',
  };
  return byUdt[udt] ?? null;
}

const column = (c) => `${c.name}: ${tsType(c)}${c.nullable ? ' | null' : ''}`;

/**
 * A function argument or return type, which arrives from format_type() as a
 * printable SQL name ('integer', 'uuid[]', 'public.decision_kind') rather than
 * as the information_schema pair the column path uses.
 */
function argType(sqlName) {
  if (!sqlName) return 'unknown';
  const isArray = sqlName.endsWith('[]');
  const base = (isArray ? sqlName.slice(0, -2) : sqlName).replace(/^public\./, '');
  const inner = enumRef(base) ?? SCALARS[base] ?? mapUdt(base) ?? 'unknown';
  return isArray ? `${inner}[]` : inner;
}

/* ----------------------------------------------------------------- emit --- */

const out = [];
const w = (s = '') => out.push(s);

w('/**');
w(' * The database schema, as TypeScript. GENERATED — DO NOT EDIT BY HAND.');
w(' *');
w(' *   node scripts/generate-types.mjs --local > src/infrastructure/supabase/database.types.ts');
w(' *');
w(' * or, where Docker is available, the canonical Supabase command:');
w(' *');
w(' *   npx supabase gen types typescript \\');
w(' *     --project-id dxggtnpnyxqjyarxvczh --schema public,api_v1 \\');
w(' *     > src/infrastructure/supabase/database.types.ts');
w(' *');
w(' * Both produce the same shape and either may be used. Regenerating is what');
w(' * makes a column rename a compile error instead of an undefined at runtime.');
w(' *');
w(' * These are ROW types: snake_case, nullable, shaped by the database. They are');
w(' * deliberately not the domain entities — `data/mappers` converts between the');
w(' * two, and that conversion is the seam that lets the database change without');
w(' * the rest of the app noticing.');
w(' *');
w(' * Named aliases (ProfileRow, MeetRow, …) live in ./rows.ts, so that');
w(' * regenerating this file cannot break an import.');
w(' */');
w();
w('export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];');
w();
w('export type Database = {');

for (const schema of SCHEMAS) {
  const tables = relations.filter((r) => r.table_schema === schema && r.kind === 'r');
  const views = relations.filter((r) => r.table_schema === schema && r.kind !== 'r');
  const fns = routines.filter((r) => r.schema === schema);
  const schemaEnums = enumsBySchema.get(schema) ?? new Map();

  w(`  ${schema}: {`);

  // --- Tables
  if (tables.length === 0) {
    w('    Tables: Record<never, never>;');
  } else {
    w('    Tables: {');
    for (const t of tables) {
      w(`      ${t.table_name}: {`);
      w('        Row: {');
      for (const c of t.columns) w(`          ${column(c)};`);
      w('        };');

      w('        Insert: {');
      for (const c of t.columns) {
        if (c.generated) continue; // identity/generated: never writable
        const optional = c.nullable || c.has_default;
        w(`          ${c.name}${optional ? '?' : ''}: ${tsType(c)}${c.nullable ? ' | null' : ''};`);
      }
      w('        };');

      w('        Update: {');
      for (const c of t.columns) {
        if (c.generated) continue;
        w(`          ${c.name}?: ${tsType(c)}${c.nullable ? ' | null' : ''};`);
      }
      w('        };');
      w('        Relationships: [];');
      w('      };');
    }
    w('    };');
  }

  // --- Views. No Insert or Update: none of these are updatable, and typing
  //     them as if they were would invite a write that fails at runtime.
  if (views.length === 0) {
    w('    Views: Record<never, never>;');
  } else {
    w('    Views: {');
    for (const v of views) {
      w(`      ${v.table_name}: {`);
      w('        Row: {');
      for (const c of v.columns) w(`          ${column(c)};`);
      w('        };');
      w('        Relationships: [];');
      w('      };');
    }
    w('    };');
  }

  // --- Functions
  if (fns.length === 0) {
    w('    Functions: Record<never, never>;');
  } else {
    w('    Functions: {');
    // Overloads share a name, and two keys with the same name is not valid
    // TypeScript. Nothing in this project is overloaded; this is here so that
    // the day somebody adds an overload the file still compiles and the
    // generator says something rather than emitting a broken object.
    const seen = new Set();
    for (const f of fns) {
      if (seen.has(f.name)) {
        process.stderr.write(
          `  note: ${schema}.${f.name} is overloaded; only the first is typed\n`,
        );
        continue;
      }
      seen.add(f.name);
      w(`      ${f.name}: {`);
      const usable = f.args.filter((a) => a.udt);
      if (usable.length === 0) {
        w('        Args: Record<never, never>;');
      } else if (usable.some((a) => !a.name)) {
        // PostgREST passes RPC arguments by name, so a function with unnamed
        // parameters cannot be called through it at all. Typed loosely rather
        // than invented, because inventing names would make an uncallable
        // function look callable.
        w('        /** Has unnamed parameters — not callable through PostgREST. */');
        w('        Args: Record<string, unknown>;');
      } else {
        w('        Args: {');
        for (const a of usable) {
          w(`          ${a.name}${a.optional ? '?' : ''}: ${argType(a.udt)};`);
        }
        w('        };');
      }
      const ret = f.returns === 'void' ? 'undefined' : argType(f.returns);
      w(`        Returns: ${ret}${f.returns_set ? '[]' : ''};`);
      w('      };');
    }
    w('    };');
  }

  // --- Enums
  if (schemaEnums.size === 0) {
    w('    Enums: Record<never, never>;');
  } else {
    w('    Enums: {');
    for (const [name, values] of schemaEnums) {
      w(`      ${name}: ${values.map((v) => `'${v}'`).join(' | ')};`);
    }
    w('    };');
  }

  w('    CompositeTypes: Record<never, never>;');
  w('  };');
}

w('};');
w();

process.stdout.write(out.join('\n'));
