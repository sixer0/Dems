---
task_id: 2026-10-12_input_av_core_adapter_plan
row: N9 (wave 12, track D)
agent: N9 (coder-execution)
date: 2026-10-14
status: needs-review
design: masterplan/06_design_macos_microphone.md revision 3, sections 4.6, 4.7, 6, 7.1, 8.1, 8.3, 9.2, 10.1 row N9
decisions_read: U23, U25, C104, C107, C110, C112, C118, C119, C123; ruling on N8's D1 (file_ownership.md)
requirements: SM-04, SM-14, SM-16 (gates); SM-06, SM-18, SM-19, SM-21, SM-34 (4) (6), SM-35, SM-39
devices_opened: none (stand-in programs only; decision C112)
---

# Row N9 - the macOS production microphone adapter, kind `USB_AUDIO`

## 1. What was built (new files only, plus the adapters' static list)

| File | What |
|---|---|
| `apps/core-server/src/capture/adapters/audio/usb-audio-macos.ts` | THE ADAPTER. Header: "the bench form of this Mac: not the hardened Linux form; the audio of this path is not sample-continuous" (design 8.1). Group of handles per (session, device); one launch; the second listing gives `none:<n>`; push template of row N4; guard through the production door, empty environment; the reader of rows N8/N8b live through `onDiagnostics`; the gate; settle 1,500 ms; the third listing; pause 1,000 ms PER DEVICE; ONE retry; pre-check with its count; queue-line notices; the three source facts and the capture group; `admitDevice` by the Linux shape. Registered nowhere (row N10). |
| `apps/core-server/src/capture/adapters/audio/macos-launch-gate.ts` | PURE: `judgeHelperStart(state, {channelCount, outputs})` -> WAIT / PASS / named refusal; `createSampleCounter` (f32le across chunks, in memory, bound 384,000 bytes). |
| `.../audio/__tests__/macos-launch-gate.test.ts` | 11 tests on the recorded starts of row N8b. |
| `.../audio/__tests__/usb-audio-macos.test.ts` | 26 tests: 20 on a played guard with manual timers, 6 on REAL processes (stand-in guard with the built guard's escalation, stand-in helper that checks the template word for word, prints the recorded start lines, writes f32 into its pipes and exits 224 when a pipe's last reader is gone). |
| `.../adapters/__tests__/static.test.ts` (Edit) | A-9: `audio/usb-audio-macos` named by no production source; `audio/macos-launch-gate` by the adapter only; `audio/usb-audio-production` may be named by the macOS adapter (design 4.4). A-11: the adapter's `admitDevice` (row 85d's door). NEW A-12: the bench-form marking (the words `AVFOUNDATION` / `NOT_CONTINUOUS` made in this file alone, the head statement, the gapped kind and never `PCM_FIFO`, no development file imported - SM-21), with its control. |

## 2. The group (design 6.1, decision C118)

| Event | Behaviour |
|---|---|
| start | The FIRST `start` of a group launches ONE helper with one section per handle open at that instant, ascending by input; the device word from the listing read for THIS launch. |
| join | Every later `start` of the group awaits that launch and settles with it; a handle opened after the launch is refused `AUDIO_INPUT_ALREADY_OPEN` / `DEVICE_HELPER_RUNNING` with "Both microphones of one device are started together. This microphone joins at the next start of the session's microphones." (SM-34 (6)). |
| close of one | The adapter holds its own reader on every pipe from BEFORE the helper starts (`MacosPipeKeeper.hold`); a closed handle's pipe is DRAINED (not closed, not removed) until the group ends; its input is free. The helper is not stopped. |
| end | Last close: stop through the guard's input, then the readers are let go, then the pipes are removed, then the device's pause starts. The helper's own end tells EVERY live handle once, `AUDIO_HELPER_EXITED` (EXIT_n); `groupOf(id).helperEnded` lets row N11 refuse the switch with "The capture program of this device has ended. Both of its channels are gone; the second channel cannot bring the audio back." (SM-34 (4)). |

## 3. The gate's refusals (design 4.6; SM-04 (2), SM-16)

