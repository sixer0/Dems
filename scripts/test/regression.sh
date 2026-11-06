#!/bin/sh
# `npm run test:regression`: the whole regression, STRICTLY one step after another (never two at
# once), in the order and with the commands of test/17 Part A, plus the capture worker's own
# checks. It stops at the first step that fails and names it. `npm test` is unchanged and runs
# none of the steps marked (*).
#
#   1  typecheck, all workspaces            8  mobile unit
#   2  lint, all workspaces                 9  transcriber unit (real-engine tests are not run)
#   3  shared unit                         10  mock-core unit
#   4  capture-protocol unit               11  pg-scripts
#   5  core-server unit                    12  capture worker: static rules, self-test, C unit tests, build (*)
#   6  core-server db (*)                  13  seal e2e (*)
#   7  core-web unit                       14  development-session e2e (*)
#                                          15  kill matrix, the active cells (*)
#                                          16  capture worker e2e series (*)
#
# Needs: the project PostgreSQL running (`npm run pg:start`), the development helper
# (`npm run capture:dev-setup`), the FFmpeg libraries the worker links, and the Bash sandbox off
# (loopback ports, PostgreSQL). No device, no camera, no microphone is opened. About 75 minutes
# on a quiet host, of which step 16 is about 35; `DEMS_REGRESSION_SKIP_WORKER_E2E=1` leaves
# step 16 out and says so in the last line.
# Run from the repository root (npm does).
set -eu
n=0
step() {
  n=$((n + 1))
  name=$1
  shift
  echo "== test:regression step $n: $name"
  "$@" || { rc=$?; echo "== test:regression FAILED at step $n: $name (exit $rc)" >&2; exit "$rc"; }
}
step "typecheck" npm run typecheck
step "lint" npm run lint
step "shared unit" npm run test -w @dems/shared
step "capture-protocol unit" npm run test -w @dems/capture-protocol
step "core-server unit" npx vitest run --root apps/core-server --project unit --maxWorkers=4
step "core-server db" /usr/bin/lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=2
step "core-web unit" npm run test -w @dems/core-web
step "mobile unit" npx -w apps/mobile jest --maxWorkers=2
step "transcriber unit" npm run test -w @dems/transcriber
step "mock-core unit" npm run test -w @dems/mock-core
step "pg-scripts" npm run test:pg-scripts
step "capture worker checks" npm run test:capture-worker
step "seal e2e" npm run test:seal-e2e
step "development-session e2e" npm run test:dev-session-e2e
step "kill matrix" npm run test:kill-matrix
if [ "${DEMS_REGRESSION_SKIP_WORKER_E2E:-}" = "1" ]; then
  echo "== test:regression GREEN: $n steps; the capture worker e2e series was LEFT OUT (DEMS_REGRESSION_SKIP_WORKER_E2E=1)"
else
  step "capture worker e2e series" npm run test:capture-worker-e2e
  echo "== test:regression GREEN: $n steps"
fi
