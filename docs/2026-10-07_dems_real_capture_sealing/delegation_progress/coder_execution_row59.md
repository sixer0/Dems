# coder-execution — row 59 (fMP4 writer, chains, checkpoints, truncation)

Status: **complete**. Note: `implementation/21_m3_fmp4_writer.md`. Nothing committed.

## Files

| File | Change |
|---|---|
| `apps/capture-worker/src/sink.c`, `worker.h`, `ingest.c`, `ipc.c`, `capture_worker.c` | writer, chains, sync thread, truncation, checkpoint and keyframe records, per-source log quota, protocol 3 |
| `apps/capture-worker/src/anchor.c`, `anchor.h`, `audio.c` (comment only), `test/anchor_test.c` | row 62's mediated clock change (without its live re-check) |
| `apps/capture-worker/Makefile`, `check.sh`, `test/static/planted.tsv`, `README.md` | unit targets, proof builds, static rules + 5 planted lines, fixture rule for `fake_cam_sr.py` |
| `apps/capture-worker/test/writer_test.c`, `log_test.c`, `writer_replay.c`, `tail_check.ts` (new); `sink_kill_test.c` | unit tests and e2e tools |
| `apps/capture-worker/test/m3worker.py`, `e2e.py` (shared) | row-59 cases; protocol 3; see note section 7 |
| `packages/capture-protocol/src/index.ts`, `test/protocol.test.ts` | protocol 3 |
| `apps/core-server/src/capture/supervisor.ts`, `fragments.ts` (new), `index.ts` (1 line) | record rule, tail validation |
| `apps/core-server/src/capture/__tests__/records.test.ts`, `fragments.test.ts` (new), `muxer-safety.test.ts` (new), `protocol-pins.test.ts`, `static.test.ts`, `supervisor.test.ts`, `ipc.test.ts`; `test/support/capture-stub-worker.mjs` | tests, pins, version literal |
| `apps/core-server/src/modules/recording-fragments/{index.ts,statements.ts,__tests__/recorder.test.ts,__tests__/recording-fragments.db.test.ts}` (new) | INSERT path + recorder |

## Checks for the test runner (not run again by this driver, D122)

| Command | Lock | Expected |
|---|---|---|
| `make -C apps/capture-worker e2e E2E_ARGS="--tag <tag> --ports 8559,8561"` (sandbox off, about 42 min) | takes `.locks/heavy-host.lock` itself | 105 checks, AGGREGATE EXIT CODE 0 |
| `/usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db src/modules/recording-fragments` | db lock | 25 passed |
| `npx vitest run --root apps/core-server --project unit src/capture/__tests__ src/modules/recording-fragments` | none | all pass (records 63, fragments 43, muxer-safety 5, recorder 31) |
| `npx vitest run --root packages/capture-protocol` | none | 23 passed |

## Open for others

- Row 71: mount the recorder; a clock-behind rule over several packets (D59-9); read `KEYFRAME_INTERVAL`.
- Row 82: call `validateCameraFile` / `insertMissing` / `classifyPartNames`.
- Row 84: the cipher behind `Sink.cipher`.
- Row 61: storage check should test `link()` on the evidence volume.
- Red tests seen that are not this row's: `capture/adapters/__tests__/credential.test.ts`, `adapters/__tests__/static.test.ts`, `capture/fence/__tests__/fence.test.ts`; 4 type errors in other rows' files (listed in the note).
