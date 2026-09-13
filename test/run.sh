#!/usr/bin/env bash
# One-command version of the two docker commands in test/Dockerfile's header
# comment: build the test image, then run it. Prints a clear banner between
# the two phases so a long, quiet `docker build` doesn't read as "nothing is
# happening" before the actual test output (test/test-all.sh) appears.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "==> Building test image..."
docker build -f test/Dockerfile -t ridgeline-test .

echo
echo "==> Running tests..."

# Not `docker run --rm -t` directly: an attached run of this image reliably
# gets killed by the Docker daemon the moment postgres finishes starting in
# the background inside it (reproduced with plain `pg_ctl`, and even a bare
# `sleep 5 &` in an unrelated image — something about this environment's
# docker-outside-of-docker socket forwarding and an attached container that
# forks a child). Running detached and following logs sidesteps it, with the
# same live output.
container="ridgeline-test-$$"
trap 'docker rm -f "$container" >/dev/null 2>&1' EXIT

docker run -d --name "$container" ridgeline-test >/dev/null
docker logs -f "$container"
exit "$(docker wait "$container")"
