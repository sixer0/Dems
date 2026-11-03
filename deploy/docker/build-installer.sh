#!/usr/bin/env bash
# Export an offline, architecture-specific Core+LCD+PostgreSQL installer. Builds/pushes nothing.
set -euo pipefail
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"
ARCH=${1:-amd64}
case "$ARCH" in amd64|arm64) ;; *) echo 'usage: build-installer.sh amd64|arm64 <core-image>' >&2; exit 2 ;; esac
IMAGE=${2:?Supply the exact smoke-tested Core image tag}
PLATFORM=linux/$ARCH
[ "$(docker image inspect --platform "$PLATFORM" "$IMAGE" --format '{{.Architecture}}')" = "$ARCH" ]
PG_SOURCE=postgres:18.4@sha256:a02db8cac496f15b094798a38254f14d6e00741f709360e5e00bb6668ea31636
PG_IMAGE=dems/postgres:18.4-lcd-$ARCH
[ "$(docker image inspect --platform "$PLATFORM" "$PG_SOURCE" --format '{{.Architecture}}')" = "$ARCH" ]
docker tag "$PG_SOURCE" "$PG_IMAGE"
NAME=DEMS-Linux-Docker-LCD-20261019-$ARCH-unverified
OUT=$ROOT/release/installers
mkdir -p "$ROOT/.cache/installer-package"
STAGE_PARENT=$(mktemp -d "$ROOT/.cache/installer-package/$NAME.XXXXXX")
STAGE=$STAGE_PARENT/$NAME
[ ! -e "$OUT/$NAME.tar.gz" ] || { echo "Refusing to overwrite $OUT/$NAME.tar.gz" >&2; exit 1; }
mkdir -p "$OUT" "$STAGE"
cp deploy/docker/installer/install.sh deploy/docker/installer/INSTALL-ID.md "$STAGE/"
cp deploy/docker/compose.yaml deploy/docker/.env.example "$STAGE/"
cp -R deploy/docker/postgres-init "$STAGE/"
SMOKE_LOG=${3:-$ROOT/.cache/lcd-installer-smoke-$ARCH-final.log}
[ -f "$SMOKE_LOG" ] && grep -Fq "image $IMAGE (" "$SMOKE_LOG" && grep -Fq 'RESULT PASS' "$SMOKE_LOG" && grep -Fq 'LCD PASS:' "$SMOKE_LOG" || {
  echo 'Supply the passing LCD smoke log for this exact image as argument 3' >&2; exit 1;
}
awk '/image |HTTP 200|LCD PASS:|RESULT PASS/{print}' "$SMOKE_LOG" > "$STAGE/SMOKE-TEST.txt"
cp apps/lcd-backend/README.md "$STAGE/LCD-README.md"
cp THIRD_PARTY_NOTICES.md "$STAGE/THIRD_PARTY_NOTICES.md"
printf '%s\n' "$ARCH" > "$STAGE/PACKAGE-ARCH"
printf 'DEMS_IMAGE=%s\nDEMS_POSTGRES_IMAGE=%s\n' "$IMAGE" "$PG_IMAGE" > "$STAGE/images.env"
docker image save --platform "$PLATFORM" "$IMAGE" "$PG_IMAGE" | gzip -n -6 > "$STAGE/images.tar.gz"
# Read provenance from the actual image rather than implying a clean git commit.
id=$(docker create --platform "$PLATFORM" --entrypoint /bin/true "$IMAGE")
trap 'docker rm "$id" >/dev/null 2>&1' EXIT
docker cp "$id:/opt/dems/core/.dems-source-sha256.txt" "$STAGE/SOURCE-SHA256SUMS.txt"
docker cp "$id:/opt/dems/container/BUILD-INFO.txt" "$STAGE/IMAGE-BUILD-INFO.txt"
mkdir -p "$STAGE/licenses"
docker cp "$id:/usr/share/doc/python3-serial/copyright" "$STAGE/licenses/pyserial-copyright.txt"
docker rm "$id" >/dev/null
trap - EXIT
{
  printf 'DEMS Linux Docker + LCD; WIP / production unverified\nArchitecture: %s\n' "$PLATFORM"
  printf 'Package generated UTC: %s\nBase git commit: %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$(git rev-parse HEAD)"
  printf 'Working tree changes are included; see IMAGE-BUILD-INFO.txt and SOURCE-SHA256SUMS.txt.\n'
  docker image inspect --platform "$PLATFORM" "$IMAGE" --format 'Core+LCD image: {{.Id}} ({{.Architecture}})'
  docker image inspect --platform "$PLATFORM" "$PG_IMAGE" --format 'PostgreSQL 18.4 image: {{.Id}} ({{.Architecture}})'
  printf 'Includes Python 3 and serial 3.5; LCD service uses the Core image.\n'
  printf 'LCD software integration: targeted tests passed. Container smoke: see SMOKE-TEST.txt.\n'
  printf 'No physical USB/ESP32 or production recording acceptance is implied. No deployment credentials included.\n'
} > "$STAGE/BUILD-INFO.txt"
python3 - "$STAGE" <<'PY'
import hashlib, pathlib, sys
root = pathlib.Path(sys.argv[1])
lines = []
for p in sorted(root.rglob('*')):
    if p.is_file() and p.name != 'SHA256SUMS':
        h = hashlib.sha256()
        with p.open('rb') as f:
            for chunk in iter(lambda: f.read(1024*1024), b''): h.update(chunk)
        lines.append(h.hexdigest()+'  '+p.relative_to(root).as_posix()+'\n')
(root / 'SHA256SUMS').write_text(''.join(lines))
PY
(cd "$STAGE" && ./install.sh verify)
COPYFILE_DISABLE=1 tar -czf "$OUT/$NAME.tar.gz" -C "$(dirname "$STAGE")" "$NAME"
(cd "$OUT" && shasum -a 256 "$NAME.tar.gz" > "$NAME.tar.gz.sha256")
printf 'Installer: %s\n' "$OUT/$NAME.tar.gz"
