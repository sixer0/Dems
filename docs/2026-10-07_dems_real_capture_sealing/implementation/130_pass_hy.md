---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: pass H-Y - the 3 reds of the wave-H checkpoint run + the seal e2e's missing facts
date: 2026-10-10
agent: coder-execution
tree: f293221 + the wave H edits in flight (no commit, no migration, no git write)
evidence_in: test/07_checkpoint_wave_h.md
narrative_tier: 3
status: complete
---

# 130 - Pass H-Y

No STT speed, throughput or run-duration figure of the engine is in this note (D230). The speech
server on 127.0.0.1:8000 was never called. No camera and no microphone of this Mac was opened; no
attended variable was set; `adapters/local/__tests__/e2e/` was not run. The speech fixture was
never played. The lanes stayed stopped. Each check ran once; a repeat followed a fail only (the
exception asked for: item 3, three runs under load).

## 1. Which side was wrong

| # | Red | Side that was wrong | Change |
|---|---|---|---|
| 1 | A6 speech session, `processesWith('/<sessionId>/')` = 1 after the stop | THE TEST (wrong instant). Candidate (b): the survivor is the speech ENGINE, not a capture process | The assertion is split in two instants (section 2). No product file changed |
| 1b | NEW reason behind it, first seen when the case ran on: item `transcript.state` `READY`, expected `ASSEMBLED` | THE TEST (wrong word) | The item is asked for the slice's word `READY`; the sealed document and verify still say `ASSEMBLED` (section 2) |
| 2 | `integration-d4.db.test.ts:99`, extra `sealedPackage: NOT_READABLE` | THE TEST. The rig writes no package: `NOT_READABLE` is the truth | Expectation gains the member, with a control that no folder is there (section 3) |
| 3 | `ws-discovery.test.ts:182`, `{ NOT_XML: 3, DECLARATION: 1 }` once | THE TEST'S STUB, not the parser and not the load | The stub's NOT_XML body was `randomBytes(512)`; it is a fixed body now, each input pinned to one reason (section 4) |
| 4 | Test gap: no manifest / extract fact quotable | - | The seal e2e writes `facts-<case>-<sessionId>.json` and asserts what wave H fixed (section 5) |
| 5 | FOUND BY ITEM 4: `RECORDING_STARTED.timeSource` was `GNSS` in case (a) of a real seal | THE PRODUCT (`packages/shared/src/sim/derive.ts`, `deriveTime`) | One line; red test first (section 6) |

## 2. Item 1 - the speech session

**Which process.** One diagnostic run with the test's new `commandLinesWith` (`pgrep -fl`, process
id removed, repository root shown as `.`; `development-session-e2e.db.test.ts:149`). The survivor:

```
./.cache/stt/whisper.cpp/build/bin/whisper-cli -m ./.cache/stt/models/ggml-large-v3-turbo.bin -ng -t 8 -l id -oj -of ./.data/test-row61-wavehspeech-77701-1/transcriber/work/stt-<uuid> -f ./.data/test-row61-wavehspeech-77701-1/media/sessions/.transcriber/sessions/SES-20261010-0024/work/chunk-1.wav
```

Not candidate (a): no `ffmpeg ... dialogue.wav` and no pipe path was alive - the looping fixture
helper is closed by the same `close()` as the tone helper (`mic-helper.ts`, SIGTERM, then SIGKILL
after the grace). It is candidate (b): the engine decoding a chunk of this session's scratch.

**The spec.** `masterplan/07_transcript_spec.md` "Sealing interaction" (line 168) and "Order" (line
323): sealing waits until the transcript is assembled and hashed (D223); the scratch is removed at
the SEALED outcome (`sealing-host/index.ts:396`, R80-04). The engine legitimately outlives the
capture stop. The product is right.

