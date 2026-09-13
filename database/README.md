# Ridgeline database

A disposable PostgreSQL 16 + PostGIS 3.4 instance matching
[database-schema.pdf](database-schema.pdf) — the `feature_types` /
`features` tables backing the collections in
[../backend/openapi.yaml](../backend/openapi.yaml).

It is **ephemeral by design**: the container's data directory is mounted on
`tmpfs`, so nothing survives a `docker compose down` (or even a restart of
the container). Every start runs the schema in [init/](init/) against a
clean database. This mirrors the rest of the project — `mock-api/` and
`backend/` both keep everything in memory too — so there's no real data
anywhere to lose, seed, or migrate.

Nothing in this repo talks to this database yet: `backend/` currently
implements the API contract with an in-memory store. This container exists
for whoever wires up a real persistence layer next.

## Requirements

Docker Engine with the Compose plugin (`docker compose`, not the old
standalone `docker-compose`). The devcontainer does not install Docker, so
run this from your host machine, or add a
[docker-outside-of-docker](https://github.com/devcontainers/features/tree/main/src/docker-outside-of-docker)
feature to `.devcontainer/devcontainer.json` if you want `docker compose` to
work inside the container too.

## Running

```bash
cd database
cp .env.example .env   # optional — defaults work as-is
docker compose up -d
```

Stop it (and discard all data) with:

```bash
docker compose down
```

## Connecting

The container publishes Postgres on the host port from `POSTGRES_PORT`
(default `5432`), with the credentials from `.env` (or the defaults below if
you skipped copying it):

| Setting  | Default      | Env var           |
| -------- | ------------ | ------------------ |
| Host     | `127.0.0.1`  | —                   |
| Port     | `5432`       | `POSTGRES_PORT`     |
| Database | `ridgeline`  | `POSTGRES_DB`       |
| User     | `ridgeline`  | `POSTGRES_USER`     |
| Password | `ridgeline`  | `POSTGRES_PASSWORD` |

```
postgres://ridgeline:ridgeline@127.0.0.1:5432/ridgeline
```

A quick shell, using the credentials baked into the running container:

```bash
docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

From another container on the same Docker network, use the service name
`db` as the host instead of `127.0.0.1`.

## Schema changes

Edit [init/001-schema.sql](init/001-schema.sql) (and regenerate
`database-schema.pdf` if you keep it in sync). `docker-entrypoint-initdb.d`
scripts only run against a fresh data directory, but since this database
never keeps data past a restart, `docker compose down && docker compose up
-d` is all a schema change needs.
