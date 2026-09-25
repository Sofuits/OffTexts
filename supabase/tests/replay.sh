#!/usr/bin/env bash
# =============================================================================
# Replay every migration from empty, then assert the schema is safe.
# =============================================================================
# Usage:  supabase/tests/replay.sh
#
# Drops and recreates a scratch database, installs the harness, applies every
# file in supabase/migrations in name order, and then runs the assertions in
# supabase/tests/assertions.sql.
#
# ON ERROR STOP is set for every file. A migration that fails stops the run at
# the file and line that failed, which is the whole point: finding that out
# here costs a second, finding it out from `supabase db push` costs a
# half-applied production schema.
# =============================================================================

set -euo pipefail

HOST="${PGHOST_DIR:-/home/pgtest/pg/sock}"
PORT="${PGPORT:-5433}"
DB="${PGDATABASE:-offtexts_test}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

psql_q() { psql -q -h "$HOST" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 "$@"; }

echo "→ recreating $DB"
psql_q -d postgres -c "drop database if exists $DB;" >/dev/null
psql_q -d postgres -c "create database $DB;" >/dev/null

echo "→ harness"
psql_q -d "$DB" -f "$ROOT/supabase/tests/_harness.sql" >/dev/null

for file in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ $(basename "$file")"
  psql_q -d "$DB" -f "$file" >/dev/null
done

echo "→ assertions"
psql -h "$HOST" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -d "$DB" \
  -f "$ROOT/supabase/tests/assertions.sql"

echo "→ behaviour"
# Only the NOTICEs matter here; psql's per-statement chatter does not.
psql -h "$HOST" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -d "$DB" \
  -f "$ROOT/supabase/tests/behaviour.sql" 2>&1 \
  | grep -Ev '^(INSERT|UPDATE|DELETE|DO|SELECT|BEGIN|ROLLBACK|CREATE|CALL|COMMIT|SET|RESET)' \
  | sed -E 's/^psql:[^ ]+ (NOTICE|INFO):  //' \
  | grep -v '^$' || true

echo
echo "All migrations applied. Assertions and behaviour tests passed."