**The test now** (`development-session-e2e.db.test.ts`):
- after the stop (:328-339): every process that names the session and is NOT the engine on this
  session's scratch must be gone; separately the two RTSP pushers, the microphone pipes and any
  process on the run's copy of the fixture are each counted to none. In the GENERATED run nothing
  is exempt (the engine exemption holds in mode SPEECH only);
- after the seal's outcome (`SEALING_COMPLETE` logged, :349-351): NO process names the session, and
  the session's transcriber scratch folder does not exist.

**The second reason.** The case then failed at the item's `transcript.state`: `READY` received,
`ASSEMBLED` expected. The item's summary uses the slice's word by the one map `SLICE_STATE`
(`sealing/finalize-transcript/commit.ts:66`: manifest `ASSEMBLED` -> `READY`). The line had never
run. It now asks `READY` of the item; `document.header.state: ASSEMBLED` and verify
`sealedState: ASSEMBLED` are asserted as before. Nothing was removed from the case.

**The run to its end** (third run; the first two were the diagnostic and the red above). Result
file `.data/test-row61-wavehspeech-78022-1/row140-result.json`:

| Fact | Value |
|---|---|
| Verdict | passed (1 passed, 3 skipped by their gates) |
| Transcript state | item `READY`; sealed document `ASSEMBLED`; verify `READY` / `sealedState ASSEMBLED`, `documentSealed true`, `failedChunks 0`, `backendUnreachable false` |
| Chunks | 2, failed 0 |
| Segments | 7 |
| Every chunk names an audio source | yes: chunk 0 `MIC-01`, chunk 1 `MIC-01`; the document's intervals name `MIC-01` only |
| `intervals_incomplete` | absent. QA flags: `["speaker labels unavailable"]` |
| Model provenance | id / name `ggml-large-v3-turbo`, version `large-v3-turbo`, quantisation `f16`, sha256 present (64 hex) |
| Words | 56 heard; 0 heard words that the reference text does not hold. 14 words of the 78-word reference were not heard: the recording is 30 s of a 45 s fixture, so the last turns were never played into it |
| Engine process alive at the stop | 1 (the decode above) |
| Processes of the session after the seal | 0 |
| Transcriber scratch of the session | gone |
| Fragments | VIDEO-01 12, VIDEO-02 11, numbered without a gap; verify `PASS` |

Not checked for (a) beyond this run: abort / failed start / Core shutdown of a FIXTURE handle -
the brief asked for it only if (a) were the defect, and it is not.

## 3. Item 2 - `sealedPackage: NOT_READABLE`

The test seals through the engine's door (`sealDoorsOf(...).completeSeal`) with a made-up manifest
digest (`'ab' x 32`) and writes no file: there is no package folder for the session in this rig.
The start's boot step `evidence.sealedFacts` reads the store, finds none and says so on the
replicated item. That is the product's stated rule (`src/evidence-facts/index.ts:37`: never a
refusal, never a guess). `src/evidence-facts` was not touched.