| Case | Code / detail | Sentence |
|---|---|---|
| system list states a rate other than 48,000 (at the open) | `AUDIO_CARD_RATE_UNSUPPORTED` / `SYSTEM_STATES_OTHER_RATE` | "the microphone device does not run at 48,000 Hz: set its rate to 48,000 Hz in Audio MIDI Setup and start again (on this Mac the setting can be lost when the Mac restarts)" (C118) |
| the helper's INPUT line states another rate | `AUDIO_CARD_RATE_UNSUPPORTED` / `HELPER_STATES_OTHER_RATE` | the same |
| layout word count differs from the listing's | `AUDIO_CARD_MOVED` / `CHANNELS_DIFFER` | the Linux sentence |
| count without a word, word outside the table | `AUDIO_CARD_MOVED` / `LAYOUT_WORD_UNKNOWN` | the Linux sentence |
| another codec/format, a withdrawn or malformed line, a header of another index, an output not mono 48,000, more mapping lines than outputs | `AUDIO_HELPER_ENDED_AT_START` / `STREAM_NOT_AS_EXPECTED`, `INPUT_OF_ANOTHER_INDEX`, `OUTPUT_NOT_AS_EXPECTED`, `NO_STREAM_LINE` | the Linux sentence |
| no verdict within 3,000 ms; lines dropped by the door before the verdict | `AUDIO_HELPER_ENDED_AT_START` / `NO_STREAM_LINE`, `LINES_DROPPED` | - |
| refused twice (251 + the line + no stream) | `AUDIO_HELPER_ENDED_AT_START` / `FORMAT_NOT_SUPPORTED` | - |
| pre-check: every sample exactly zero; no sample | `AUDIO_HELPER_ENDED_AT_START` / `INPUT_SILENT`, `NO_SAMPLE` (wire `OPEN_FAILED`) | silent PRIMARY blocks, silent STANDBY warns: the existing start table (U25 (1)) |
| third listing not the second (order mark, identity, tie, rate, count, index) | `AUDIO_CARD_MOVED` / `LIST_CHANGED` | - |
| a connected device that cannot be tied | `AUDIO_CARD_AMBIGUOUS` / the undecided reason (`NAME_SHARED`, `NO_SYSTEM_INPUT`, `NO_CAPTURE_ENTRY`, `LISTS_DISAGREE`, ...) - read from `listTied().undecided`, never `CARD_ABSENT` (row N6's request) | the Linux sentence |

Layout admission (ruling on N8's D1): a word of the reader's table, MEASURED or BUILD_TABLE, is admitted only when its channel count equals the listing's.

## 4. Stopping, and the SIGKILL bound (C118 (2))

The adapter ends the guard's input; the guard sends SIGTERM and SIGKILL 2,000 ms later (`GUARD_TERM_BOUND_MS`). The adapter signals the GUARD itself only past that: SIGTERM at 3,000 ms, SIGKILL at 5,000 ms (a guard killed first would orphan its child on macOS). A start that fails returns only after the guard has ended, and the guard ends only after reaping its child. Measured on the stand-ins: a helper that ignores SIGTERM, failed start, no worker reader - start rejected after >= 1,900 ms and < 5,000 ms, helper pid dead at that moment, no `AUDIO_HELPER_SIGNALLED` (the guard did it).

The retry with the pause, timed on stand-ins (real timers): one refused open, pause, fresh listing, second launch, settle, third listing - between 2,400 and 8,000 ms (asserted), against the session's 8,000 ms (SM-39 (6)).

## 5. Mutations - each rule seen RED (Edit on my own files, reverted; residue grep empty)

| # | Mutant | RED tests |
|---|---|---|
| G-1 | rate rule removed (gate) | 4 (gate RULE 1, adapter gate, pre-check gated, process rate gate) |
| G-2 | layout count not compared | 1 (RULE 2) |
| G-3 | COUNT_ONLY admitted | 1 (RULE 2) |
| G-4 | PASS on one output | 2 |
| G-5 | no wait for the end of the input's block | 0 - EQUIVALENT, measured (no output can be stated inside the input's block); stated in the test |
| C-1 | `value !== 0` dropped from the count | 4 (two count tests, pre-check scripted and process) |
| M-1 | undecided list not read | 1 (CARD_ABSENT instead of AMBIGUOUS) |
| M-2 | every start launches | 2 (played and process) |
| M-3 | the open's index kept | 2 |
| M-4 | no pause recorded | 3 |
| M-6 | two retries | 2 |
| M-7 | close releases instead of drains | 2 (process: the helper ends 224) |
| M-8 | silent pre-check passes | 2 |
| M-9 | `dropped` before the verdict ignored | 1 |
| M-10 | no reader held at the launch | 2 |
| M-11 | stop = SIGKILL of the guard | 2 (process: timeout, the helper orphaned; then no process left after the run) |
| M-12 | rate at the open removed | 1 |
| M-13 | third listing not compared | 1 |
| M-14 | only one handle told of the helper's end | 1 |
| M-15 | queue fault removed | 1 |

M-8/M-9 and M-13/M-14 and M-12/M-15 were applied in pairs whose target tests are disjoint (each RED test belongs to one mutant only).

## 6. Checks (result lines)

| Check | Command | Result |
|---|---|---|
| New tests | `npx vitest run .../usb-audio-macos.test.ts .../macos-launch-gate.test.ts --maxWorkers=2` | `Test Files 2 passed (2)`, `Tests 37 passed (37)` (10.35 s) |
| Audio suite | `npx vitest run src/capture/adapters/audio --maxWorkers=2` | `Test Files 2 failed / 8 passed (10)`, `Tests 3 failed / 321 passed (324)` - 1 by design of this row (`usb-audio-production.test.ts:1077`, request s7), 2 NOT N9's (`macos-card-listing.test.ts`, plist bound / undecided cases: agent N5b in flight, C131) |
| Static set | `npx vitest run src/capture/adapters/__tests__/static.test.ts src/capture/__tests__/static.test.ts test/static --maxWorkers=2` | `Test Files 2 failed / 17 passed (19)`, `Tests 5 failed / 318 passed (323)` - A-9, A-11, A-12 GREEN; 1 by design (`capture/__tests__/static.test.ts:1777` SR-15 (1) caller pin, request s7); 4 NOT N9's: G-R8 door and A-8 (`production-door.ts` modified 10:53 by N5b in flight), row 111b and row N7 (`production-parts.ts` modified 10:54 by N7 in flight) |
| Typecheck | `npx tsc --noEmit` (apps/core-server) | rc 2, 11 errors, 0 in N9's files: `mic-transport.ts:88,91` and 7 telemetry fixtures (N13's protocol version 5 in the tree), 2 camera tests (`TestStoredAddressDecision`, another agent) - the same 11 as before N9's files existed |
| Leftovers | `ps` after the process runs and after M-11 | no stand-in process left |

