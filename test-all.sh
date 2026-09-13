#!/usr/bin/env bash
# Runs the backend, database, and frontend test suites together in one
# container. `docker run --rm <image>` is the whole cross-stack test run;
# its exit code is the result.
#
# backend/ and frontend/ each have their own test suite already (and
# backend/test/contract.test.ts already runs the frontend's real API client
# against the backend). This script just gives the three parts of the repo
# one command and one pass/fail signal, with the actual PostgreSQL/PostGIS
# schema exercised too, rather than assumed compatible.
set -uo pipefail

failures=()

section() {
  echo
  echo "=========================================="
  echo "  $1"
  echo "=========================================="
}

check() {
  local label="$1"
  shift

  if ! "$@"; then
    failures+=("$label")
  fi
}

section "database: starting PostgreSQL ${POSTGRES_MAJOR_VERSION} / PostGIS"
pg_ctlcluster "${POSTGRES_MAJOR_VERSION}" main start

ready=false
for _ in $(seq 1 30); do
  if pg_isready -q; then
    ready=true
    break
  fi
  sleep 1
done

if [ "${ready}" != true ]; then
  echo "postgres did not become ready in time" >&2
  exit 1
fi

runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${POSTGRES_DB};"
runuser -u postgres -- psql -v ON_ERROR_STOP=1 \
  -c "CREATE USER ${POSTGRES_USER} WITH PASSWORD '${POSTGRES_PASSWORD}' SUPERUSER;"

section "database: applying schema (database/init)"
check "database: schema" \
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "${POSTGRES_DB}" -f database/init/001-schema.sql

section "database: constraint tests (database/test)"
check "database: constraints" \
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "${POSTGRES_DB}" -f database/test/schema.test.sql

section "backend: npm test"
check "backend: npm test" bash -c "cd backend && npm test"

section "frontend: npm test"
check "frontend: npm test" bash -c "cd frontend && npm test"

section "frontend: typecheck"
check "frontend: typecheck" bash -c "cd frontend && npm run typecheck"

pg_ctlcluster "${POSTGRES_MAJOR_VERSION}" main stop

echo
if [ "${#failures[@]}" -eq 0 ]; then
  echo "ALL GREEN — backend, database, and frontend tests all passed together."
  exit 0
fi

echo "FAILED: ${failures[*]}"
exit 1
