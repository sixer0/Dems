#!/bin/bash
# Builds the DEMS Core image (task 4 row DK) from the TRACKED files of this working tree, and optionally saves it.
#
#   deploy/docker/build-image.sh [--platform linux/amd64|linux/arm64] [--tag <tag>] [--save | --save-only]
#
# 1. Refuses to build when the verbatim block of deploy/docker/Dockerfile differs from lines 30-107 of
#    scripts/host/container/Dockerfile.ubuntu-24.04 (the FFmpeg build is that file's, not a second one).
# 2. Stages the build context in .cache/docker-context/ (git-ignored): the tracked files, AS THEY ARE in the working
#    tree, of the workspaces the Core needs, nothing else. Never staged: .data, apps/input-av, docs, scripts/host
#    (the address helper is a service of the host), the mobile app and the mock Core (their package.json only, for
#    the lock file). The repository's own /.dockerignore is not touched: it belongs to the check container.
# 3. docker build under the heavy-host lock. Default tag dems/core:task4-<short commit>-unverified, with -arm64
#    appended for an arm64 build.
# 4. --save: docker save | gzip -n into release/docker/ (git-ignored) with a .sha256 file. --save-only: steps 1-3 are
#    skipped and the image already tagged is saved as it is (the image a smoke test ran is the image archived).
# Pushes nothing anywhere.
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"
PLATFORM=linux/amd64
TAG=
SAVE=0
SAVE_ONLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --platform) PLATFORM=$2; shift 2 ;;
    --tag) TAG=$2; shift 2 ;;
    --save) SAVE=1; shift ;;
    --save-only) SAVE=1; SAVE_ONLY=1; shift ;;
    *) echo "usage: $0 [--platform linux/amd64|linux/arm64] [--tag <tag>] [--save | --save-only]" >&2; exit 2 ;;
  esac
done
case "$PLATFORM" in linux/amd64) ARCH=amd64 ;; linux/arm64) ARCH=arm64 ;; *) echo "platform $PLATFORM not supported" >&2; exit 2 ;; esac
HEAD=$(git rev-parse HEAD)
SHORT=$(git rev-parse --short=8 HEAD)
if [ -z "$TAG" ]; then
  TAG="dems/core:task4-${SHORT}-unverified"
  [ "$ARCH" = amd64 ] || TAG="${TAG}-${ARCH}"
fi
say() { printf '[build-image] %s\n' "$*"; }
if [ "$SAVE_ONLY" = 0 ]; then

# 1. The verbatim block.
SRC_DF=scripts/host/container/Dockerfile.ubuntu-24.04
if ! awk '/^# >>> BEGIN VERBATIM/{f=1;next} /^# <<< END VERBATIM/{f=0} f' deploy/docker/Dockerfile | cmp -s - <(sed -n '30,107p' "$SRC_DF"); then
  echo "[build-image] REFUSED: the verbatim block of deploy/docker/Dockerfile differs from $SRC_DF lines 30-107" >&2
  exit 1
fi
say "verbatim block = $SRC_DF lines 30-107 (sha256 of that file: $(shasum -a 256 "$SRC_DF" | cut -d' ' -f1))"

# 2. The context.
PATHS=(package.json package-lock.json .npmrc .node-version tsconfig.base.json THIRD_PARTY_NOTICES.md
       apps/core-server apps/core-web apps/transcriber apps/capture-worker packages/shared packages/capture-protocol
       apps/mobile/package.json apps/mock-core/package.json deploy/docker)
CTX_PARENT=.cache/docker-context
CTX="$CTX_PARENT/dems-core-$ARCH"
rm -rf "$CTX"
mkdir -p "$CTX"
LIST="$CTX_PARENT/files-$ARCH.lst"
: > "$LIST"
# Tracked files of the paths, plus the not-ignored untracked files of deploy/docker (this folder, before it is
# committed). Ignored files - .env, ./secrets - are never staged.
while IFS= read -r -d '' f; do
  case "$f" in deploy/docker/secrets/.gitignore) continue ;; apps/input-av/*|.data/*|docs/*|scripts/*|deploy/docker/secrets/?*|deploy/docker/.env) echo "[build-image] REFUSED: $f would be staged" >&2; exit 1 ;; esac
  [ -f "$f" ] && printf '%s\0' "$f" >> "$LIST"
done < <(git ls-files -z -- "${PATHS[@]}"; git ls-files -z --others --exclude-standard -- deploy/docker)
tar -c --null -T "$LIST" -f - | tar -x -f - -C "$CTX"
rm -f "$CTX/deploy/docker/secrets/.gitignore"
printf '%s\n' '**/.DS_Store' '**/node_modules' '.git' > "$CTX/.dockerignore"

