#!/bin/bash
# Entrypoint of the DEMS Core image (task 4 row DK). Installed as /usr/local/bin/dems-entrypoint.
#
# It runs as root for three things only, then drops to an unprivileged account for good:
#   1. the data directory <tree>/.data and the error log folder belong to dems-core, mode 0700 (HOST-06);
#   2. the database connection file <tree>/.data/pg.env (the runtime role dems_app, mode 0600, the five keys of
#      apps/core-server/src/config.ts CONNECTION_FILE_KEYS) is written from the mounted secret file
#      $DEMS_SECRETS_DIR/dems_pg_app_password; for a `db:*` command the owner file pg.owner.env likewise from
#      dems_pg_owner_password, and that file is REMOVED again when the command has ended;
#   3. the drop: setpriv to dems-core (or dems-console) with no inheritable capability, an EMPTY bounding set and
#      no new privileges (host profile HOST-38, HOST-39), NODE_OPTIONS unset (HOST-36).
# No secret value is printed, placed in an argument or exported into the environment of the Core.
#
# Modes:
#   core                    the Core server (default)
#   console                 the web console's development server on 127.0.0.1:5173, proxying /api/v1, /ws, /media
#                           and /exports to the Core on 127.0.0.1:$DEMS_CORE_PROXY_PORT (default 4420)
#   <script> [args...]      one script of apps/core-server/package.json from the list below, as dems-core
set -euo pipefail

TREE=/opt/dems/core
DATA=$TREE/.data
LOGS=$TREE/apps/core-server/logs
SECRETS=${DEMS_SECRETS_DIR:-/run/secrets}
PG_HOST=127.0.0.1
PG_PORT=${DEMS_PG_PORT:-4432}
TOOL_SCRIPTS=" db:create db:migrate db:seed db:status db:reset operator:set-password evidence:production-key evidence:rotate-key evidence:mark-compromised evidence:verify-export "

say() { printf 'dems-entrypoint: %s\n' "$*" >&2; }
refuse() { say "REFUSED: $*"; exit 64; }

[ "$(id -u)" = 0 ] || refuse "the container must start as root; it drops to the service account itself (deploy/docker/README.md)"
unset NODE_OPTIONS
export HOME=/nonexistent

# The database follows the listen port (config.ts databaseNameFor): 4420 -> dems_demo, 4421..4423 -> dems_lane_1..3.
case "${DEMS_CORE_PORT:-4420}" in
  4420) DB_NAME=dems_demo ;; 4421) DB_NAME=dems_lane_1 ;; 4422) DB_NAME=dems_lane_2 ;; 4423) DB_NAME=dems_lane_3 ;;
  *) refuse "DEMS_CORE_PORT must be one of 4420, 4421, 4422, 4423" ;;
esac
[[ "$PG_PORT" =~ ^[0-9]{1,5}$ ]] && [ "$PG_PORT" != 5432 ] || refuse "DEMS_PG_PORT must be a port number other than 5432"

drop_to() { # drop_to <account> <command...>: replaces nothing, returns the command's exit status
  local account=$1; shift
  setpriv --reuid="$account" --regid="$account" --init-groups --inh-caps=-all --bounding-set=-all --no-new-privs -- "$@"
}

prepare_dirs() {
  chown dems-core:dems-core "$DATA" "$LOGS"
  chmod 0700 "$DATA" "$LOGS"
}

# secret_value <name>: the one line of the secret file, checked; never printed by this script.
secret_value() {
  local file="$SECRETS/$1" value
  [ -f "$file" ] || refuse "secret $1 is not mounted (expected $file)"
  value=$(<"$file")
  [[ "$value" =~ ^[A-Za-z0-9._~+/=-]{16,128}$ ]] || refuse "secret $1 must be ONE line of 16 to 128 characters from A-Z a-z 0-9 . _ ~ + / = - (see README: openssl rand -hex 32)"
  printf '%s' "$value"
}