## 7. Requests (delegation_progress/file_requests.md, six lines)

1. Capture static SR-15 (1)/(7): admit the adapter's two call sites and its one door call (blocking the static set).
2. `usb-audio-production.test.ts:1077`: admit the macOS adapter as the one production importer (blocking the audio suite).
3. The product's `MacosPipeKeeper` belongs in `local/pipe-files.ts` with its G-R2 pin widened; N10 hands it in (blocking registration).
4. N13/N11: replace `MACOS_MIC_PIPE_KIND` by `CaptureMicInputKind.PCM_FIFO_GAPPED` when N13 closes; `mic-transport.ts` needs the gapped statement (values of `MACOS_MIC_TRANSPORT`).
5. N11: what the adapter hands the session (source facts, `groupOf`, losses, notices) and the captureGroup driver decision.
6. N15 (answer to N8b's request): the adapter keeps no text; `launchReading(id)` is the reader's fold of the launch; the raw text for the fixture is captured by N15 outside the product.

## 8. Driver decisions (to confirm)

- D1 `captureGroup`: 1 for the session's FIRST group opened, 2 for the other device - equals "the PRIMARY's group is 1" only if the session opens the PRIMARY first (not verified; request 5).
- D2 the pre-check has the same pause and ONE retry as a launch, and a second pre-check of a device, or one beside a launched group, is refused `DEVICE_HELPER_RUNNING` (two helpers cannot hold one device, MF13); a launch waits for a running pre-check.
- D3 the rate is refused TWICE: at the open from the system list (`SYSTEM_STATES_OTHER_RATE`, before anything starts - MH-11's case after a restart) and at the launch from the helper's own line.
- D4 `dropped` lines before the verdict refuse (`LINES_DROPPED`): a dropped line may have been a second statement.
- D5 `FIFO queue full` without `flushed` in 10,000 ms: notice `CAPTURE_MIC_HELPER_QUEUE_NOT_FLUSHED` and every live handle told lost `AUDIO_NO_SAMPLE_WITHIN_BOUND` / `QUEUE_NOT_FLUSHED`; the helper is stopped by the session's close, not by the adapter.
- D6 the adapter's reader is held on EVERY pipe of a launch from before the helper starts (not only after a close): the race "the worker closes before the adapter opens" cannot occur, and a worker that ends never ends the helper by EPIPE.
- D7 `MacosUsbAudioError extends UsbAudioError` with the macOS sentences; every reader of the Linux refusals reads it.

## 9. What stays unproven (hardware package, row N15)

The gate on a real device start (N8b's request; check 9A/H), the pause and the retry against the device's real refusals, the queue lines on the device, a reader that closes on the pinned helper with the adapter's reader present, the permission's forms (section 5 of the design), an unplug (9.3 row 1), the BUILT guard's escalation on macOS (the stand-in has the same constants), the product's pipe keeper (request 3).

*Generated: 2026-10-14 11:05*
