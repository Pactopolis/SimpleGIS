# Ridgeline Operational Picture

A Cesium-based 3D map viewer for tracking points of interest, areas of
interest, and trail routes, backed by the Ridgeline Operational Picture API.

## Getting started (devcontainer)

Open the repository root in VS Code and reopen it in the devcontainer
(`.devcontainer/`). It provisions Node 22.23.2 and Python 3.12.7, installs the
frontend's npm dependencies, and forwards the ports both projects use:

| Port | Service |
| ---- | ------- |
| 5173 | Vite dev server (frontend) |
| 4173 | Frontend static preview server |
| 8080 | Mock API / backend |

Once the container is up, run the frontend and an API server in separate
terminals — see their own READMEs linked below for exact commands. The
frontend's dev server proxies `/v1` requests to `http://127.0.0.1:8080`, so
start the API server first (or in any order, just make sure both end up
running). Either `mock-api/` or `backend/` will do — they implement the same
contract.

The devcontainer also gets Docker itself via the `docker-outside-of-docker`
feature, so `database/` (see below) and the root `Dockerfile` both work from
inside it — commands run against your host's (or Docker Desktop's) Docker
daemon, same as running them outside the container.

## Layout

- **[frontend/](frontend/)** — the Vue 3 + Cesium map viewer. Runnable; see
  [frontend/README.md](frontend/README.md).
- **[mock-api/](mock-api/)** — a standard-library-only Python implementation
  of the API contract, for local development without a real backend.
  Runnable; see [mock-api/README.md](mock-api/README.md).
- **[backend/](backend/)** — `openapi.yaml`, the API contract, plus a Node
  implementation of it with an in-memory store. Runnable; see
  [backend/package.json](backend/package.json) (`npm start`, `npm test`).
- **[database/](database/)** — a disposable dockerized PostgreSQL/PostGIS
  instance matching the data model, for whoever wires up real persistence.
  Runnable; see [database/README.md](database/README.md).
- **[Dockerfile](Dockerfile)** — builds and runs the backend, database, and
  frontend test suites together in one container: `docker build -t
  ridgeline-test . && docker run --rm ridgeline-test`.
- **[emails/](emails/)** — correspondence with reference to requirements and
  design decisions (KML support, geometry handling, overlays, etc.).

## License

[MIT](LICENSE)
