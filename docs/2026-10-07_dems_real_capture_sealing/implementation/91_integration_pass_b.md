---
task_id: 2026-10-07_dems_real_capture_sealing
row: 115 (integration pass B, decision D112)
date: 2026-10-09
agent: coder-execution
status: complete
---

# Integration pass B - the STT snapshot store in PostgreSQL

Replaces the in-memory snapshot store of row 115 (note 54, section 4) with the table `session_stt_config`
(migrations 0011/0012, note 60b section 5). A Core restart inside an open session no longer loses
transcription for that session.

## Built (all under `apps/core-server/src/transcription/`)
| What | Where |
|---|---|
| Two statements (`INSERT … ON CONFLICT (session_id) DO NOTHING`, `SELECT … WHERE session_id = $1`), row mapping (bigint text -> number; backend / credential kind / flags validated, `SnapshotRowError` for a row outside the contract). No UPDATE, DELETE, TRUNCATE or upsert exists. No import of `db/schema` (table named in text; the db test holds the columns to the real table) | `statements.ts` |
| `createDatabaseSnapshotStore(db)`: `put` = insert, then read back, returns what the table HOLDS (first snapshot, always); every failure thrown | `snapshot.ts` (`createDatabaseSnapshotStore`), head comment rewritten |
| Mount default: `deps.snapshots ?? createDatabaseSnapshotStore(app.db.pool)`; the memory store stays only for callers that pass one | `index.ts:205`, export `index.ts:80` |
| A refused put (23514 or any failure) -> `SNAPSHOT_STORE_FAILED`, ONE log line + ONE persistent error-log entry with `sqlstate`, no snapshot; `openSession` answers `NO_SNAPSHOT`, `tapPathFor` null: nothing transcribed, never the current configuration (existing path `index.ts` `fail()`, unchanged) | `index.ts` |

No credential column, no `credential_ref`; the snapshot type is unchanged.

## Tests
Existing unit tests that rely on the memory store now pass it explicitly (one added argument each):
`__tests__/session.test.ts` (mount), `__tests__/encrypted-credential.test.ts` (mount + import). Nothing weakened.

| File | Proves |
|---|---|
| `__tests__/snapshot-store.test.ts` (unit, 9) | statement texts; source scan: the table is named in `statements.ts` only and no UPDATE/DELETE/TRUNCATE/upsert in any unit source (positive control: 4 planted forms found); put returns the first; racing puts; row-contract refusals; error propagates; mount default is the DB store; 23514 -> no snapshot, 1 error line, `NO_SNAPSHOT`, tap null; control: lifted refusal stores and adds no error |
| `__tests__/snapshot-store.db.test.ts` (db, 7) | pin `[5,'dbc-6']` + ten columns, no credential column; write-once; 20 sessions x 3 simultaneous putters = 1 row, one snapshot for all; 23514 for 5 bad rows (stores nothing, store throws); UPDATE x2, DELETE, TRUNCATE = 42501 as `dems_app`; `M6-STTCFG-NEXT` across a restart, 2 runs |

## Commands and results
```
/usr/bin/lockf -k .locks/db-migrate.lock npm run -s test:db -w @dems/core-server -- src/transcription      # 7/7, run 3 times
  (+ op92-booted.db.test.ts, existing M6-STTCFG-NEXT on the booted server)                                   # 16/16 together
npx vitest run --root apps/core-server --project unit src/transcription test/static                          # 190 pass, 1 red (below)
npx vitest run … src/modules/stt-config src/modules/system src/sealing/__tests__/stt-states.test.ts         # 232/232
npm run -s typecheck -w @dems/core-server   # exit 0          npm run -s lint -w @dems/core-server   # exit 0, 0 messages in src/transcription
```
Restart evidence (console of the db test): run 1 `SES-…0601 kept rev 1 cpu-local/enabled=true | SES-…0602 took rev 2 omlx-server/enabled=true`;
run 2 `SES-…0611 kept rev 2 omlx-server/enabled=true | SES-…0612 took rev 3 omlx-server/enabled=false`. The session is read by a new app instance
(`transcriptionControl(after.app) !== transcriptionControl(before.app)`) after op 91 moved the row.

**Negative control.** Mount default temporarily forced to `createMemorySnapshotStore()` (production file restored byte-for-byte,
diffed): both restart runs RED at `snapshot-store.db.test.ts:188` (`sessionSnapshot` after the restart is `null`, expected the snapshot);
the five store tests stay green (they do not go through the mount). With the database store restored: 7/7.

**Attribution.** Static red: `test/static/imports.test.ts` "every closed unit exists and has an index" - `src/modules/capture-discovery`
(another row's folder). Not mine; no edit to `imports.test.ts` was needed (`src/transcription` is already a closed unit).

## Seams / said plainly
- `taken` in `SnapshotOutcome` is `true` for BOTH of two simultaneous callers of the same new session (each did a get -> null, then put); both
  get the identical snapshot. Row 71 starts a session once, so it does not matter; if it ever does, `taken` should compare the returned
  `takenAt` with the one offered. Not changed (outside the item).
- A 23514 on put cannot happen from `stt_config` today (its own CHECKs are the same set), so in production this path is a safety net; it is
  proven with the real table (store level) and with a stand-in pool (composition level), not end to end from a real invalid stored row.
- `mounted` (data directory exists) still gates the tap/scratch directory, not the store: an unmounted app now also writes snapshots to the
  database when asked. Nothing calls it today except tests.
- Real clones and rows: `dems_app` cannot delete test rows, so tests use fixed unique session ids per file; they live on the throw-away clone.
