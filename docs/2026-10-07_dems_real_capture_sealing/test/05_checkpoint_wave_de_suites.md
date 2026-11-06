# Checkpoint wave D/E — whole-suite runs (test runner, decision D122)

Date: 2026-10-10. Runner: test-expert (Sonnet). Tree: schema 6 / contract `dbc-7`, branch main, uncommitted working tree. Nothing was changed except this file; no commit, no git write. Every command run once from the repo root; a red FILE was re-run once. Command sandbox OFF for core-server unit/db, core-web, mobile, transcriber, mock-core and the worker (loopback / PostgreSQL / process priority); typecheck, lint, shared and capture-protocol ran inside the sandbox. No local device, no `DEMS_*_ATTENDED`, no `e2e/` folder of the local adapters, no `.data/` read, no port 5173-5175 / 8000 / 5432 connection, no install. `DEMS_SEAL_E2E` and `DEMS_DEV_SESSION_E2E` were unset.

## Result table

| # | command | exit | files / tests passed / failed / skipped | duration (wall) |
|---|---|---|---|---|
| 1a | `npm run typecheck -w` shared | 0 | clean | 3 s |
| 1b | typecheck core-server | 0 | clean | 8 s |
| 1c | typecheck core-web (`tsc -b`) | 0 | clean | 10 s |
| 1d | typecheck mobile | 0 | clean | 6 s |
| 1e | typecheck capture-protocol | 0 | clean | 0 s |
| 1f | typecheck transcriber | 0 | clean | 2 s |
| 1g | typecheck mock-core | 0 | clean | 1 s |
| 2a-g | `npm run lint -w` shared, core-server, core-web, capture-protocol, transcriber, mock-core (oxlint) | 0 each | no output (clean) | 0-1 s each |
| 2h | lint mobile (eslint) | 0 | 0 errors, 1 warning: `apps/mobile/src/runtime/log.test.ts:160:19` `@typescript-eslint/array-type` ("ReadonlyArray<T>" forbidden) | 14 s |
| 3 | `npm run test -w @dems/shared` | 0 | 92 files / 2396 passed / 0 failed / 0 skipped | 4.3 s |
| 4 | `npm run test -w @dems/capture-protocol` | 0 | 1 file / 29 passed / 0 / 0 | 0.1 s |
| 5a | `make -C apps/capture-worker check` | 0 | static rules OK (only prints one line; the target is the static rules alone) | <1 s |
| 5b | `make -C apps/capture-worker selftest` (separate target; brief lists it under "check") | 0 | every planted source refused as required | 9 s |
| 5c | `make -C apps/capture-worker unit` (separate target; NOT e2e) | 0 | anchor_test, micwatch_test, sink_kill_test (200 kills, violations 0), writer_test, log_test hold; all 8 negative controls fail as required | 19 s |
| 6 | core-server `--project unit --maxWorkers=4` | 0 | 277 files / 5928 passed / 0 failed / 0 skipped / 0 todo | 51 s |
| 7 | core-server `--project db --maxWorkers=2` under `.locks/db-migrate.lock` | 0 | 172 files (169 passed, 3 skipped) / 2334 passed / 0 failed / 5 skipped | 203 s |
| 8 | `npm run test -w @dems/core-web` (`--maxWorkers=4`) | **1** | 148 files (141 passed, **7 failed**) / 1799 passed / **39 failed** / 0 skipped | 87 s |
| 8r | re-run of the 7 red core-web files once | **1** | 7 files red / 31 passed / 39 failed (same 39) | 14 s |
| 9 | `npx -w apps/mobile jest --maxWorkers=2` | 0 | 240 suites / 2374 passed / 0 failed / 0 skipped / 0 todo | 130 s |
| 10a | `npm run test -w @dems/transcriber` (default `vitest.config.ts`: stand-in executable + in-process `fetch` seam; no engine, model or port) | 0 | 20 files / 557 passed / 0 failed / 3 skipped | 16 s |
| 10b | `npm run test -w @dems/mock-core` | 0 | 4 files / 19 passed / 0 / 0 | 4 s |