# write_private <path>: stdin to <path>, owner dems-core, mode 0600, by rename (no partly written file is ever read).
write_private() {
  local path=$1 tmp
  tmp="$path.tmp.$$"
  ( umask 077; cat > "$tmp" )
  chown dems-core:dems-core "$tmp"
  chmod 0600 "$tmp"
  mv -f "$tmp" "$path"
}

write_app_file() {
  if [ -f "$SECRETS/dems_pg_app_password" ]; then
    local pw
    pw=$(secret_value dems_pg_app_password)
    printf 'DEMS_PG_HOST=%s\nDEMS_PG_PORT=%s\nDEMS_PG_DATABASE=%s\nDEMS_PG_APP_ROLE=dems_app\nDEMS_PG_APP_PASSWORD=%s\n' \
      "$PG_HOST" "$PG_PORT" "$DB_NAME" "$pw" | write_private "$DATA/pg.env"
    unset pw
  elif [ ! -f "$DATA/pg.env" ]; then
    refuse "no secret dems_pg_app_password is mounted and $DATA/pg.env does not exist"
  fi
}

OWNER_FILE_WRITTEN=0
write_owner_file() {
  [ -f "$SECRETS/dems_pg_owner_password" ] || return 0
  local pw
  pw=$(secret_value dems_pg_owner_password)
  printf 'DEMS_PG_HOST=%s\nDEMS_PG_PORT=%s\nDEMS_PG_DATABASE=%s\nDEMS_PG_OWNER_ROLE=dems_owner\nDEMS_PG_OWNER_PASSWORD=%s\n' \
    "$PG_HOST" "$PG_PORT" "$DB_NAME" "$pw" | write_private "$DATA/pg.owner.env"
  unset pw
  OWNER_FILE_WRITTEN=1
}
remove_owner_file() { [ "$OWNER_FILE_WRITTEN" = 1 ] && rm -f "$DATA/pg.owner.env"; return 0; }

mode=${1:-core}
case "$mode" in
  core)
    prepare_dirs
    write_app_file
    if [ "${DEMS_CAPTURE_MODE:-simulated}" = real ] && [ "${DEMS_CAPTURE_DEV_SOURCES:-0}" != 1 ]; then
      say "NOTE: production capture requested inside a container. A container host is outside the Linux host profile"
      say "      (HOST-21 forbids a container runtime on the production host); the Core's own host checks decide the start."
    fi
    cd "$TREE/apps/core-server"
    exec setpriv --reuid=dems-core --regid=dems-core --init-groups --inh-caps=-all --bounding-set=-all --no-new-privs -- \
      "$TREE/node_modules/.bin/tsx" src/index.ts
    ;;
  console)
    export DEMS_CORE_PROXY_PORT=${DEMS_CORE_PROXY_PORT:-4420}
    export VITE_DEMS_CORE_MODE=${VITE_DEMS_CORE_MODE:-live}
    cd "$TREE/apps/core-web"
    vite_bin=$(node -p "require('path').join(require('path').dirname(require.resolve('vite/package.json')),'bin','vite.js')")
    # --configLoader runner: Vite loads vite.config.ts through its module runner. The default loader writes a
    # bundled copy of the config NEXT TO the file, and the tree is root-owned (HOST-05): EACCES, measured in this
    # row's first smoke run. The dependency cache is the one place it writes: apps/core-web/node_modules/.vite.
    exec setpriv --reuid=dems-console --regid=dems-console --init-groups --inh-caps=-all --bounding-set=-all --no-new-privs -- \
      node "$vite_bin" --configLoader runner
    ;;
  *)
    case "$TOOL_SCRIPTS" in *" $mode "*) ;; *) refuse "unknown mode '$mode': use core, console or one of:$TOOL_SCRIPTS" ;; esac
    shift
    prepare_dirs
    write_app_file
    case "$mode" in db:*) write_owner_file ;; esac
    trap remove_owner_file EXIT
    trap 'exit 130' INT TERM
    cd "$TREE"
    rc=0
    drop_to dems-core npm run --silent "$mode" -w @dems/core-server -- "$@" || rc=$?
    exit "$rc"
    ;;
esac
