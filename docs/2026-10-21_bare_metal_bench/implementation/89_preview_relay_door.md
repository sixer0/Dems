---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
row: 89a (live camera preview, part (a): relay preview mode, door pipeline, relay-start preview)
date: 2026-10-23
agent: coder-execution
source_plan: docs/2026-10-21_bare_metal_bench/masterplan/02_plan.md (decisions D51, D53)
status: needs-review
---

# Implementation Report: preview relay mode + production-door pipeline + startCameraPreview

Status `needs-review` only because of the cross-row reds listed under Persistent Issues (A-9, A-10(c) need entries for agent (b)'s preview files) and the review recommendation. All of this row's own checks pass.

## The exported handle (for agent (b))

`apps/core-server/src/capture/adapters/camera/relay-start.ts`

```ts
export const CAMERA_PREVIEW_CODECS = Object.freeze(['H264', 'HEVC'] as const);
export type CameraPreviewCodec = 'H264' | 'HEVC';
export const PREVIEW_ENCODER_TAIL = ['-an','-vf','fps=8,scale=640:-2','-q:v','7','-f','mpjpeg','pipe:1'];
export function previewEncoderArguments(ffmpeg: string, codec: CameraPreviewCodec): readonly string[];
export const PREVIEW_STOP_BOUND_MS = 3_000;

export interface CameraPreviewStart {
  readonly pipelineDoor: ProductionPipelineDoor;   // startProductionPipeline from production-door.ts
  readonly program: string;                        // capture-relay, absolute
  readonly guard: string;                          // capture-guard, absolute (DEMS_CAPTURE_GUARD)
  readonly ffmpeg: string;                         // ffmpeg, absolute
  readonly timers: CaptureTimers;
  readonly locator: string;                        // from locate(), no user part
  readonly sealed: SealedCredential;
  readonly attempt: number;
  readonly source: string;                         // REQUIRED, storedCameraSourceOf(judged).sourceAddress
  readonly codec: CameraPreviewCodec;              // from the probe line's "codec"
}

export const CameraPreviewEndReason = { STOPPED, START_REFUSED, RELAY_ENDED, ENCODER_ENDED } as const;
export interface CameraPreviewExit {
  readonly code: number | null;      // the exit code of the child that ended first (the relay's code for STOPPED: 0 on a clean stop)
  readonly reason: CameraPreviewEndReason;
  readonly relay: ProductionExit;    // codes/signals; diagnostics are bounded heads for classification, never to be logged
  readonly encoder: ProductionExit;
}
export interface CameraPreview {
  readonly relayPid: number | null;
  readonly encoderPid: number | null;               // the guard (leader of the encoder's process group)
  readonly started: Promise<void>;                  // rejects with the door's ProductionDoorError
  onChunk(listener: (chunk: Buffer) => void): () => void;  // MJPEG bytes (mpjpeg parts "--ffmpeg\r\nContent-type: image/jpeg\r\nContent-length: N\r\n\r\n<JPEG>"), chunked as the pipe gave them; returns the removal
  stop(): Promise<void>;                            // relay stdin ended at once, SIGKILL of both after PREVIEW_STOP_BOUND_MS; resolves when both ended; idempotent
  readonly exited: Promise<CameraPreviewExit>;      // settles once, never rejects; listeners are cleared then
}
export function startCameraPreview(start: CameraPreviewStart): CameraPreview;
// throws CaptureAdapterError START_MESSAGE_INVALID (bad source / codec outside the set) or LOCATOR_INVALID before anything starts
```

Relay exit codes a RELAY_ENDED may carry: the relay's list in `relay.h` (20 unreachable, 22 not Digest, 23 refused, 24 not found, 27/28 description/codec, 30 keyframe timeout, 31 stalled, 32 lost, 33 stream invalid, 42 socket rule, 43 output not taken within 5 s). Preview mode has no re-open: a camera loss ends the relay and the caller starts again.

## Executed Steps
| Step | Task | Status | Notes |
|---|---|---|---|
| 1 | Read rules, sources, static tests; baseline `make relay-check relay-unit` | complete | baseline 989 unit checks passed |
| 2 | Claims appended to `delegation_progress/file_claims.md` (`row 89a`) | complete | 13 lines |
| 3 | Relay preview mode (C), relay-check rules + controls, unit + fuzz seeds | complete | |
| 4 | row041 fixture `preview` case | complete | test clips encoded off-host (see Decisions) |
| 5 | Door `startProductionPipeline` | complete | |
| 6 | `startCameraPreview` + handle | complete | |
| 7 | Static tests moved to the new rules; new unit tests | complete | |
| 8 | Typecheck, targeted tests, end-to-end smoke | complete | |

## Changes Made
| File | Change Type | Description |
|---|---|---|
| apps/capture-worker/src/relay/relay.h | modify | :92 header section "PREVIEW MODE"; :203 `RELAY_MODE_PREVIEW = 3`; mode comment |
| apps/capture-worker/src/relay/relay_core.c | modify | :254 word "preview"; :293 closed set of preview = probe's; :295 preview MUST state `source` (record line :294 unchanged byte-for-byte) |
| apps/capture-worker/src/relay/relay.c | modify | :101 `out_bytes` = the ONE writer of standard output (same 4 STDOUT lines, bounded 5 s, `gone` code on EPIPE/ECONNRESET); :120 `report` now calls it with REPORT_NOT_WRITTEN (same behaviour as before); :127 `media` (video, EPIPE = order to stop -> exit 0); :301 `preview_sets` (stream_facts validation + socket rule + parameter sets out); :516-519 gate branch for preview (+ stderr word `preview_streaming` once); :544 pictures to `media` in preview mode; record/probe paths unchanged |
| apps/capture-worker/relay-check.sh | modify | :80 socket rule asked in 4 places; S13-11 preview source rule; :101 AD-06 one writer has exactly 2 callers, PREVIEW video from exactly 2 places, reader-gone = stop, sets validated first; :306-310 five own-controls (S-07); OK text |
| apps/capture-worker/test/relay_unit_test.c | modify | :241 `preview_mode()` (4 accepts, 15 refusals incl. no source, ingest, case, double mode, unknown member); :1615 call |
| apps/capture-worker/test/relay_fuzz.c | modify | :346, :355 invariants know three modes, preview holds a source; :512 two preview seeds |
| apps/capture-worker/test-fixtures/row041_relay.py | modify | :491 `preview_message`, :502 `PREVIEW_TAIL`, :511 `preview_run` (stop by input / reader gone), :606 `preview` cases; docstring, usage |
| apps/core-server/src/capture/adapters/production-door.ts | modify | :38 module text; :54 type import Readable; :267-290 pipeline types; :298 `Plumbing`, :302 `ALONE`; :533 `startProductionProcess` = `startChild(options, ALONE).process`; :539 `startChild` (the old body, the ONE spawn); :569 `stdio: [plumbing.input, 'pipe', 'pipe']`; :620 stdout read only when `readOutput`; :693 a child without a door input cannot take a message; :713; :722 `startProductionPipeline` (2nd child stdin = 1st child stdout, door's end closed, end of one SIGTERMs other, kill both) |
| apps/core-server/src/capture/adapters/camera/relay-start.ts | modify | :31 module text; :120 `startMessageOf` (the ONE `credentialAtInjection` call, used by `launch` and the preview); :134-219 codec set, argv, types, `startCameraPreview` |
| apps/core-server/src/capture/__tests__/static.test.ts | modify | :277 G-R8 door test pins the new stdio line, the two input forms, the three `startChild` starts, unread output handed on |
| apps/core-server/src/capture/adapters/__tests__/static.test.ts | modify | :177 A-2 one maker `startMessageOf` (3 occurrences, both uses pinned); :445 A-8 second child `message: null`, input-less child refused; :482 C-6 `.pipelineDoor(` once, both stage literals and the argv pinned, observer pattern extended to `.pipelineDoor(` with a control |
| apps/core-server/src/capture/adapters/__tests__/production-door.test.ts | modify | :801 five pipeline cases with real node children |
| apps/core-server/src/capture/adapters/camera/__tests__/relay-start.test.ts | add | 7 cases with a fake pipeline door |
| docs/.../delegation_progress/file_claims.md | modify | 13 `row 89a` lines appended |

## Test Results
| Test Type | Command | Result | Notes |
|---|---|---|---|
| Relay static rules + selftest + unit + ASan/UBSan + fuzz + build + import net | `PKG_CONFIG_PATH=/opt/dems/ffmpeg-9.0.2/lib/pkgconfig flock .data/locks/heavy-host.lock make -C apps/capture-worker relay` | PASS | "relay-check.sh: src/relay: static rules OK ..."; "relay_unit_test: 1008 checks passed; ... 34 of 34 pass" (was 989); asan 1008 + 3 negative controls fail as required; "relay_fuzz: 522304 inputs over 8 entry point(s) in 16.0 s, seed 186: 0 failures"; "relay-check.sh: build/capture-relay: import net OK" |
| Selftest | `sh relay-check.sh --selftest` | exit 0 | 99 "refused as required" lines, 5 new ones of row 89 |
| Fixture preview | `M3_PORTS=8559,8561 flock ... python3 -B apps/capture-worker/test-fixtures/row041_relay.py preview` | PASS | "ROW41 RELAY: 7 run(s), 7 PASS, 0 FAIL" (h264, hevc, h264 in-band: stop -> rc 0 STOPPED in 0.04 s, video from a parameter set, decodes 0 errors, the preview argv makes MJPEG parts; reader gone -> rc 0 STOPPED in 0.06 s; no source / ingest -> rc 10; camera absent -> rc 20) |
| Fixture start (regression) | `row041_relay.py start` | 15 PASS then crash | crash in the PRE-EXISTING `raw_camera` (port 8567 reused within 1 s, `OSError: [Errno 98] Address already in use`), not in relay code |
| Probe regression | `row042_probe.py probe` | PASS | "ROW42 PROBE: 6 run(s), 6 PASS, 0 FAIL" |
| Core-server unit | `npx vitest run --project unit` production-door, relay-start, onvif-relay, stream-probe tests `--maxWorkers=2` | PASS | "Test Files 4 passed (4) / Tests 122 passed (122)" |
| Core-server static | same with `src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts` added (6 files) | 7 failed / 232 passed | all 7 reds are other rows' files (see Persistent Issues); the 3 rules of this row (G-R8 door, A-8, C-6, A-2) pass |
| Typecheck | `NODE_OPTIONS=--max-old-space-size=6144 flock ... npm run typecheck -w @dems/core-server` | PASS | `tsc --noEmit`, no output |
| End-to-end smoke (ad hoc, not kept) | tsx script: `startCameraPreview` + real `startProductionPipeline` + real relay, guard, /opt FFmpeg, test camera | PASS | H264: 31 JPEGs / 5 s, first chunk 2.38 s, stop 54 ms, reason STOPPED code 0; HEVC: 32 JPEGs, first chunk 2.38 s, stop 52 ms; credential in neither child's diagnostics |

## Verification
- Preview message: unit `preview_mode` + fixture `preview_without_a_source_address`, `preview_with_an_ingest_address` (rc 10).
- Stdout = media only: fixture criterion `no_report_line_on_standard_output` and `standard_output_is_video_from_a_parameter_set` PASS; stderr lines: `camera_playing`, `preview_streaming`, `exit` only.
- EPIPE ends cleanly: `preview_h264_reader_gone` rc 0 code STOPPED in 0.06 s.
- Record/probe unchanged: relay-check pinned lines unchanged and green; probe fixture 6/6; `report()` keeps REPORT_NOT_WRITTEN on every failed write including EPIPE (`relay.c:120-123`).
- Credential: only in the relay's start message (relay-start.test "the relay gets the preview message...", encoder `free(inspect(second))`); A-2 one `credentialAtInjection(` call.
- Door pipeline: production-door.test row 89 block (bytes flow child to child, `ended.first.output === ''`, kill reaches both, either end SIGTERMs the other, refusals).

## Persistent Issues
| Issue | Attempts | Root Cause | Current Status | Blocking? |
|---|---|---|---|---|
| A-9 red: `preview-manager.ts:40`, `preview-pipeline.ts:48` name a built adapter (`onvif-relay`) | 0 (not mine) | agent (b)'s new files; the A-9 list needs their entries | open, for controller | no for this row |
| A-10(c)/(d) red: `preview-pipeline.ts` is a new caller of the judgement | 0 (not mine) | agent (b)'s file; JUDGEMENT_CALLERS / SOURCE_TAKERS need its pinned call/use | open, for controller | no for this row |
| G-R10 SR-5 (`src/lcd/bridge.ts`), G-R16 (`src/lcd/index.ts`), row 157 (`DEMS_LCD_BACKEND_URL` in `src/config.ts`), P25 config.ts and app.ts hashes | 0 (not mine) | an LCD row editing app.ts/config.ts/src/lcd | open | no |
| Record mode end to end not run on this host | 2 | worker harness: worker rc 70 NO_CAMERA_CONNECTED for the control pusher too; an ad-hoc FFmpeg RTSP listener sink refused the push for the DEPLOYED (pre-change) relay and the new one identically (INGEST_REFUSED) | unverified live; covered by rules, unit, probe runs | no |
| row041 `start` crash at run 16 | 0 | pre-existing: `raw_camera` binds 8567 without SO_REUSEADDR 1 s after the previous run | open, not mine | no |

## Issues & Decisions
| Step | Issue / Decision | Resolution |
|---|---|---|
| door | One `spawn(` call site kept (an internal `startChild` with `plumbing`), instead of two textual spawns | Both children run under the identical start rules; G-R8 "one spawn" holds; pinned |
| door | End of one child -> `endInput` + SIGTERM of the other (no new timer: the door's 3 timers stay pinned) | The SIGKILL bound lives in `stop()` of relay-start (`PREVIEW_STOP_BOUND_MS` 3 s) |
| door | Encoder exit is 255 on a normal stop (FFmpeg "Immediate exit requested" after the guard's SIGTERM) | Reason/code come from the relay (0) for STOPPED; cosmetic |
| relay-start | Member is named `pipelineDoor`, not `pipeline`: onvif-relay.test T-1 forbids the word `pipeline` in relay-start (unit-of-work rule) | — |
| relay-start | Encoder started with `processGroup: true` (guard + FFmpeg signalled as a group) | relay without a group, as today |
| relay | EPIPE and ECONNRESET both count as "reader gone" (Node's stdio may be a socket pair) | report keeps old behaviour |
| relay | Parameter sets written when the gate opens (first keyframe, and after every gap); no re-open in preview | doc in relay.h |
| tests | Door pipeline tested with REAL node children (pattern of the existing door test) rather than a fake spawner | stronger wiring evidence |
| fixture | Host FFmpeg has no libx264/libx265: the test camera's two clips were encoded on the Windows controller host with the fixture's exact command and copied to `.cache/rtsp-test-camera/` (git-ignored) | no install on the host |
| fuzz | `relay_fuzz.c` edited (an existing relay test file) so its invariant knows the third mode | — |
| note | FFmpeg raw-stream probing gives ~2.4 s to the first JPEG at 1080p test bitrate; a low-bitrate camera may take up to the default 5 s analyzeduration. `-probesize`/`-analyzeduration`/`-fflags nobuffer` would cut it but change the D53 argv | decision for the controller |
| review | Review recommended: production-door.ts (pipeline), relay.c stdout writer, relay-check.sh new rules | for senior-code-reviewer / security-review |

## Next Steps
- Controller: add A-9 and A-10(c)/(d) entries for `preview-pipeline.ts` / `preview-manager.ts` (agent (b)), or assign it.
- Optional: decide on the encoder probe flags (startup latency).
- Live camera run not done (no camera on this bench in this session).