Skipped in 10: `test:real:*` of the transcriber (`vitest.real.config.ts`: real engines, models, oMLX on 8000). mock-core's tests listen on `127.0.0.1` port 0 (ephemeral) only; the `5173` strings in them are Origin header values, not connections.

## Reds (core-web, 39 tests in 7 files; each file red again on its single re-run, same counts)

Error legend: `SEQ` = `FakeTransportResponseError: Fake transport: the scripted 200 answer of listAudioSourceIntervals is not the contract's (checked at answering time; mark it { violatesContract: true } if that is the test) [INVALID_BODY]: items.0.seq: Too small: expected number to be >=1` (the table below shows SEQ followed by the tail "number to be >=1").


### `apps/core-web/src/test/live-d2-client-seams.test.tsx` — 4 red / re-run: 4 red (red again: yes)

- Session Monitor (WB-01): the development-source badge the camera on screen and the mic meter of a development source carry the badge; the others do not
  - first error: `SEQ number to be >=1`
- Session Monitor (WB-01): the development-source badge no device carries `sourceClass`: nothing is drawn
  - first error: `SEQ number to be >=1`
- a third microphone (`MIC-03`) on the Session Monitor: named by the id the Core sends the pair is the Core`s: active MIC-03, the toggle offers MIC 1, the confirmation names "MIC 3"
  - first error: `SEQ number to be >=1`
- a third microphone (`MIC-03`) on the Session Monitor: named by the id the Core sends when the Core says MIC-03 is its local microphone, the confirmation says "This Mac`s microphone" (D83)
  - first error: `SEQ number to be >=1`

### `apps/core-web/src/test/live-session-monitor-actions.test.tsx` — 16 red / re-run: 16 red (red again: yes)

- the page of this file is the Session Monitor on the Live source, at the address Live mode needs, with every session action open to the SUPERVISOR
  - first error: `SEQ number to be >=1`
- B-2 marker (C-1; LB-1, LB-4) success: one POST with the label, the chip waits at the button while the answer is out, a second press sends nothing, and the toast and the flight label are read in `ok`
  - first error: `SEQ number to be >=1`
- B-2 marker (C-1; LB-1, LB-4) refusal (AC-C-48): a 403 NOT_PERMITTED shows the denied toast naming the role; the chip leaves and the button returns to idle
  - first error: `SEQ number to be >=1`
- B-2 marker (C-1; LB-1, LB-4) outage (LB-6): the presenter's sentence, no success toast, no marker
  - first error: `SEQ number to be >=1`
- B-2 note (LB-1) success: Save is busy until the settle, then the drawer closes and the toast shows
  - first error: `SEQ number to be >=1`
- B-2 note (LB-1) refusal (AC-C-48) keeps the drawer open with the text and shows the denied toast
  - first error: `SEQ number to be >=1`
- B-2 note (LB-1) outage (LB-6) keeps the drawer open with the text
  - first error: `SEQ number to be >=1`
- B-2 snapshot (C-2; LB-4) success: the shutter flashes at the press, the toast follows the settle with the camera read in `ok`
  - first error: `SEQ number to be >=1`
- B-2 snapshot (C-2; LB-4) refusal (AC-C-48): the denied toast, no capture toast, the count unchanged
  - first error: `SEQ number to be >=1`
- B-2 snapshot (C-2; LB-4) outage (LB-6): the presenter's sentence and nothing else
  - first error: `SEQ number to be >=1`
- B-2 stop (LB-1, LB-6, LB-10; F59; Q16) success: one POST with the reason, the confirm busy until the settle, a second press sends nothing; the dialog closes and the overlay follows the state to SEALED
  - first error: `SEQ number to be >=1`
- B-2 stop (LB-1, LB-6, LB-10; F59; Q16) 422 INVALID_REASON (F59: the Core counts characters, the client code units): the reason field's error, the dialog stays open with the text
  - first error: `SEQ number to be >=1`
- B-2 stop (LB-1, LB-6, LB-10; F59; Q16) 409 because the session already ended (Q16): the dialog closes with the info toast
  - first error: `SEQ number to be >=1`
