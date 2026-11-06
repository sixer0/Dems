#!/bin/bash
# Smoke test of the DEMS Core image (task 4 row DK). SIMULATED operation, throw-away everything.
#
#   deploy/docker/smoke-test.sh [<image tag>]
#
# What it does, in a fresh compose project under .cache/docker-smoke/ (git-ignored) with compose.isolated.yaml
# (one private network namespace, nothing published, nothing reachable from outside):
#   1. three random throw-away database passwords, an .env with DEMS_CAPTURE_MODE=simulated and no installation id;
#   2. db up (first initialisation: roles, loopback, scram); db:create, db:migrate, db:seed, db:status on dems_demo;
#   3. core up; GET http://127.0.0.1:4420/api/v1/health from inside;
#   4. console up; GET http://127.0.0.1:5173/ and GET http://127.0.0.1:5173/api/v1/health (through its proxy);
#   5. ALWAYS, also after a failure: docker compose down --volumes, and the project folder removed.
# Never: production capture, a camera, a microphone, the host network, a registry push.
set -uo pipefail

ROOT=$(git rev-parse --show-toplevel)
IMAGE=${1:-dems/core:task4-$(git -C "$ROOT" rev-parse --short=8 HEAD)-unverified}
WITH_LCD=${2:-}
# Test every service on the image's target CPU, including PostgreSQL, even on an emulated builder.
export DOCKER_DEFAULT_PLATFORM=$(docker image inspect "$IMAGE" --format '{{.Os}}/{{.Architecture}}')
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
PROJECT="dems-smoke-$(printf '%s' "$STAMP" | tr 'A-Z' 'a-z')"
DIR="$ROOT/.cache/docker-smoke/$PROJECT"
LOG="$ROOT/.cache/docker-smoke/$PROJECT.log"
mkdir -p "$DIR"
exec > >(tee "$LOG") 2>&1
extra=()
if [ "$WITH_LCD" = --with-lcd ]; then extra=(-f "$DIR/compose.lcd-smoke.yaml" --profile lcd); fi
dc() { docker compose --project-name "$PROJECT" --project-directory "$DIR" -f "$DIR/compose.yaml" -f "$DIR/compose.isolated.yaml" "${extra[@]}" --profile console --profile tools "$@"; }

say() { printf '[smoke %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
RESULT=FAIL
cleanup() {
  say "teardown: docker compose down --volumes --remove-orphans"
  dc down --volumes --remove-orphans --timeout 30 2>&1 | sed 's/^/  /'
  rm -rf "$DIR"
  say "teardown done; project folder removed; RESULT $RESULT"
}
trap cleanup EXIT

cp "$ROOT/deploy/docker/compose.yaml" "$ROOT/deploy/docker/compose.isolated.yaml" "$DIR/"
cp -R "$ROOT/deploy/docker/postgres-init" "$DIR/"
install -d -m 0700 "$DIR/secrets"
for name in dems_pg_superuser_password dems_pg_owner_password dems_pg_app_password; do
  ( umask 077; openssl rand -hex 32 > "$DIR/secrets/$name" )
  chmod 0444 "$DIR/secrets/$name"
done
cat > "$DIR/.env" <<ENV
DEMS_IMAGE=$IMAGE
DEMS_CORE_PORT=4420
DEMS_PG_PORT=4432
DEMS_LOG_LEVEL=info
DEMS_DEMO_CONTROLS=0
DEMS_CAPTURE_MODE=simulated
DEMS_CAPTURE_DEV_SOURCES=0
ENV
if [ "$WITH_LCD" = --with-lcd ]; then
  printf 'DEMS_LCD_BACKEND_URL=http://127.0.0.1:8090\n' >> "$DIR/.env"
  cat > "$DIR/compose.lcd-smoke.yaml" <<'LCD'
services:
  lcd:
    # This test never maps or opens a host USB device.
    devices: !reset []
    environment:
      DEMS_DEV: /dev/absent-test-panel
LCD
fi

wait_healthy() { # wait_healthy <service> <seconds>
  local svc=$1 limit=$2 t=0 id state
  id=$(dc ps -q "$svc")
  while [ "$t" -lt "$limit" ]; do
    state=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null)
    [ "$state" = healthy ] && { say "$svc healthy after ${t}s"; return 0; }
    sleep 5; t=$((t + 5))
  done
  say "$svc NOT healthy after ${limit}s (state $state)"; return 1
}
fetch() { # fetch <service> <url>: status line and the first 300 characters of the body, from inside the namespace
  dc exec -T "$1" node -e '
    fetch(process.argv[1]).then(async (r) => { const b = await r.text(); console.log("HTTP " + r.status + " " + process.argv[1] + " " + b.slice(0, 300).replace(/\s+/g, " ")); process.exit(r.ok ? 0 : 1); },
                               (e) => { console.log("FETCH FAILED " + process.argv[1] + " " + e.message); process.exit(1); });' "$2"
}

