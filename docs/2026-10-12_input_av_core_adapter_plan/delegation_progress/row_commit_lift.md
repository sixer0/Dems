# Row commit_lift - class-C lift stage 1 committed (Tier 3)

Status: complete. Commit d9df31ac9a31f7ac5da7b5e31b29aa9c9a94bd1b on task4/input-av-core-port, parent cb06d42c. 97 files, 3610 insertions, 371 deletions. No push, no amend, no hooks skipped, explicit path list only (no `add -A`).

## Staging
- Source: `git status --porcelain -z -uall` = 130 paths at staging time (105 ` M`, 25 `??`); 97 staged, 33 excluded. No deletes or renames.
- Pin check (`git diff -U0 | grep dbc-16 / schema version`): every RD1 edit sits in a file whose only change is RD1's. No file carried an RD1/RD2 edit together with an edit of another row (so nothing to split or report). `apps/core-server/src/capture/fence/__tests__/development-session.db.test.ts` is listed in RD1's claim for pin lines but carries only N11a's change (timelineSamples etc.): committed.
- Excluded (33):
  - RD1 db: `src/db/schema/{capture,index,meta}.ts`; `src/db/migrations/{0032_capture_device_retirement.sql, 0033_capture_device_retirement_privileges.sql, meta/_journal.json, meta/0032_snapshot.json, meta/0033_snapshot.json}`; `src/db/commands/migrations.ts`; `src/db/fixtures/__tests__/bulk-fixture.db.test.ts` (pin only).
  - RD1 test/db: `catalog.db.test.ts, constraints.db.test.ts, contract-inventory.{json,test.ts,ts}, privileges.db.test.ts, boot-checks.db.test.ts, contract-v15-delta.ts` (new).
  - RD2: `packages/shared/**` (12 modified incl. `src/i18n/en/common.ts` which appeared during the run, + new `src/api/capture-retire.ts`).
  - `ffprobe-export.txt` (root, untouched, not deleted). `apps/input-av/` and ignored paths: absent from status.
- Not staged: `.data/`, `.cache/`, `*.pem`, `*.key` (grep of the cached name list: empty). No RD1/RD2 path in the cached list (grep: empty).

## Checks
- `git diff --cached --check`: clean (exit 0, no output).
- Secret scan `count-only.mjs --staged`: 97 files, 8 hits in 6 files, NAME hits 0. Five of the six files are unchanged against HEAD in count (m3worker.py 1, capture-composition.test.ts 1, supervisor.test.ts 1+1 ingest, protocol.test.ts 2: all test files, scanned from HEAD copies). New: `decisions/decisions.md` 1 and `delegation_progress/row_checkpoint_2.md` 1 - both the text `rtsp://u:p@192.0.2.10/s` (RFC 5737 documentation range, accepted at C144), quoted in prose.
- `--tracked` (working tree): camera-credential 69 (baseline 67, +2 = the two prose quotes above), private-key-pem 3, database-password-line 1, ingest-secret 4, session-token 20, device-credential 8, biometric-token 8, database-locator 10 (all equal baselines).

## After the commit
- `git log -1 --stat | tail -3`: last two lines `packages/capture-protocol/src/index.ts | 174`, `packages/capture-protocol/test/protocol.test.ts | 194`, `97 files changed, 3610 insertions(+), 371 deletions(-)`.
- Remaining `git status --porcelain` = 37 lines, all excluded classes: RD1 db 10, RD1 test/db 9, RD2 shared 17, ffprobe-export.txt 1. Nothing else.

## Light checks stated in the message (not re-run here)
Core tsc errors in the tree come only from RD2's uncommitted contract change; static sets green at row 88; capture tests 627/627; worker series and kill matrix on the new binaries being re-run (run B+) - not proven at this commit.

## Open for the controller
AM-1's status column should carry the hash d9df31ac. Files under the RD1/RD2 claims keep changing (status grew from 127 to 130 to 37-remaining during the run); the commit is a snapshot of the index taken at staging.
