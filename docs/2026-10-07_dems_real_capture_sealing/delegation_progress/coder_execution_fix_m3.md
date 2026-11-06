# coder-execution - fix pass F-M3 (code review row 63, milestone M3)

- Status: **complete** (the whole worker e2e series ran once on the tree of this pass: 122 checks, 122 as expected, AGGREGATE EXIT CODE 0, tag `fixM3_full`)
- Date: 2026-10-10. Baseline: tree at `abf742f`. No commit, no migration, no lockfile write, no new dependency.
- Note: `implementation/116_fix_m3_review.md` (table finding | reproduced? | fix | test | status; spec decision of R63-02; decisions for the controller).
- Binding rules read and kept: `driver_rules_d94.md` (each check once, repeated only after a fail; no local camera or microphone; no attended variable; `adapters/local/__tests__/e2e/` not run).

## Files written

Worker (`apps/capture-worker/`):
- `src/worker.h`, `src/sink.c`, `src/ingest.c`, `src/capture_worker.c`, `src/ipc.c`, `src/anchor.h`, `src/anchor.c`
- `Makefile`, `check.sh`
- `test/writer_test.c`, `test/anchor_test.c`, `test/m3worker.py`, `test/e2e.py`, `test/start_checks.sh` (NEW)
- `test/static/pinned_calls.py`, `test/static/pinned-calls.tsv`, `test/static/planted.tsv`, `test/static/imports.pin` (NEW)
- `test-fixtures/fake_cam.c` (`--noise`), `test-fixtures/fake_cam_sr.py` (`--repeat-ts-at`)

Protocol (`packages/capture-protocol/`): `src/index.ts`, `test/protocol.test.ts`

Core server (`apps/core-server/`):
- `src/capture/supervisor.ts`, `src/capture/types.ts`, `src/capture/ipc.ts` (one header comment)
- `src/capture/index.ts` (section rule: the setting `maxFragmentBytes`, the sync-level log listener, the stale header paragraph, the export of `CaptureStopOutcome`)
- `src/capture/__tests__/review-m3.test.ts` (NEW), `supervisor.test.ts` (1 line), `records.test.ts` (2 type annotations), `protocol-pins.test.ts`, `static.test.ts` (comments of the `WAIVED` list)
- `src/capture/__tests__/fault-lifecycle.test.ts` (ONE case), `src/capture/__tests__/forwarder-engine.test.ts` (ONE case) - both in a folder fix F-M5 also edits; exact-string edits, notice line filed
- `test/support/capture.ts`, `test/static/guard-family.test.ts` (pin moved by delta)

Docs: `masterplan/05_capture_architecture_spec.md` (errata PE-R63-13 in §C.4 and PE-R63-14 in §I, exact-string inserts), `implementation/116_fix_m3_review.md`, this file, one line pair in `delegation_progress/file_claims.md`, eight lines in `delegation_progress/file_requests.md`.

## Not touched (as briefed)

`capture/forwarder.ts`, `capture-session/**`, `capture-notices/**`, `capture/boot/**`, `capture/fragments.ts`, `capture/{fence,adapters}/**`, `sealing/**`, `test/support/capture-stub-worker.mjs` (its HELLO literal was changed by fix F-M5 on this pass's request line), `app.ts` / `config.ts` / `index.ts` of the server.

## Request and notice lines filed (`file_requests.md`)

1. fix F-M5 - the stub worker's HELLO literal (DONE by fix F-M5).
2. fix F-M5 - NOTICE: the final shape of `CaptureStopOutcome` for the `INTERRUPTED` hand-off (R63-01).
3. fix F-M5 - NOTICE: the fake worker's release word and its `AUDIO_TIMELINE_END` on STOP.
4. fix F-M5 - NOTICE: telemetry outside the plan and an uncommanded switch now end the worker; one case of `forwarder-engine.test.ts` rewritten.
5. fix F-M5 - WANTED: keep `FIRST_DURABLE_FRAGMENT.syncLevel` in the session's capture facts (R63-09).
6. fix F-M5 - the reason name `FRAGMENT_SIZE_BOUND_REACHED` and a sentence (the wording is already in the shared source).
7. fix F-M7 (owner of `capture/boot/**`) - NOTICE + OPTIONAL: `CRASH LIBAVFORMAT_VERSION_MISMATCH` instead of HELLO; the boot probe cannot tell the sync level.
8. owner of `modules/recording-fragments/index.ts` - NOTE R63-17, a stale header.

No request to the manifest owner: the manifest has no field for a durability level (as ruled).

## Attributed, not fixed

- `src/capture/__tests__/static.test.ts` "the client never leaves the file": the ONVIF facade exports `connectionTargetOf` - an in-flight edit under `capture/adapters/**` (fix F-M4).
