#!/usr/bin/env bash
# Offline DEMS Linux Docker installer. Never resets a database or deletes a volume.
set -euo pipefail
cd "$(dirname "$0")"
fail() { printf 'DEMS: %s\n' "$*" >&2; exit 1; }
usage() {
  cat <<'HELP'
Usage: ./install.sh [install|verify|load|start|stop|status] [--lcd-device /dev/ttyACM0 | --without-lcd]
Default: install with LCD. Linux Docker Engine and Compose v2 must already be installed.
install: first installation only; creates private passwords, migrates/seeds a NEW demo database.
verify: checks every shipped file (no Docker changes).
load: imports bundled images only, no network or service start.
start/stop/status: operate an already configured installation; stop preserves all volumes.
Use the original installation folder for future starts; preserve .env and secrets/ with your backup.
HELP
}
command=${1:-install}
case "$command" in -h|--help) usage; exit 0 ;; install|verify|load|start|stop|status) [ $# = 0 ] || shift ;; *) usage; exit 2 ;; esac
[ "$command" = install ] || [ $# = 0 ] || fail 'LCD options apply to install only; edit .env for an existing installation'
lcd=1
serial_device=/dev/ttyACM0
while [ $# -gt 0 ]; do
  case "$1" in
    --without-lcd) lcd=0; shift ;;
    --lcd-device) [ $# -ge 2 ] || fail '--lcd-device needs a device path'; serial_device=$2; shift 2 ;;
    *) fail "unknown option: $1" ;;
  esac
done
verify() {
  [ -f SHA256SUMS ] || fail 'SHA256SUMS is missing; extract the complete package'
  if command -v sha256sum >/dev/null; then sha256sum -c SHA256SUMS
  else shasum -a 256 -c SHA256SUMS; fi
}
verify
[ "$command" != verify ] || exit 0
[ "$(uname -s)" = Linux ] || fail 'run this installer on the target Linux host'
case "$(uname -m)" in x86_64) host_arch=amd64 ;; aarch64|arm64) host_arch=arm64 ;; *) fail 'unsupported processor' ;; esac
[ "$host_arch" = "$(cat PACKAGE-ARCH)" ] || fail "wrong package architecture; this host needs $host_arch"
docker version >/dev/null || fail 'Docker Engine is not available'
docker compose version >/dev/null || fail 'Docker Compose v2 is required'
endpoint=$(docker context inspect --format '{{.Endpoints.docker.Host}}')
case "${DOCKER_HOST:-$endpoint}" in unix://*) ;; *) fail 'use the Docker Engine on this host, not a remote daemon' ;; esac
case "$(docker info --format '{{.OperatingSystem}}')" in *'Docker Desktop'*) fail 'use the Linux host Docker Engine for USB access' ;; esac
core_image=$(sed -n 's/^DEMS_IMAGE=//p' images.env)
pg_image=$(sed -n 's/^DEMS_POSTGRES_IMAGE=//p' images.env)
[ -n "$core_image" ] && [ -n "$pg_image" ] || fail 'image tags are missing'
load_images() {
  docker load -i images.tar.gz
  for image in "$core_image" "$pg_image"; do
    actual=$(docker image inspect --format '{{.Architecture}}' "$image")
    [ "$actual" = "$host_arch" ] || fail "image $image has an unexpected processor"
  done
}
if [ "$command" = load ]; then load_images; exit 0; fi
dc() { docker compose --project-name dems --project-directory "$PWD" --env-file .env -f compose.yaml "$@"; }
wait_healthy() {
  local service=$1 id state
  id=$(dc ps -q "$service")
  [ -n "$id" ] || fail "$service container was not created"
  for ((attempt=0; attempt<120; attempt++)); do
    state=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id")
    [ "$state" != healthy ] || return 0
    case "$state" in exited|dead) break ;; esac
    sleep 2
  done
  fail "$service did not become healthy; inspect ./install.sh status and docker compose logs $service"
}
if [ "$command" != install ]; then
  [ -f .env ] || fail 'this folder has not been installed; run install first'
  case "$command" in
    start) [ -f .installed ] || fail 'initial installation did not complete; inspect status/logs and preserve data before recovery'; dc up -d --pull never --no-build; wait_healthy core ;;
    stop) dc stop ;;
    status) dc ps ;;
  esac
  exit 0
fi
[ ! -e .env ] && [ ! -e secrets ] || fail 'existing configuration found; use start/status. Existing passwords and data were not changed'
for volume in dems_dems-pgdata dems_dems-data dems_dems-logs; do
  if docker volume inspect "$volume" >/dev/null 2>&1; then
    fail 'existing DEMS data found; use the original installation folder. Automatic replacement/upgrade is not supported'
  fi
done
[ -z "$(docker ps -aq --filter label=com.docker.compose.project=dems)" ] || fail 'an existing DEMS deployment was found'
if command -v ss >/dev/null; then
  if ss -H -ltn | awk '{print $4}' | grep -Eq ':(4420|4432|5173|8090)$'; then
    fail 'a DEMS port (4420,4432,5173,8090) is already in use'
  fi
fi
serial_gid=20
if [ "$lcd" = 1 ]; then
  case "$serial_device" in /dev/*) ;; *) fail 'the LCD device must be under /dev/' ;; esac
  [[ "$serial_device" =~ ^/dev/[A-Za-z0-9_./-]+$ ]] || fail 'unsupported characters in the serial device path'
  [ -c "$serial_device" ] || fail "LCD serial device $serial_device is missing; connect the panel or explicitly use --without-lcd"
  serial_device=$(readlink -f "$serial_device")
  serial_gid=$(stat -c '%g' "$serial_device")
  [[ "$serial_gid" =~ ^[0-9]+$ ]] || fail 'cannot determine the serial device group'
fi
command -v openssl >/dev/null || fail 'openssl is required to generate database passwords'
# Load and validate before creating configuration. Never fetch an image during install/start.
load_images
umask 077
mkdir secrets
for name in dems_pg_superuser_password dems_pg_owner_password dems_pg_app_password; do
  openssl rand -hex 32 > "secrets/$name"
  chmod 0444 "secrets/$name" # Docker mounts these for the non-root database/tool accounts.
done
cp .env.example .env
cat images.env >> .env
{
  printf '\n# Set by the offline installer\n'
  if [ "$lcd" = 1 ]; then
    printf 'COMPOSE_PROFILES=console,lcd\nDEMS_LCD_BACKEND_URL=http://127.0.0.1:8090\n'
    printf 'DEMS_LCD_SERIAL_DEVICE=%s\nDEMS_LCD_SERIAL_GID=%s\n' "$serial_device" "$serial_gid"
  else
    printf 'COMPOSE_PROFILES=console\nDEMS_LCD_BACKEND_URL=\n'
  fi
} >> .env
chmod 0600 .env
# Verify the resolved service graph before writing any database state.
dc config --quiet
dc up -d --pull never --no-build db
wait_healthy db
for step in db:create db:migrate db:seed db:status; do
  dc --profile tools run --rm -T --pull never tools "$step" --database dems_demo
done
dc up -d --pull never --no-build
wait_healthy core
if [ "$lcd" = 1 ]; then wait_healthy lcd; fi
touch .installed
printf '\nDEMS is ready: http://127.0.0.1:5173\n'
if [ "$lcd" = 1 ]; then
  printf 'LCD is included and configured. Inspect Devices & Inputs -> Front Panel -> LCD connection for USB liveness.\n'
fi
printf 'This package runs SIMULATED capture. Production recording and physical LCD acceptance are separate checks.\n'