- B-2 stop (LB-1, LB-6, LB-10; F59; Q16) refusal (AC-C-48): a 403 NOT_PERMITTED shows the denied toast naming the role and closes the dialog
  - first error: `SEQ number to be >=1`
- B-2 stop (LB-1, LB-6, LB-10; F59; Q16) outage (LB-6) and limit (LB-10): the dialog stays open with the reason; a 429 is worded as a limit and never as an outage
  - first error: `SEQ number to be >=1`
- Simulated mode is unchanged (the simulator answers inside the press) no chip waits, no control turns busy and no pending state is revealed after a marker, a snapshot and a note
  - first error: `SEQ number to be >=1`

### `apps/core-web/src/test/live-session-monitor-audio-source.test.tsx` — 6 red / re-run: 6 red (red again: yes)

- a confirmed switch (operation 81; ux §3.2 steps 2-4) is sent once on the confirm, shows the new active input only when the Core reports it, and re-reads the intervals then
  - first error: `SEQ number to be >=1`
- refusals (ux §3.2 steps 5-6, §3.5) 409 AUDIO_SOURCE_CONFLICT: the fixed sentence stays on the panel; the pair does not change; one record of the page
  - first error: `SEQ number to be >=1`
- refusals (ux §3.2 steps 5-6, §3.5) 409 INVALID_STATE: "not recording" stays on the panel
  - first error: `SEQ number to be >=1`
- refusals (ux §3.2 steps 5-6, §3.5) 403 NOT_PERMITTED: the denied toast, no state change, no success toast
  - first error: `SEQ number to be >=1`
- Checking (E-16; G4) with the link down the toggle is disabled with "Checking your permissions…" and a press sends nothing
  - first error: `SEQ number to be >=1`
- the silence warning (OD-11) shows the warning of the Core's state and sends no switch by itself
  - first error: `SEQ number to be >=1`

### `apps/core-web/src/test/live-session-monitor-panels.test.tsx` — 10 red / re-run: 10 red (red again: yes)

- A9 re-verify (LB-2; [CS] §8.2) success: the Spinner holds until the Core answered; the chip shows the check over the audit view (PASS, then FAIL during a tamper)
  - first error: `SEQ number to be >=1`
- A9 re-verify (LB-2; [CS] §8.2) refusal: the documented 403 (ORIGIN_NOT_ALLOWED) is worded by the presenter with the address; the button returns to idle
  - first error: `SEQ number to be >=1`
- A9 re-verify (LB-2; [CS] §8.2) outage (LB-6): the presenter's sentence; no result chip, no page toast
  - first error: `SEQ number to be >=1`
- B-3 recover ([CS] §8.3) success: one POST for the open session; the button is busy until the settle; the recovery overlay follows the state
  - first error: `SEQ number to be >=1`
- B-3 recover ([CS] §8.3) refusal (AC-C-48): a 403 NOT_PERMITTED shows the denied toast naming the role (SESSION_START)
  - first error: `SEQ number to be >=1`
- B-3 recover ([CS] §8.3) a 409 keeps the page's own toast; an outage shows the presenter's sentence
  - first error: `AssertionError: expected [] to have a length of 1 but got +0`
- B-4 camera (LB-4; [CS] §8.3) success: the toggle shows Camera 2 at once while the feed waits for the store; both follow the settle
  - first error: `SEQ number to be >=1`
- B-4 camera (LB-4; [CS] §8.3) refusal: the documented 403 (ORIGIN_NOT_ALLOWED) is worded by the presenter and the toggle reverts; a 422 reverts with the page's log line only
  - first error: `SEQ number to be >=1`
- B-4 camera (LB-4; [CS] §8.3) outage (LB-6): the presenter's sentence and the toggle reverts
  - first error: `SEQ number to be >=1`
- the meters (I8; [LS] §4 slice `audio`) move with the socket's `meters` frames, send no request for them, and read NO SIGNAL when the link is lost
  - first error: `SEQ number to be >=1`

### `apps/core-web/src/test/live-session-new-precheck.test.tsx` — 1 red / re-run: 1 red (red again: yes)

