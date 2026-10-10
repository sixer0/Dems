---
task_id: 2026-10-07_dems_real_capture_sealing
row: 71c (controller-added, decision D153; follow-up D156)
date: 2026-10-09
agent: coder-execution
baseline: e296ce7 + the uncommitted wave D tree
status: needs-review
tier: 3
---

# Row 71c — real-session wiring: STT snapshot, transcriber session, capture facts, fault keys

Paths below `apps/core-server/`. No commit, no migration (schema `[5, 'dbc-6']`), no lockfile write, `.data/pg*.env` not read, no camera or microphone opened, the STT server on port 8000 not contacted (the database tests replace the session-start check; the unit tests use an in-process transport). Each check was run once after its last change; a repeat only after a fail (D122).

## 1. What was built

| # | What | Where |
|--|--|--|
| 1 | STT snapshot INSIDE the unit of the start, after the four source rows: `ports.snapshotIn(scope.unit, …)` -> `TranscriptionControl.snapshotSttConfigIn(db, sessionId)`; after the commit `sessionStartCommitted` (scratch directory + the one background check) | `src/capture-session/index.ts` `recordingStartedIn`, `afterStartCommitted`; `src/transcription/index.ts` (`take`, `started`) |
| 2 | Transcriber session of a recording: `runs.begin` when the worker acknowledged AND the plan carries a tap; `runs.end(recorded)` on stop / interrupted / failed start / session-left-RECORDING, and once more as a guard in `release` | `src/capture-session/index.ts` `begin`, `endTranscriber`; NEW `src/transcription/session-run.ts` |
| 3 | Production transcriber seam for the seal: `availability`, `assemble` (the real `assembleTranscript`), `closeOut` (refusing runner on the session's scratch directory, row 116's reference), `locate`; a run that is not in memory (restart) is opened again from snapshot + checkpoint | `src/transcription/session-run.ts`; `src/transcription/session.ts` (`assembly`, `closeOut` on the enabled session) |
| 4 | The seal's transcript step per session: DISABLED at once / the live seam within the spec's bound / the declared absence at once | NEW `src/sealing-host/transcript-step.ts`; `src/sealing-host/index.ts` (`createSealTranscriptStep`, `replace({ transcriptLimits, transcriptRuns })`) |
| 5 | Row 82b's placeholder removed (`NO_STT_SNAPSHOT`, `TRANSCRIBER_NOT_WIRED`); the reader takes the session's own row | `src/sealing-host/session-reader.ts`, `index.ts` |
| 6 | Capture facts kept while the capture runs: camera clock offsets (`CameraAdapter.ntpOffsetMs`), `FIRST_VIDEO_SAMPLE` pts / timescale / skipped / skippedSpanMs -> `<mediaStoreDir>/.capture-session/<sessionId>.json` (atomic replace), read by the seal's reader | NEW `src/capture-session/facts.ts`; `session-reader.ts` `captureFacts` |
| 7 | A session that leaves RECORDING by another door: worker stopped, sources closed, durable media handed over as `INTERRUPTED` (`cause: SESSION_LEFT_RECORDING`) | `src/capture-session/index.ts` `watchSession`, `sessionLeftRecording` |
| 8 | Failed start: `reason` + `evidenceFiles: 0` on the session's FAULT timeline item, on the `FAILED_START` event, and on the alert when this unit made it; `endCapture(…, { cause })` | `src/engine/capture-session.ts`, `host.ts` (two lines), `types.ts` |
| 9 | A seal that found nothing durable tells the session (first step FAILED, sentence naming `CAPTURE_NOT_DURABLE`) | `src/sealing-host/index.ts` `nothingDurable`, `SEAL_NOTHING_DURABLE_REASON` |
| 10 | Requests applied: op 81 in simulated capture answers 409 for a foreign input (pass D4); microphone handles with `start()` are started after the worker acknowledged (row 140) | `src/capture-session/index.ts` `switchSimulated`, `begin` |

## 2. What a session seals with (item 2)

| Session | Transcript block | Wait |
|--|--|--|
| snapshot `enabled: false` | `DISABLED` / `DISABLED_BY_CONFIGURATION` (now literally true) | none |
| enabled, transcript finished | `ASSEMBLED` with document | none |
| enabled, transcriber never answers | `PARTIAL` with the document of the committed chunks, after the step's bound (`FINALIZE_TRANSCRIPT_LIMITS`, setting `transcriptLimits`) and one close-out | the bound |
| enabled, nothing can be had (transcriber not buildable, model provenance unknown, nothing recorded) | `PARTIAL`, no document, `TRANSCRIPT_UNAVAILABLE_AT_SEAL`, real snapshot in field 123 | none (`NO_TRANSCRIPT_LIMITS`) |
| NO snapshot (recorded before this row, or configuration unreadable at the start) | same absence; field 123 = fixed values with `model: 'not-recorded'` | none |

## 3. Results

