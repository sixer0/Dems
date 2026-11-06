# Integration pass E4 — the 39 red core-web tests of the checkpoint run

Date: 2026-10-10. Agent: coder-execution. Evidence: `test/05_checkpoint_wave_de_suites.md`. No commit, no migration, `packages/shared` and `apps/mobile` not touched.

## Per group

| # | Reds | Wrong side | Change |
|---|------|-----------|--------|
| 1 | 32 (`SEQ`) + the 409 case of group 2 | TEST harness | `apps/core-web/src/runtime/testing/live-harness.ts:404` — the ONE default answer of `listAudioSourceIntervals` now sends `seq: 1` (contract `AudioSourceIntervalEntrySchema`, `packages/shared/src/api/sessions.ts:176`, `count().min(1)`). No test patched. |
| 2 | 1 (`live-session-monitor-panels` "a 409 keeps the page's own toast") | neither product nor this test | A consequence of group 1: green with the harness fix alone, test and product unchanged. The case scripts `recoverSession` 409 `invalidState` from FAULT (not a stop while connecting), a state that still occurs; the page's `session.recovery.failed` toast is still shown. |
| 3 | 1 (`live-session-new-precheck` B-6 start success) | TEST | Product is right by ux §8e.2 / line 935 (D84, erratum PE-128-79): nothing says "Recording started" before the first durable fragment (`features/session-new/index.tsx:360-363`). The test's Core driver is the simulator, which since pass D10 answers a start with `captureDurable: false`; the test still expected the durable toast. The case is now two: (a) a Core past the connecting part when it answers (driver run until `captureDurable !== false`) -> "Recording started" with the ID, no connecting toast; (b) a Core still connecting (`captureDurable: false` asserted on the scripted state) -> "Connecting cameras…" carrying the ID read before the call, no "Recording started"; both navigate to `/session`, one request. |
| 4 | 1 (`live-strict-mode-starts` static guard) | PRODUCT | `features/evidence/transcript.ts` `useTranscriptFollowsRevision`: the two `invalidateQueries` calls now start through `deferEffectStart`, returned by the effect; no exemption added. The seen value moves inside the start, so a start cancelled by a dependency change within the task leaves the move still to be answered. Its test (`features/evidence/__tests__/transcript-follows-revision.test.tsx`) reads every expectation, controls included, one task later. |

## Other `seq` 0 assumptions (searched `apps/core-web/src`)

None for audio-source intervals: the product matches intervals by equality (`audio-source-band.tsx:60`, `sealed-playback.ts:126`), sorts by `seq` and uses it as a React key / label (`verify-v2-report.tsx:126-127`); no index arithmetic, no "first = 0" lookup. Test fixtures of intervals elsewhere already count from 1. Not an interval and left alone: `AudioFrame.seq: 0` (meter frames), and `features/evidence/media-session.ts:109`, which admits `seq >= 0` for the FRAGMENT place of a 409 `FRAGMENT_NOT_AUTHENTIC` while `verify-v2.ts:236` treats a fragment `seq < 1` as unreadable — a possible inconsistency for the controller, outside this pass.

## Runs (each once; the failed files once more after their fix)

| Command | Result |
|---|---|
| the 7 red files + `transcript-follows-revision` after groups 1 and 4 | 6 files green; red: precheck start (group 3, expected) and the hook's own test, 2 cases (synchronous read of a start that is now one task later) |
| `live-session-new-precheck`, `transcript-follows-revision`, `transcript.test` after the fix | 3 files / 30 passed |
| `npm run test -w @dems/core-web -- --maxWorkers=4` | 148 files passed / 1839 passed / 0 failed (1799 + 39 + 1 new case), 82 s |
| `npm run typecheck -w @dems/core-web` | exit 0, clean |
| `npm run lint -w @dems/core-web` | clean |

`@dems/shared` and mobile jest not run: nothing under `packages/shared` changed (the scripted answer lives in core-web's harness; mobile has its own).

## Not proven here

Browser check of the transcript pane following another operator's revision (one task later than before; no visible difference expected) — for the gate's device/browser session.