- B-6 startRecording and C-4 (the session ID is read before the call) success: the toast names the ID read before the call, then /session; one request
  - first error: `AssertionError: expected [] to have a length of 1 but got +0`

### `apps/core-web/src/test/live-session-note-role.test.tsx` — 1 red / re-run: 1 red (red again: yes)

- the note drawer follows the signed-in role (Live mode) the SUPERVISOR of the Core session gets "Supervisor note"
  - first error: `SEQ number to be >=1`

### `apps/core-web/src/test/live-strict-mode-starts.test.tsx` — 1 red / re-run: 1 red (red again: yes)

- the static guard: a file under `features/` starts a Core call from an effect only by returning `deferEffectStart` every production file of `features/` holds the rule (the allowed list names each excep
  - first error: `AssertionError: expected [ Array(1) ] to deeply equal []`


Extra detail for the three reds that are not `SEQ`:
- `live-session-monitor-panels.test.tsx` "a 409 keeps the page's own toast; an outage shows the presenter's sentence": `AssertionError: expected [] to have a length of 1 but got +0` (followed by the DOM dump).
- `live-session-new-precheck.test.tsx` "B-6 startRecording and C-4 ... success": `AssertionError: expected [] to have a length of 1 but got +0` at the line `await waitFor(() => expect(toastsWith(startedToast(id))).toHaveLength(1))` (file line 231).
- `live-strict-mode-starts.test.tsx` "every production file of `features/` holds the rule": `AssertionError: expected [ Array(1) ] to deeply equal []`, received `"evidence/transcript.ts:165 invalidateQueries( — outside the helper"` (assertion at test file line 388).

No red in any other command.

## Debts (expected fail / todo / skipped)

- `it.fails` / `test.fails` / `it.todo` / `xit`: none in the tree (grep over apps/ and packages/, node_modules excluded). Three comments record cases that were `it.fails` and are plain checks now (`capture/fence/__tests__/development-session.db.test.ts:342,358`, `modules/devices/__tests__/source-class.db.test.ts:121`, `development-session-e2e.db.test.ts:263`).
- Skipped tests reported by the runs:
  - core-server db: `src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts` 3 skipped (env gate `DEMS_DEV_SESSION_E2E`; the ATTENDED block also behind `DEMS_USER_ATTENDED`); `src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts` 2 skipped (gate `DEMS_SEAL_E2E`); `src/sealing/__tests__/kill-matrix/kill-matrix.db.test.ts` file skipped as a whole (0 tests collected; gate on `ASKED`). These are the runs left out on purpose.
  - transcriber: `capture-priority.test.ts` 1, `cpu-priority.test.ts` 1, `kill-resume.test.ts` 1 skipped. These are the host-conditional blocks (`it.runIf` / `it.skipIf` on `HOST_LOWERS_PRIORITY` / `HOST_READS_PROCESS_TABLE`); the "host forbids it" variants are skipped because this run was outside the sandbox.
  - core-server unit / shared / protocol / web / mobile / mock-core: 0 skipped.
- Conditional (`skipIf` / `runIf`) blocks that ran or not depending on the host, none reported skipped in unit/db: `test/acceptance/demo-seed-v2.test.ts:214`, `capture/adapters/local/__tests__/mic-helper.generated.test.ts:129`, `no-delivery.test.ts:275`, `fence/__tests__/fence.test.ts:296,327,334`, `fence.db.test.ts:280`, `transcription/__tests__/probe.test.ts:203`, `session-run.test.ts:180`, `sealing-host/__tests__/demo-seed.generated.test.ts:36` (all counted as passed or not skipped in the runs above).

## Notes
- Noise: every vitest log starts with `ERROR: failed to copy trust settings of system certificate-...` lines (macOS keychain, exit code unaffected).
- The core-server db run ended with `forced drops that needed a retry: 0` and `0 remain with the run prefix`; PostgreSQL at 127.0.0.1:4432 was up.
- Raw logs and JSON reports of this run are in the session scratchpad only (not in the repo).