Test (`integration-d4.db.test.ts:101-106`): CONTROL `existsSync(sessionPackageDir(...)) === false`;
the item before the restart has no such member; the rehydrated item equals the sealed one plus
`sealedPackage: 'NOT_READABLE'`. Behind line 99 a second comparison was red for the same reason
(stored rows against the engine's slice): no column holds the member, so "what is stored is what is
committed" compares less that one member, and asserts that exactly this item carries it.

What a client shows for such an item: no playable media, with the reason as a code
(`PACKAGE_MISSING`), and no sealed fact (the contract's example in
`packages/shared/src/api/evidence.ts:1032`). Fine.

## 4. Item 3 - NOT_XML counted as DECLARATION

The four datagrams of mode `NOT_XML` were four DIFFERENT random bodies
(`test/support/fake-onvif-stub.ts`, `randomBytes(512)`). The reader (`probe-answer.ts:253-270`)
is deterministic and ordered: byte length, then a `<!` declaration in the BYTES
(`hasDeclaration`, :129), then depth, then the parser. A random 512-byte body holds the two bytes
`<!` about once in 130, so about one whole run in 30 had one body that is - rightly, by rule - a
DECLARATION. Not the load, not the socket, not the parser: the same bytes always get the same
reason.

Change: `FAKE_ONVIF_NOT_XML_BODY` (stub :106-110), 512 fixed bytes with no `<!`, sent by the mode
(:405). Pins: `fake-onvif-stub.test.ts:451` (every answer is that body; no `<!` in it);
`probe-answer.test.ts:112` (that body -> `NOT_XML`; the same bytes with `<!` written in ->
`DECLARATION`; CONTROL with `<!--` -> `NOT_XML`; four reads, four times the same reason).
`ws-discovery.test.ts` is unchanged and its `{ NOT_XML: 4 }` is now determined.

Under load, three runs: `npx vitest run --root apps/core-server --project unit --maxWorkers=4`
on `ws-discovery.test.ts` + `discovery-collector.test.ts` + `onvif-session.test.ts` ->
3 files, 74 passed; 3 files, 74 passed; 3 files, 74 passed.

## 5. Item 4 - what a product-sealed manifest and extract say

`seal-e2e.db.test.ts:188-233`: per sealed case a file `facts-<a|b>-<sessionId>.json` in
`DEMS_SEAL_E2E_OUT`, read from the package before the fixture is removed (codes, identifiers,
counts, instants; no media, no key material, no hash, no audit text). Asserted in the test: no
`FRAME_HASH` / `WRITE_VERIFIED` / `TIMESTAMP_CONFIRMED` row; manifest time source equals
`CORE_TIME_SOURCE` (`RTC` / `HOST_SYSTEM_CLOCK` / `[]`); `RECORDING_STARTED.timeSource` is `RTC`,
not `GNSS`; `softwareVersion` equals `CORE_SERVER_VERSION`; serial / hardware UUID
`NOT_CONFIGURED`; fields 20 / 21 equal the rig's configured installation identity; two tracks; the
verifier says the development mark of the certificate.

First run: RED in case (a) - `expected [ 'GNSS' ] to deeply equal [ 'RTC' ]` (section 6). Its two
facts files are kept in `.cache/waveH/seal-e2e2/first-run-red/`. After the fix, one run:
`Test Files 1 passed (1)`, `Tests 3 passed (3)`.

Case (a), `.cache/waveH/seal-e2e2/facts-a-SES-20261010-0024.json`:

```json
{"case": "a", "sessionId": "SES-20261010-0024", "evidenceId": "EV-20261010-0014", "manifest": {"timeSource": {"source": "RTC", "state": "HOST_SYSTEM_CLOCK", "fallbackOrder": []}, "device": {"deviceId": "DEMS-TEST-01", "name": "Unit test installation", "serialNumber": "NOT_CONFIGURED", "hardwareUuid": "NOT_CONFIGURED", "softwareVersion": "0.2.0"}, "tracksLength": 2, "tracks": [{"trackId": "VIDEO-01", "deviceId": "CAM-01", "sourceClass": "FAKE", "codec": "H264", "clockOffsetMs": 0}, {"trackId": "VIDEO-02", "deviceId": "CAM-02", "sourceClass": "FAKE", "codec": "H264", "clockOffsetMs": 0}], "timeline": {"interrupted": false, "stoppedAt": 1791632740262}, "transcript": {"state": "DISABLED"}, "signature": {"keyId": "CORE-KEY-EVSIGN-01", "algorithm": "Ed25519", "simulated": false}, "developmentSources": true}, "certificate": {"developmentMark": true}, "auditExtract": {"rows": 4, "rowsPerType": {"PRECHECK_PASSED": 1, "RECORDING_STARTED": 1, "RECORDING_STOPPED": 1, "SESSION_CREATED": 1}, "recordingStartedTimeSource": ["RTC"]}}
```

Case (b), `.cache/waveH/seal-e2e2/facts-b-SES-20261010-0024.json`:

```json
{"case": "b", "sessionId": "SES-20261010-0024", "evidenceId": "EV-20261010-0014", "manifest": {"timeSource": {"source": "RTC", "state": "HOST_SYSTEM_CLOCK", "fallbackOrder": []}, "device": {"deviceId": "DEMS-TEST-01", "name": "Unit test installation", "serialNumber": "NOT_CONFIGURED", "hardwareUuid": "NOT_CONFIGURED", "softwareVersion": "0.2.0"}, "tracksLength": 2, "tracks": [{"trackId": "VIDEO-01", "deviceId": "CAM-01", "sourceClass": "FAKE", "codec": "H264", "clockOffsetMs": 0}, {"trackId": "VIDEO-02", "deviceId": "CAM-02", "sourceClass": "FAKE", "codec": "H264", "clockOffsetMs": 0}], "timeline": {"interrupted": true, "stoppedAt": null}, "transcript": {"state": "DISABLED"}, "signature": {"keyId": "CORE-KEY-EVSIGN-01", "algorithm": "Ed25519", "simulated": false}, "developmentSources": true}, "certificate": {"developmentMark": true}, "auditExtract": {"rows": 5, "rowsPerType": {"FAULT_RAISED": 1, "PRECHECK_PASSED": 1, "RECORDING_STARTED": 1, "RECOVERY_STARTED": 1, "SESSION_CREATED": 1}, "recordingStartedTimeSource": ["RTC"]}}
```

Read plainly: `clockOffsetMs` is 0 on both tracks (generated sources; whether it is a measured 0 or
the stand-in 0 of `session-reader.ts` is not told by the manifest). The key id is the product key
label `CORE-KEY-EVSIGN-01` although the key is the development key: the development fact is the
certificate's mark, not the label. `certificate.developmentMark` is the verifier's statement
(operation 41, `signature.developmentKey`), not a parse of the PEM by the test.

## 6. The product defect item 4 found - GNSS came back between health ticks

Wave H Z1 set the `time` slice of a Core in its own capture to the host clock in the first state
and at every health tick. But `deriveDeviceState` - run by every session change
(`session-machine.ts:166` `withSession`), fault change and link carry - called `deriveTime`, which
with no `GNSS_LOSS` fault wrote `source GNSS, locked true` without asking whose clock it is. So for
up to one second after any session change the slice said GNSS, and a recording started inside that
second sealed `RECORDING_STARTED.timeSource: GNSS` (also `session.startTimeSource` and the START
node) into the audit chain. Case (a) hit it, case (b) did not: a race against the 1 Hz tick. The
manifest's own time source was never affected (it is a constant of the reader). The Z1 tests ticked
between every action and could not see it.

Fix: `packages/shared/src/sim/derive.ts:142-145` - a slice with `hostClock: true` is returned as it
is. Red first: `packages/shared/test/sim-pass-hy-host-clock-derive.test.ts`, 3 of 4 failed before
the line (the fourth is the CONTROL: simulated capture keeps GNSS and still falls back on a
`GNSS_LOSS` fault), 4 of 4 pass after. Effect on clients: none intended - a simulated capture has
no `hostClock` member.

Not repaired: recordings sealed BEFORE this line may hold `timeSource: GNSS` on their start row
(sealed audit extracts are not rewritten).

## 7. Commands and results

| What | Command (repo root) | Result |
|---|---|---|
| Speech session, diagnostic | `DEMS_DEV_SPEECH_SESSION_E2E=1 lockf heavy-host lockf db-migrate npx vitest run --root apps/core-server --project db --maxWorkers=1 src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts` | red at the stop assertion, survivor named (section 2) |
| Speech session, after the split | same | red: item state `READY` vs `ASSEMBLED` (new reason) |
| Speech session, to its end | same | 1 passed, 3 skipped |
| Seal e2e | the brief's command, `DEMS_SEAL_E2E_OUT=.cache/waveH/seal-e2e2` | first: 1 failed (a) / 2 passed; after the fix: 3 passed |
| d4 | `lockf db-migrate npx vitest run --root apps/core-server --project db --maxWorkers=1 test/db/integration-d4.db.test.ts` | first: 2 failed at the second comparison; then 5 passed |
| Classifier pins | `npx vitest run --root apps/core-server --project unit src/capture/adapters/camera/__tests__/probe-answer.test.ts test/support/fake-onvif-stub.test.ts` | 2 files, 58 passed |
| ws-discovery under load | section 4 | 74 passed, three times |
| Shared | `npx vitest run --root packages/shared test/sim-pass-hy-host-clock-derive.test.ts test/sim-wave-h-z1-time.test.ts`; `npm run -s test -w @dems/shared` | 12 passed; 113 files, 2546 passed |
| Static guards | `npx vitest run --root apps/core-server --project unit test/static src/engine/__tests__/static.test.ts src/capture/__tests__/static.test.ts` | 17 files, 228 passed |
| Typecheck / lint | `npm run -s typecheck|lint -w @dems/shared`, `-w @dems/core-server` | clean, clean, clean, clean |
| Leftovers | `pgrep -fl 'capture-worker|ffmpeg|whisper'` | none |

The speech session's passing run was made BEFORE the `deriveTime` line; it was not repeated (one
run; nothing it asserts reads the time slice).

