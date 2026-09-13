# Tests backend/, database/, and frontend/ together in one container.
#
#   ./test/run.sh
#
# ...or the two docker commands that script wraps, run from the repo root
# (the build context, since COPY below reaches into frontend/, backend/,
# etc. — the context is not this directory):
#
#   docker build -f test/Dockerfile -t ridgeline-test .
#   docker run --rm -t ridgeline-test
#
# `docker run` is the actual test run (see test-all.sh) — the build just
# assembles the environment, so re-running the tests after an edit doesn't
# require rebuilding the image unless dependencies changed.
#
# This mirrors the real dev setup rather than inventing a separate one:
# Node 22.23.2 (frontend/backend's pinned engine) plus PostgreSQL 16 /
# PostGIS (database/docker-compose.yml's postgis/postgis:16-3.4, as close as
# Debian's official apt packages get — see the version note below).

FROM node:22.23.2-bookworm

# --- PostgreSQL 16 + PostGIS ------------------------------------------------
# Debian bookworm's own apt repo only ships PostgreSQL 15, so pull 16 from
# the official PGDG repository instead, to match database-schema.pdf and
# database/docker-compose.yml. PGDG's PostGIS package currently resolves to
# the 3.6.x line rather than the 3.4.x that docker-compose.yml pins — close
# enough for exercising the schema, which uses nothing version-specific.
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && install -d /usr/share/postgresql-common/pgdg \
  && curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail \
       https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
       > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-16 postgresql-16-postgis-3 \
  && rm -rf /var/lib/apt/lists/*

ENV POSTGRES_MAJOR_VERSION=16 \
    POSTGRES_DB=ridgeline_test \
    POSTGRES_USER=ridgeline \
    POSTGRES_PASSWORD=ridgeline

WORKDIR /workspace

# Frontend dependencies in their own layer, so editing source doesn't bust
# this cache — only touching package.json/package-lock.json does. backend/
# has no dependencies to install (see backend/package.json).
COPY frontend/package.json frontend/package-lock.json frontend/
RUN npm --prefix frontend ci

COPY . .
# The postgres server runs as the non-root `postgres` user; make sure it can
# read the repo regardless of what permissions the build context had.
RUN chmod -R a+rX /workspace && chmod +x test/test-all.sh

CMD ["test/test-all.sh"]
