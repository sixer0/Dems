# Checkpoint commit c06-pending (2026-10-13)

Branch `task4/input-av-core-port` (verified), head at start `0f5d2a8e`. Authority: decision U26 (full suite postponed; labelled checkpoint after light checks only), C32 and C61 (3) (schema steps apart where honest). No push, no history rewrite, no `git add -A/.`/`-u`, no stash/clean/reset/restore of files; only `git restore --staged` for one unstaging. No file content changed. Scratch scripts (read-only scan helpers) were in `$TMPDIR`, not in the repository.

This record is NOT committed; it goes in with the next commit.

## Step 1 - light checks (repository root unless stated)

| # | Command | Last result lines | Exit |
|---|---|---|---|
| 1 | `npm run typecheck` (root script: `npm run typecheck --workspaces --if-present`; ran capture-protocol, shared, core-server `tsc --noEmit`, core-web `tsc -b`, mobile, mock-core, transcriber `tsc --noEmit`) | no `error TS` line in the log; each workspace header followed by nothing | 0 |
| 2 | `cd apps/core-server && npx vitest run --project unit --maxWorkers=2 test/static static.test.ts` (the 19 files of `test/static` and the 28 `src/**/__tests__/static.test.ts`; no database project) | `Test Files  47 passed (47)` / `Tests  806 passed (806)` | 0 |
| 3 | `npm run lint` (root: oxlint in 6 workspaces, eslint in mobile) | 3 oxlint warnings in core-server (`capture/boot/__tests__/support.ts:95`, `evidence-export/__tests__/receiver-cli.test.ts:167`, `test/support/host-command-unit.db.test.ts:155`), no error | 0 |

The `ERROR: failed to copy trust settings of system certificate` lines in the vitest log are sandbox noise, not test output.

## Step 2 - what was in the tree

`git status --short | wc -l` = 673 (collapsed untracked folders); with `-uall` 740 paths. By area (`-uall`): apps/core-server 320, apps/capture-worker 32, apps/core-web 46, apps/mobile 5, packages/shared 48 (no other package), scripts 35, docs 253 (252 in the plan folder, 1 in `2026-10-07_dems_real_capture_sealing`), root files 1 (`ffprobe-export.txt`). Root `package.json`, `package-lock.json`, `README.md`: unchanged.

Exclusions confirmed: `git status` shows 0 paths under `apps/input-av/` (ignored by `.git/info/exclude:51`; `git ls-files | grep -c '^apps/input-av/'` = 0). Ignored: `.data/` (.gitignore:71), `.cache/` (:47), `.locks/` (:60), `node_modules/` (:12), `build/` (:16, covers `apps/capture-worker/build`). No path matching `.p8 .wrap .pem pg.env .env* .jwt_secret` appeared. `row_m1c.md` does not exist. Kept out: `ffprobe-export.txt`, `masterplan/06_design_macos_microphone.md`.

## Step 3 - secret scan (counts only)

The scan has no working-tree mode (only paths, `--tracked`, `--staged`). So a read-only scratch script (imports `scan` from `scripts/secret-scan/count-only.mjs`) scanned the tracked plus to-be-added files (11,329 files): session-token 20, device-credential 8, biometric-token 8, database-locator 10, camera-credential 58 (37 files), ingest-secret 4, private-key-pem 3, database-password-line 1, argon2-encoded 0, name rules 0.

Against the controller's baselines: ingest-secret 4 = 4, private-key-pem 3 = 3, database-password-line 1 = 1; camera-credential 58 vs 55. Measured against HEAD (0f5d2a8e) the blobs hold camera-credential 57 in 36 files and private-key-pem 2, so the recorded baselines do not equal HEAD's own counts (note for the controller); session-token, device-credential, biometric-token, database-locator are the same at HEAD as in the tree (20, 8, 8, 10) and are not "0" as the baseline text said.

New against HEAD (per-file comparison of the working tree with the HEAD blob): exactly two, both under a test directory:
- `apps/core-server/src/__tests__/capture-composition.test.ts` (untracked): camera-credential +1
- `apps/core-server/src/core/__tests__/writers.test.ts`: private-key-pem +1
No new hit in a non-test file; no file lost a hit. All other hits are at HEAD already. Staged scans before each commit: commit A 0 hits in 59 files; commit B 32 hits in 12 files (10 test files, `docs/2026-10-07.../03_api_contract.md` and `packages/shared/openapi/openapi.json`, both with their hits already at HEAD); name rules 0.

## Step 4 - the commits

### A: `f20c9b39` - schema steps 9 to 13, ONE commit (59 files, 70498 insertions, 166 deletions)

Why one: the five records (202, 051b, 114, d2, d3) list shared files (journal, `schema/meta.ts`, `schema/index.ts`, `commands/migrations.ts`, `test/db/contract-inventory.*`, `boot-checks`, `migrate`, `commands`, `set4` tests) that move at every step; `git add -p` is unavailable; the agents' patches `.cache/task4-r6/step1..3.patch` pre-date later pin moves and cover only three steps. File list (staged by named path, sorted staged list equal to the input list, `EQUAL`):
- `apps/core-server/src/db/migrations/`: 0019-0029 SQL (11), snapshots 0019-0029 (11), `meta/_journal.json` (23)
- `apps/core-server/src/db/schema/`: capture, checks, index, meta, value-sets, installation (6)
- `apps/core-server/src/db/commands/migrations.ts`, `src/db/store/store.ts`, `src/db/fixtures/minimums.ts` (3)
- `apps/core-server/test/db/`: 16 changed (contract inventory x3, catalog, constraints, fixtures, privileges, boot-checks, commands, migrate, set4-set9) + 10 new (deltas v9-v13, set10-set14) = 26, and `apps/core-server/test/support/seed.ts` (1). Total 23 + 6 + 3 + 26 + 1 = 59.
Checked before commit: `apps/input-av/` staged 0; excluded patterns staged 0.

### B: `1fbeada7` - everything else, batch 9 onward (679 files, 112382 insertions, 12327 deletions)

Staged with `git add -- apps/core-server apps/capture-worker apps/core-web apps/mobile packages scripts docs/2026-10-12_input_av_core_adapter_plan docs/2026-10-07_dems_real_capture_sealing/masterplan/03_api_contract.md`, then `git restore --staged -- docs/2026-10-12_input_av_core_adapter_plan/masterplan/06_design_macos_microphone.md` (unstaging only). Staged by area: apps/core-server 261, apps/capture-worker 32, apps/core-web 46, apps/mobile 5, packages/shared 48, scripts 35, plan folder 251, task-3 contract document 1. Checked: `apps/input-av/` 0, excluded patterns 0, files over 3 MB 0, deletions 0. Pin files with schema pins and other rows' test code are here, as the message of A says. No root file was staged.

Both messages carry the label (UNVERIFIED CHECKPOINT, U26), the checks run and not run, the unsettled "another row's" reds, and the exact trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Step 5 - after

- `git log --oneline -4`: `1fbeada7`, `f20c9b39`, `0f5d2a8e`, `b60a9fa3`.
- `git diff --stat HEAD~2 HEAD`: 738 files changed, 182880 insertions(+), 12493 deletions(-). A alone: 59 files; B alone: 679 files.
- `git status --short`: `?? docs/2026-10-12_input_av_core_adapter_plan/masterplan/06_design_macos_microphone.md`, `?? ffprobe-export.txt` (before this record was written). Nothing under `apps/input-av/`.
- `git status -sb`: `## task4/input-av-core-port` with no upstream (`no upstream configured`): nothing pushed.