## 8. Checks for the test runner

| Command | Lock | Expect |
|---|---|---|
| `npx vitest run --root apps/core-server --project unit --maxWorkers=4` | - | no red in `ws-discovery.test.ts`; watch any unit test that pinned a GNSS value on an `external` capture engine without a tick |
| `/usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=2` | db-migrate | `integration-d4.db.test.ts` green; watch real-capture rigs that read `time` or `RECORDING_STARTED.details` (`journey.db.test.ts`, `session-capture.db.test.ts`, `development-session.db.test.ts`) |
| `npm run test -w @dems/core-web -- --maxWorkers=4`; `npx -w apps/mobile jest --maxWorkers=2` | - | unchanged (the shared line touches host-clock slices only) |
| `DEMS_DEV_SESSION_E2E=1 ... development-session-e2e.db.test.ts` (generated run) | heavy-host + db-migrate | green: its stop assertion is the strict one (no exemption outside SPEECH) and it now also waits for `SEALING_COMPLETE` |

## 9. Decisions for the controller

1. Item 5 is a product line in `packages/shared` outside the four items of the brief; taken
   because item 4's required assertion was red on it and the cause was one function.
2. Already sealed development packages may carry `GNSS` on the start row (section 6): a ruling if
   any of them is shown at the gate; re-seal is not possible, a fresh session is.
3. The 30 s speech recording hears 56 of the fixture's 78 words by construction. If the gate wants
   "words equal to the reference", the mode's `seconds` must cover the 45 s fixture - not changed
   here (it lengthens a heavy run).
4. `signature.keyId` reads `CORE-KEY-EVSIGN-01` for the development key (section 5): a label
   question for review row 88 / gate 64, not changed.

## 10. Files

Product: `packages/shared/src/sim/derive.ts`.
Tests: `packages/shared/test/sim-pass-hy-host-clock-derive.test.ts` (new);
`apps/core-server/src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts`;
`apps/core-server/src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts`;
`apps/core-server/test/db/integration-d4.db.test.ts`;
`apps/core-server/test/support/fake-onvif-stub.ts`, `fake-onvif-stub.test.ts`;
`apps/core-server/src/capture/adapters/camera/__tests__/probe-answer.test.ts`.
Docs: this note; `delegation_progress/coder_execution_pass_hy.md`; three lines in
`delegation_progress/file_claims.md`.
Left in place, git-ignored: `.cache/waveH/seal-e2e2/` (facts + verify files, and `first-run-red/`),
`.data/test-row61-wavehspeech-{77701,77833,78022}-1/` (the e2e deletes nothing under `.data/`).
