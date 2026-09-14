# ridgeline-web

Vue 3 + Cesium frontend for the Ridgeline Operational Picture. Renders
points of interest, areas of interest, trail routes, and directional camera
coverage cones on a 3D globe, with forms for creating each feature type.

Requires Node 22.23.2 / npm 10.9.8 (pinned in `package.json#engines`; the
repo-root devcontainer provisions this exactly). Talks to the API at `/v1`,
proxied in dev to `http://127.0.0.1:8080` — run [mock-api](../mock-api/) (or
a real backend) alongside it.

## Running

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

## Other scripts

```bash
npm run build           # typecheck, then build to dist/
npm run preview         # serve the built dist/ with Vite's preview server (http://localhost:4173)
npm start                # serve the built dist/ with server.js instead
npm test                 # run tests once
npm run test:watch       # run tests in watch mode
npm run typecheck        # vue-tsc, no emit
```

`server.js` is a zero-dependency static file server for `dist/`, useful for
running the production build without Vite. It binds `0.0.0.0` by default
(overridable with `--host`/`--port` or the `HOST`/`PORT` env vars).