# The base image for THIS platform. The classic builder (the only one here: no buildx) takes the local image of a
# multi-platform index for the machine's own platform, whatever --platform says. So the STAGED copy of the
# Dockerfile names the platform's own manifest, read now from the pinned index - the same image the index points to
# for that platform. The committed Dockerfile and its verbatim block are not changed.
BASE_INDEX=sha256:534baea6a22c03a63003dbc8dbe78fe34bc0d7e595d9a9dc9834884ff530eb55
BASE_CHILD=$(docker manifest inspect "ubuntu:24.04@$BASE_INDEX" | node -e '
  const m = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const [os, arch] = process.argv[1].split("/");
  const hit = m.manifests.filter((x) => x.platform && x.platform.os === os && x.platform.architecture === arch);
  if (hit.length !== 1) { console.error("no single manifest for " + process.argv[1]); process.exit(1); }
  process.stdout.write(hit[0].digest);' "$PLATFORM")
[[ "$BASE_CHILD" =~ ^sha256:[0-9a-f]{64}$ ]] || { echo "[build-image] REFUSED: no manifest of $PLATFORM in the pinned index" >&2; exit 1; }
sed "s|^FROM ubuntu:24.04@$BASE_INDEX|FROM ubuntu@$BASE_CHILD|" deploy/docker/Dockerfile > "$CTX/Dockerfile.staged"
[ "$(grep -c "^FROM ubuntu@$BASE_CHILD" "$CTX/Dockerfile.staged")" = 3 ] || { echo "[build-image] REFUSED: base substitution did not hit the three stages" >&2; exit 1; }
say "base image for $PLATFORM: ubuntu@$BASE_CHILD (manifest of the pinned index ubuntu:24.04@$BASE_INDEX)"
{
  echo "DEMS Core image - task 4 row DK - UNVERIFIED"
  echo "base commit: $HEAD (branch $(git rev-parse --abbrev-ref HEAD))"
  echo "built from the working tree: tracked files as they are on disk; uncommitted changes in the staged paths:"
  git status --porcelain=v1 -- "${PATHS[@]}" | sed 's/^/  /'
  echo "staged at (UTC): $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "platform: $PLATFORM; tag: $TAG"
  echo "base image: ubuntu@$BASE_CHILD = the $PLATFORM manifest of the pinned index ubuntu:24.04@$BASE_INDEX"
  echo "verification: tsc 0 in every workspace (decision C156); NO test suite was run on this tree"
} > "$CTX/.dems-build-info.txt"
say "context: $(tr -cd '\0' < "$LIST" | wc -c | tr -d ' ') files, $(du -sh "$CTX" | cut -f1) in $CTX"

# 3. The build.
mkdir -p .locks
LOG="$CTX_PARENT/build-$ARCH.log"
say "docker build --platform $PLATFORM -t $TAG (log: $LOG)"
start=$(date +%s)
set +e
/usr/bin/lockf -k -t 10800 .locks/heavy-host.lock \
  docker build --platform "$PLATFORM" --build-arg "DEMS_BASE_COMMIT=$HEAD" -f "$CTX/Dockerfile.staged" -t "$TAG" "$CTX" 2>&1 | tee "$LOG"
rc=${PIPESTATUS[0]}
set -e
say "docker build exit $rc after $(( $(date +%s) - start )) s"
[ "$rc" = 0 ] || exit "$rc"
docker image inspect "$TAG" --format 'image id {{.Id}}  {{.Os}}/{{.Architecture}}  {{.Size}} bytes'

fi

# 4. The archive.
if [ "$SAVE" = 1 ]; then
  [ "$(docker image inspect "$TAG" --format '{{.Architecture}}')" = "$ARCH" ] || { echo "[build-image] REFUSED: $TAG is not a $ARCH image" >&2; exit 1; }
  say "saving $(docker image inspect "$TAG" --format '{{.Id}}')"
  mkdir -p release/docker
  git check-ignore -q release/docker/probe || { echo "[build-image] REFUSED: release/ is not git-ignored" >&2; exit 1; }
  NAME=$(printf '%s' "$TAG" | tr '/:' '__')
  OUT="release/docker/${NAME}.linux-${ARCH}.tar.gz"
  docker save "$TAG" | gzip -n -6 > "$OUT"
  ( cd release/docker && shasum -a 256 "$(basename "$OUT")" > "$(basename "$OUT").sha256" )
  say "archive: $OUT  $(stat -f %z "$OUT") bytes  sha256 $(cut -d' ' -f1 "$OUT.sha256")"
fi