| Check | Command | Result |
|--|--|--|
| Session wiring on PostgreSQL + row 140's development session | `/usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db src/capture-session src/capture/fence/__tests__/development-session.db.test.ts` (sandbox off) | 23 passed, 1 expected fail (row 140's other `it.fails`). `session-capture.db.test.ts`: 19 (12 of row 71b + 7 new) |
| Transcriber session runs | `npx vitest run --root apps/core-server --project unit src/transcription/__tests__/session-run.test.ts` | 7 passed (first run 6 + 1 red: the close-out runner lacked the capture-worker statement; fixed, re-run green) |
| Transcript step composition | `… --project unit src/sealing-host/__tests__/transcript-step.test.ts` | 7 passed (first run 1 red: my expectation `by: CALLER`, the step answers `ATTEMPT_BOUND`; expectation corrected, re-run green) |
| Touched unit folders + static guards | `… --project unit src/transcription src/sealing-host src/engine/__tests__/capture-session.test.ts src/engine/__tests__/static.test.ts test/static src/capture/__tests__/static.test.ts src/credential-store/__tests__/static.test.ts src/capture-notices` (sandbox off: loopback fakes) | 340 passed, 1 failed: `capture/__tests__/static.test.ts` G-R14 names `src/capture/fence/index.ts` (row 140, in flight; not this row) |
| Sessions module + engine unit tests after the reverted D156 line | `… --project unit src/modules/sessions/__tests__/static.test.ts src/engine/__tests__` | 225 passed |
| Typecheck | `npx tsc --noEmit -p apps/core-server` | 0 errors in this row's files; errors in `modules/devices/__tests__/source-class.db.test.ts` and `sealing/__tests__/pipeline.test.ts` (rows 140 / 82c, in flight) |
| Lint | `npm run lint -w @dems/core-server` | exit 0, no line names a file of this row |

Controls: snapshot row gone with a unit that does not commit; STT off opens nothing; the bound control (same silent transcriber, bound not reached -> still WAITING); provenance port null -> UNAVAILABLE; capture facts of another start instant not used; a record while RECORDING stops nothing.

## 4. Not proven / not done

1. **No production session can seal ASSEMBLED.** Manifest fields 84 to 87 (model name, version, quantisation, SHA-256) have no source in the Core; the port `modelProvenance` defaults to null. ASSEMBLED is proven with a provenance a test hands in. Request filed.
2. No speaker embedding engine is composed (port `speakerEngine`, null): labels UNAVAILABLE.
3. The composition was not run against a real worker or a real engine: `seal-e2e.db.test.ts` is the runner's (not edited; it still switches STT off, and its transcript is now DISABLED from a real snapshot).
4. **D156 item 1 not landed**: no place in this row's area can hold the boot call (sessions rule M3 refuses a hook; capture-session -> capture-notices is a cycle). Tried, red, reverted; request filed.
5. **D156 item 2 partly**: the alert holds the keys only when the failed-start unit created it; a stored alert's `params` are immutable (`IMMUTABLE_CHANGED`, measured), and the FAULT_RAISED audit row never holds them (composed by the shared simulator). Request filed.
6. `tracks[].codec` and `tracks[].avOffsetMs` stay null: protocol 4 names no codec anywhere, and nothing measures an AV offset per session. `subject.authorization` keeps the fixed text: the spec's source is "session input" and operation 24's input has no such member.
7. `skipped` / `skippedSpanMs` / `heldMs` have no manifest field: kept in the facts file and the log, none invented.
8. Field 40 is 0 for a camera whose adapter reports no offset and for a session without facts (the field is not nullable).
9. Capture mode `simulated`: no snapshot is taken (the unit returns at once there); MR-T1 names no mode.
10. The pure transitions of `engine/capture-session.ts` have no unit test of their own (proven through the database test).

## 5. Decisions taken (for the controller)

| ID | Decision |
|--|--|
| D-71c-1 | A snapshot row that cannot be written in the unit refuses the start (503 `NOT_READY`, `STT_SNAPSHOT_NOT_STORED`): a failed statement has ended that transaction anyway (`SAVEPOINT` is refused by the unit). An unreadable or unseeded configuration lets the start go on without a snapshot (RK-1) |
| D-71c-2 | **The spec defines no state for "no configuration recorded"** (field 123 not null, four shapes). Sealed as `PARTIAL` / `TRANSCRIPT_UNAVAILABLE_AT_SEAL` with `configSnapshot.model: 'not-recorded'` (`enabled: true` is forced by the shape; `backend`, `diarization`, `revision` describe nothing). Needs a ruling: a fifth shape or a nullable field 123 |
| D-71c-3 | When no transcript can come the step is taken to its own bound at once (`NO_TRANSCRIPT_LIMITS` 2 / 1 / 1 ms, one attempt) instead of a new code path: row 79 / 119's journal form and resume rule stay as proven. It writes one `TRANSCRIPT_CLOSE_OUT_FAILED` error-log entry per such seal |
| D-71c-4 | A session without model provenance is still transcribed while it records (chunk rows are real), and seals without a document |
| D-71c-5 | Capture facts live in a file beside the media store, not in the package folder; a resumed seal would otherwise fail `MANIFEST_NOT_REPRODUCIBLE` after a restart. The file is not removed after the seal; it is tied to its session by the start instant of the source rows. An unreadable file stops the seal (reader rule) |
| D-71c-6 | Item 4 (a): demo operation 73 is already refused in real capture (403 `DEMO_DISABLED`, `capture-config/fencing.ts`; real + demo flag never boots as real). Added for every other door: the worker is stopped when the session is no longer RECORDING |
| D-71c-7 | `FAILED_START.reason` / `evidenceFiles` are optional in the type (always written) so that events another unit's test builds by hand stay valid |
| D-71c-8 | Close-out passes the session's engine guard, so an engine the hung runner left is stopped (N-2 rule) |

## 6. Device / browser flows for the gate

Development session with STT off -> verify shows "disabled by configuration"; with STT on (this host has no provenance) -> Finalizing does not wait, verify shows the transcript unavailable; no camera at start -> fault presentation, wording depends on item 4.5; fault injected while recording is refused in real capture.