say "image $IMAGE ($(docker image inspect "$IMAGE" --format '{{.Os}}/{{.Architecture}} {{.Id}}'))"
say "project $PROJECT in $DIR"
dc config -q || exit 1

say "step 2: db up"
dc up -d db || exit 1
wait_healthy db 300 || { dc logs db | tail -40; exit 1; }
dc logs db | grep -E '10-dems-roles|database system is ready|listening on' | sed 's/^/  /'
for step in "db:create" "db:migrate" "db:seed" "db:status"; do
  say "tools $step --database dems_demo"
  dc run --rm -T tools "$step" --database dems_demo 2>&1 | sed 's/^/  /'
  rc=${PIPESTATUS[0]}
  say "$step exit $rc"
  [ "$rc" = 0 ] || exit 1
done

say "step 3: core up"
dc up -d core || exit 1
if ! wait_healthy core 900; then dc logs core | tail -60; exit 1; fi
dc logs core | grep -E '"msg":"(configuration loaded|Server listening|capture|boot)' | head -12 | cut -c1-400 | sed 's/^/  /'
fetch core http://127.0.0.1:4420/api/v1/health || exit 1
dc exec -T core sh -c 'grep -E "^(NoNewPrivs|CapBnd|CapEff|Uid)" /proc/$(pgrep -f "src/index.ts" | head -1)/status; ps -o user=,pid=,args= -C node | cut -c1-160' | sed 's/^/  /'

say "step 4: console up"
dc up -d console || exit 1
t=0; until fetch console http://127.0.0.1:5173/ >/dev/null 2>&1 || [ "$t" -ge 600 ]; do sleep 5; t=$((t + 5)); done
fetch console http://127.0.0.1:5173/ || { dc logs console | tail -40; exit 1; }
fetch console http://127.0.0.1:5173/api/v1/health || { dc logs console | tail -40; exit 1; }
dc logs console | tail -n 8 | sed 's/^/  /'
if [ "$WITH_LCD" = --with-lcd ]; then
  say 'step 5: included LCD service, no USB device'
  dc up -d lcd || exit 1
  wait_healthy lcd 60 || { dc logs lcd | tail -20; exit 1; }
  dc exec -T core node -e '
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      for (let i = 0; i < 20; i++) {
        const r = await fetch("http://127.0.0.1:8090/api/dems/status");
        const b = await r.json();
        if (b.channels.length === 4 && b.channels.every((c) => c.last_post_s !== null)) {
          if (b.nrec !== 0 || b.last_req_ms !== 0) throw Error("LCD fabricated recording or USB liveness");
          console.log("LCD PASS: Python+serial installed, four channels synchronized from Core; no recording and no USB claim");
          return;
        }
        await sleep(1000);
      }
      throw Error("Core never synchronized to LCD");
    })().catch((e) => { console.error(e.message); process.exit(1); });' || exit 1
fi
RESULT=PASS
