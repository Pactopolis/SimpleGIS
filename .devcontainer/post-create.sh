#!/usr/bin/env bash
# Verify the toolchain matches the versions this project is developed against,
# then install dependencies for the frontend.
#
# Node and Python are pinned at build time by the devcontainers features in
# devcontainer.json -- do not install them here. nvm cannot be driven from a
# postCreate script in these images because npm has a global prefix configured,
# which nvm refuses to work alongside.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

NODE_VERSION="22.23.2"
NPM_VERSION="10.9.8"
PYTHON_VERSION="3.12.7"

echo "node: $(node -v)  npm: $(npm -v)  python: $(python --version)  ($(uname -m), $(. /etc/os-release && echo "$PRETTY_NAME"))"

if [ "$(node -v)" != "v${NODE_VERSION}" ]; then
  echo "ERROR: expected Node v${NODE_VERSION}, got $(node -v)." >&2
  echo "       Fix the node feature version in .devcontainer/devcontainer.json" >&2
  echo "       and rebuild the container." >&2
  exit 1
fi

# npm 10.9.8 ships bundled with Node 22.23.2, so this normally does nothing.
if [ "$(npm -v)" != "${NPM_VERSION}" ]; then
  echo "npm is $(npm -v), installing ${NPM_VERSION}..."
  npm install --global "npm@${NPM_VERSION}"
fi

if [ "$(npm -v)" != "${NPM_VERSION}" ]; then
  echo "ERROR: expected npm ${NPM_VERSION}, got $(npm -v)." >&2
  exit 1
fi

if [ "$(python --version)" != "Python ${PYTHON_VERSION}" ]; then
  echo "ERROR: expected Python ${PYTHON_VERSION}, got $(python --version)." >&2
  echo "       Fix the python feature version in .devcontainer/devcontainer.json" >&2
  echo "       and rebuild the container." >&2
  exit 1
fi

echo "Toolchain pinned: node $(node -v), npm $(npm -v), python $(python --version)"

# The workspace is a bind mount, so its owner UID rarely matches the container
# user and git refuses to operate on it ("detected dubious ownership").
if ! git config --global --get-all safe.directory 2>/dev/null | grep -qxF "$PWD"; then
  git config --global --add safe.directory "$PWD"
  echo "Marked $PWD as a git safe.directory"
fi

# Suppress the initial-branch-name hint on `git init`.
git config --global init.defaultBranch main

(
  cd frontend
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
)

# Catch an import or syntax error now rather than on the first request. -B
# keeps __pycache__ out of the bind-mounted workspace. The mock API is
# standard library only, by design, so there is no requirements.txt.
(
  cd mock-api
  python -B -c "import server"
)


# docker-compose.yml (full-stack dev stack: db + backend + frontend, hot
# reloading) bind-mounts source directories. This devcontainer's Docker
# daemon runs outside the container (docker-outside-of-docker), so a
# relative bind-mount path resolves against the daemon's filesystem, not
# this container's, and silently mounts an empty directory. Detect the real
# host path this workspace is bind-mounted from and record it in .env so
# `docker compose up` uses it instead of the (wrong) relative default.
if [ -f /.dockerenv ] && command -v docker >/dev/null 2>&1; then
  host_repo_root="$(docker inspect "$(hostname)" \
    --format "{{ range .Mounts }}{{ if eq .Destination \"$PWD\" }}{{ .Source }}{{ end }}{{ end }}" \
    2>/dev/null || true)"

  if [ -n "$host_repo_root" ]; then
    [ -f .env ] && grep -v '^HOST_REPO_ROOT=' .env > .env.tmp && mv .env.tmp .env
    echo "HOST_REPO_ROOT=${host_repo_root}" >> .env
    echo "Detected host path for docker-compose.yml bind mounts: ${host_repo_root} (written to .env)"
  fi
fi

echo "Ready. Run: npm --prefix frontend run dev   (and, separately) python mock-api/server.py"
