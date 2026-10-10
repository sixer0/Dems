---
row: 82 (M7-W1) — sealing pipeline v2
agent: coder-execution
date: 2026-10-09
status: needs-review
note: implementation/37_m7_sealing_pipeline.md
---

# Row 82 — status and files

**Status: needs-review.** Pipeline with seal-time encryption (ruling D147), engine doors, session machine: built and proven on generated recordings (note section 9 is the current state). NOT DONE: the composition unit, the op 83 route, the seal of a worker-recorded session, the demo regeneration. F-82-3 / F-82-4 are with pass D4. No commit, no migration.

## Files

New:
- `apps/core-server/src/sealing/pipeline/{contract,camera-files,package-writer,pipeline,controller}.ts`
- `apps/core-server/src/sealing/{signing,dev-key-cli}.ts`
- `apps/core-server/src/sealing/__tests__/{pipeline-support.ts,pipeline.test.ts,signing.test.ts}`
- `apps/core-server/src/engine/seal-doors.ts`, `apps/core-server/src/engine/__tests__/seal-actions.db.test.ts`
- `packages/shared/test/sim-core-driven-seal.test.ts`
- `docs/.../implementation/37_m7_sealing_pipeline.md`

Edited:
- `packages/shared/src/sim/session-machine.ts` (D121 step ETA; Core-driven seal; verdict record)
- `apps/core-server/src/sealing/index.ts` (exports)
- `apps/core-server/src/engine/host.ts` (seal block: one helper, three doors, own import block; one type added to the host's annotation), `engine/types.ts` (`EngineSealDoors`), `engine/limits.ts` (three labels), `engine/index.ts` (two export lines), `engine/__tests__/static.test.ts` (file count 17 -> 18)
- `apps/core-server/package.json` (one script line `evidence:dev-key`)
- `apps/core-server/src/sealing/__tests__/stt-states.test.ts` (pinned file list; capture-import rule narrowed to the transcript step — decision D-82-8)
- `apps/core-server/src/modules/recording-fragments/__tests__/recording-fragments.db.test.ts` (two fixture lines, row 71a's request)
- `delegation_progress/file_claims.md` (3 lines), `file_requests.md` (10 lines)

Not touched: `modules/recording-fragments` production files, `packages/shared/scripts/gen-demo-evidence.ts`, `app.ts`, `db/**`, `sim/api.ts`.

## Checks run by the driver (once each, after the last change unless said)

| Check | Result |
|---|---|
| `vitest --project unit src/sealing src/engine/__tests__/static.test.ts test/static` (core-server) | 21 files, 329 passed |
| `vitest test/sim-core-driven-seal.test.ts test/session-machine.test.ts test/sim-v2-parity.test.ts test/sim-api.test.ts` (shared) | 74 passed; `integration-c1.test.ts` 1 red by design (D146 (1), filed) |
| db: `seal-actions.db.test.ts`, `recording-fragments.db.test.ts` (run before the pipeline rework; no engine or db file changed after) | 33 passed |
| typecheck core-server, shared | exit 0 |
| lint both | 0 findings in this row's files |
| 15 mutations | 15 red |

## Checks for the test runner

| ID | Command | Lock | Expected |
|---|---|---|---|
| R82-1 | `npx vitest run --root packages/shared` | none | green; any red in a simulator sealing test names `session-machine.ts` (step `etaMs` is now per step) |
| R82-2 | `npx vitest run --root apps/core-server --project unit` | none (sandbox off) | baseline 3 MODG failures + other rows' in-flight; none in `src/sealing`, `src/engine` |
| R82-3 | `/usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db src/engine src/sealing src/modules/recording-fragments` | db | green; `seal-actions.db.test.ts` 8 passed (two assertions are MEASURED findings F-82-3 / F-82-4 and turn red by design when the mapping is opened) |
| R82-4 | web + mobile suites that read `finalization.steps[].etaMs` (rows 87 / 92 finalizing folders) | none | green: the running step's ETA is its own remaining time |
| R82-5 | `npm run evidence:dev-key -w @dems/core-server -- --data-dir <a scratch directory>` twice | none | first OK with a DEVELOPMENT subject, second `KEY_EXISTS`; never against `.data/` without the user |
