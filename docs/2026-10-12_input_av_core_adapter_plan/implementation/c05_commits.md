# C-05 commits (2026-10-13)

Branch: `task4/input-av-core-port` (verified with `git branch --show-current`, before and after). No push. Nothing staged beyond the two commits. File lists used: scratch `/tmp/claude-501/c1.txt`, `c2.txt` (not kept).

## Commit 1 - schema set B

- Hash: `b60a9fa3`, 73 files changed, 14018 insertions(+), 255 deletions(-).
- Staged by exact path: list (a) of the records 099, 192 (no own file) and 100, plus `development-session.db.test.ts` (list (b) of 099; `git diff` showed 2 hunks, both the version pin `[8, 'dbc-9']`).
- Check: sorted staged list equals the sorted input list (`EQUAL`); `git diff --cached --name-only | grep -c -E '^apps/(input-av|capture-worker)/|HW-ACC'` = 0.
- Deviation 1 - set-B pin left for commit 2 (carry other rows' hunks, so not staged in commit 1):
  - `apps/core-server/src/modules/capture-discovery/connect/__tests__/connect.db.test.ts` (16 hunks, row 51 stream test and adoption)
  - `apps/core-server/src/modules/capture-inputs/audio-cards/__tests__/routes.db.test.ts` (18 hunks, row 190)
  - `apps/core-server/src/capture/fence/__tests__/fence.db.test.ts` (13 hunks, row 33)
- Deviation 2 - `docs/2026-10-07_dems_real_capture_sealing/masterplan/03_api_contract.md` (1 added line, row 100 list (a)) went into commit 1 with its record, not commit 2.
- `packages/shared/openapi/openapi.json` was checked: only the permission count/enum/grant hunks of row 100 (staged in commit 1).

## Commit 2 - everything else finished

- Hash: `0f5d2a8e`, 268 files changed, 31226 insertions(+), 480 deletions(-).
- Staged by name from `git ls-files -m -o --exclude-standard` filtered to the allowed paths (apps/core-server, apps/core-web, apps/mobile, packages/shared, scripts/host, scripts/hardware-acceptance, `.dockerignore`, the plan folder), minus the exclusions below.
- Checks: `apps/input-av/` = 0; `apps/capture-worker/` = 0; `HW-ACCEPTANCE-` = 0.
- `scripts/secret-scan`, `packages/capture-protocol`: no change in `git status`.

## Left unstaged

| Path | Why |
|---|---|
| `apps/capture-worker/` (modified files and new `src/guard/`, `test-fixtures/*`, `test/guard_*`) | Linux portability row editing |
| `scripts/hardware-acceptance/HW-ACCEPTANCE-1..4-*.md` | documentation row revising (4 now shows modified too) |
| `scripts/host/container/` (`Dockerfile.ubuntu-24.04` 08:47, `build-in-container.sh` 08:47, `README.md` 10:27) | untracked; README changed about 1h40 after the other files were created, so treated as modified since creation |
| `ffprobe-export.txt` (repo root, untracked) | outside the allowed list |
| `apps/input-av/`, `.cache/`, `.claude/`, lockfiles | not touched |

`docs/.../implementation/c05_commits.md` (this file) stays uncommitted, as expected.

## Final state

`git log --oneline -4`: 0f5d2a8e, b60a9fa3, 3b388746, 6e6707dd. `git status --short | wc -l` = 34.
