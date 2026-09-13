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

if [ -t 1 ]; then
  green=$'\033[32m'; red=$'\033[31m'; bold=$'\033[1m'; reset=$'\033[0m'
else
  green=""; red=""; bold=""; reset=""
fi

failures=()

section() {
  echo
  echo "=========================================="
  echo "  $1"
  echo "=========================================="
}

# Runs a subprocess with its output line-buffered (rather than fully
# buffered, which is what most tools default to once stdout isn't a
# terminal — as it never is here) so progress streams out live instead of
# arriving in one delayed dump at the end.
check() {
  local label="$1"
  shift

  if stdbuf -oL -eL "$@"; then
    echo "${green}PASS${reset} — ${label}"
  else
    echo "${red}FAIL${reset} — ${label}"
    failures+=("$label")
  fi
}

echo "${bold}Starting cross-stack test run (backend, database, frontend)...${reset}"

section "database: starting PostgreSQL ${POSTGRES_MAJOR_VERSION} / PostGIS"

# pg_ctl directly rather than pg_ctlcluster (Debian's higher-level wrapper
# around it): -o passes the config pg_ctlcluster would otherwise assemble
# from /etc/postgresql, so this needs no cluster-registry involvement, just
# pg_ctl start -w to block until ready instead of a manual pg_isready poll.
# (Note: an early version of this script had the whole container silently
# die right after postgres finished starting, no matter which of these two
# tools started it — that turned out to be about *how the container itself
# was run*, not this. See run.sh.)
PG_BIN="/usr/lib/postgresql/${POSTGRES_MAJOR_VERSION}/bin"
PG_DATA="/var/lib/postgresql/${POSTGRES_MAJOR_VERSION}/main"
PG_CONF="/etc/postgresql/${POSTGRES_MAJOR_VERSION}/main"

runuser -u postgres -- "${PG_BIN}/pg_ctl" start -w \
  -D "${PG_DATA}" \
  -l "/var/log/postgresql/postgresql-${POSTGRES_MAJOR_VERSION}-main.log" \
  -o "-c config_file=${PG_CONF}/postgresql.conf -c hba_file=${PG_CONF}/pg_hba.conf -c ident_file=${PG_CONF}/pg_ident.conf -c unix_socket_directories=/var/run/postgresql"

if ! pg_isready -q; then
  echo "${red}postgres did not start${reset}" >&2
  cat "/var/log/postgresql/postgresql-${POSTGRES_MAJOR_VERSION}-main.log" >&2
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

runuser -u postgres -- "${PG_BIN}/pg_ctl" stop -w -D "${PG_DATA}" -m fast

echo
echo "=========================================="
if [ "${#failures[@]}" -eq 0 ]; then
  echo "${bold}${green}ALL GREEN${reset}${bold} — backend, database, and frontend tests all passed together.${reset}"
  echo "=========================================="
  exit 0
fi

echo "${bold}${red}FAILED${reset}${bold}: ${failures[*]}${reset}"
echo "=========================================="
exit 1
