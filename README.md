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
| 8080 | Mock API |

Once the container is up, run the frontend and the mock API in separate
terminals — see their own READMEs linked below for exact commands. The
frontend's dev server proxies `/v1` requests to `http://127.0.0.1:8080`, so
start the mock API first (or in any order, just make sure both end up
running).

## Layout

- **[frontend/](frontend/)** — the Vue 3 + Cesium map viewer. Runnable; see
  [frontend/README.md](frontend/README.md).
- **[mock-api/](mock-api/)** — a standard-library-only Python implementation
  of the API contract, for local development without a real backend.
  Runnable; see [mock-api/README.md](mock-api/README.md).
- **[backend/](backend/)** — the API contract and data model: `openapi.yaml`
  and `database-schema.pdf`. Reference only, not runnable.
- **[emails/](emails/)** — correspondence with reference to requirements and
  design decisions (KML support, geometry handling, overlays, etc.).

## License

[MIT](LICENSE)
