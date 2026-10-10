---
task_slug: dems_real_capture_sealing
date: 2026-10-09
agent: coder-execution (integration pass D3, decision D133)
status: complete - items 1 and 3 end in a ruling for the controller
---

# Integration pass D3 - local Mac camera / microphone helpers

Camera and microphone were NOT opened (one `-h demuxer=avfoundation` and no device call at all).
Of the user's runs only `result.json`, `worker.jsonl`, `manifest.jsonl`, `mic.jsonl`, `helper1.err`,
`helper1.progress` of `l134_cam_t2` were read, as text. No media under `.data/capture-local/` was
opened, probed or decoded. Nothing deleted. No commit. Worker not edited, not rebuilt.

| # | Item | Status |
|---|---|---|
| 1 | Microphone 8/9: analysis + ONE attended diagnostic | done; production arguments unchanged; the user's run decides |
| 2 | `CAPTURE_FAULT` of `l134_cam_t2` | done: it is the helper's stop; script now stops the session first; request to row 71b |
| 3 | Fixed-grid check | cause proven; constant-rate candidate built and proven - and NOT switched on: it turns `M4-LOCAL-AV-1` red (ruling) |
| 4 | `fence.test.ts` red x2 | done + opposite case + its control |

## 1. Microphone 8/9

The table (`mic-helper-args.ts`): input `-f avfoundation -i none:<name>` with no input option; output
`-ac 1 -ar 48000 -c:a pcm_f32le`. So the program converts whatever the device reports to 48 kHz; no
wall-clock option, no filling resampler. Candidates against D128's numbers (42,666 /s = 0.8889):

| Candidate | Predicts | Verdict |
|---|---|---|
| device at 44.1 kHz relabelled 48 kHz / a 44.1-48 mismatch in the session | 44,100 /s = 147/160 = 0.919 | rejected by the numbers (3.3 % away; a known 44.1 kHz input would be resampled to 48,000) |
| voice-processing format (16 / 24 kHz) | 1/3 or 1/2 | rejected by the numbers |
| wall-clock timestamps + a dropping resampler | - | not in the table (neither option is there) |
| buffers lost by a small queue | 512 frames per read at the READER's cadence | fits: 834 chunks in 10.01 s = one 512-frame chunk every 12.0 ms (median 12.4), evenly; 10.67 / 12 = 8/9 |

Hypothesis (NOT proven; from FFmpeg's avfoundation input as I know its source up to 7.x - version
9.0.2 here was not read): the input keeps ONE audio buffer (a new one replaces an unread one) and the
reader sleeps 10 ms when it finds none, so it wakes about every 12 ms while the device hands over
512 frames every 10.67 ms. Consistent, not proof: `libavdevice.63.dylib` imports no buffer-queue
function (`nm -u`: no `CMSimpleQueue*` / `CMBufferQueue*`); and a device that itself dropped every
ninth buffer would show a median of 10.67 ms with a periodic 21 ms gap (the generated `LOSSY_8_OF_9`
proof reads median 10.68) - the user's run read 12.4.

The diagnostic: `e2e/local-mic-capture.ts --diagnose` (`__tests__/mic-diagnose.ts`: variant table,
reader of FFmpeg's input line, arithmetic, reading). Four variants, 5 s each, killed at 5.75 s at the
latest: **at most 23 s of microphone**; first printed line says so. Nothing on disk (samples over
standard output, counted, dropped); FFmpeg's text is counted, never printed.

| Variant | Arguments | Decides |
|---|---|---|
| A PRODUCTION | the production list (only: log level `level+info`, no `-progress`, `pipe:1`) | reproduces the deficit |
| B RAW_PACKETS | `-map 0:a:0 -c:a copy -f data` | loss before the output line (B short like A) or in it (B full) ; device format as reported |
| C FILL_BY_DEVICE_TIME | A + `-af aresample=async=1000:min_hard_comp=0.005` | timestamps carry holes (rate back, about 111 per mille zeros) or are contiguous (rate stays) |
| D FILL_BY_WALL_CLOCK | C + `-use_wallclock_as_timestamps 1` | the stop-gap: restores the RATE, not the sound |

Proof on generated sources through the REAL program (no device; `--proof`), one run each:

| Source | A | B | C | D | reading |
|---|---|---|---|---|---|
| `TRUE_48K` | 47,986 = 1/1, median 10.64 ms | 47,998 | 47,986 | 47,876 | `NO_DEFICIT` |
| `LOSSY_8_OF_9` (42,667 /s, holes in the timestamps) | 42,731 = 8/9 | 42,718 = 8/9 | 47,977 = 1/1, zeros 112.4 per mille, longest 10.7 ms | 47,889, zeros 103.8 | `BUFFERS_MISSING_BEFORE_OUTPUT_LINE` |
| `RELABEL_441` (44,100 /s labelled 48,000) | 44,080 = 147/160, median 11.59 against 10.67 | 44,080 | 44,100 (unchanged) | 47,845 | `SOURCE_SLOWER_THAN_ITS_LABEL` |

Each helper lived 5.007-5.024 s. `mic-diagnose.test.ts` (18 cases) pins the same arithmetic on
generated arrival sequences, the 23 s bound, and that variant A is the production list.
If the hypothesis holds, NO argument repairs it (the loss is inside the program's input); C / D only
restore the rate with silence in the holes - not fit for evidence audio.

## 2. `CAPTURE_FAULT` in `l134_cam_t2`

`worker.jsonl` holds exactly one `warn`: `INGEST_ENDED` (`av_error` "End of file", 285 packets) at
`...156004614`, 244 ms BEFORE `stop_received` (`...156249041`). The long-GOP channel is clean:
`keyframe_interval_observed` at level info, `observed_ms` 1019, `above_bound` false; no
`keyframe_interval_above_bound`; the start has no warning. The worker raises the warning in
`ingest_over` (`apps/capture-worker/src/ingest.c:93-100`) unless the session is already stopping
(`:96`). So: the script stopped the helper (SIGTERM, rc 255) before the session - for the worker a
camera lost in a running session. Correct worker behaviour; nothing for row 71a.
Script: `stop_at_bound` now writes the worker's STOP first, waits at most 0.15 s for
`stop_received`, then SIGTERM; SIGKILL still AT the bound. New criterion
`clean_stop_raises_no_warning`. Generated runs: session first -> `warnings: []`; control
`--helper-first` -> `["CAPTURE_FAULT"]` with the same `INGEST_ENDED` line.
Request filed for row 71b (`file_requests.md`): the product's stop must use the same order.
(The `av` mode still stops its helpers first; it does not judge warnings - left as it was.)

## 3. Fixed-grid check

What the 26 lines are: row 60's `playable` lets the null muxer re-time video to the nominal rate;
two frames closer than half a period (16.67 ms) land on one tick -> one line
"non monotonically increasing dts" per pair. On a generated variable-rate picture
(`--jitter-ms 10`, intervals 0.1 / 33.33 / 71.52 ms) through the table into the built worker:
**95 lines, and exactly 95 intervals under 16.67 ms.** The user's run: 26 lines, smallest interval
12.94 ms. The video packet times of the user's file were not read (media), so 26 = 26 is inferred.

| Run (heavy-host lock, ports 8559 / 8561) | check | lines | intervals min / median / max |
|---|---|---|---|
| `cam d3_vfr_before --source generated --jitter-ms 10` (product table) | false | 95 | 0.1 / 33.33 / 71.52 |
| `cam d3_vfr_after ... --grid` (`-vf fps=fps=30:round=near` before the encoder) | **true** | 0 | 33.33 / 33.33 / 33.33 (282 x 3,000 ticks) |
| `av d3_av_pm80 --case pm80` WITH the grid | - | 0 | **FAIL**: camera 1 holds 3 of 4 one-frame flashes (one frame dropped by a crowded tick); camera 2 error 16.36 ms against the 2 ms regression bound (40 ms product bound passes) |
| `av d3_av_pm80_default` (product table, after the fail) | true | 0 | PASS, error 0.046 / 0.044 ms |

So the candidate does what D133 (4) asks AND breaks an existing check; with the real camera
(stamps quantised by the reader, 13-48 ms) it would repeat and drop frames routinely. It is in the
table as `fixedGrid` (`camera-helper-args.ts:65`, `:119`, `:126`), **default off; the production
list is byte-for-byte what it was** (pinned list in `camera-helper.test.ts` untouched;
`camera-fixed-grid.test.ts` pins the candidate). `-fps_mode cfr` is not an alternative: with
wall-clock timestamps the program refuses every frame ("frame duplication too large", 121 of 121).
Ports 8565 / 8566 of the brief are outside the protocol's media range (8554-8564): refused by
`isLoopbackIngest` and by the worker driver; 8559 / 8561 were used under the lock.

## 4. `fence.test.ts`

Cause: the door's living helper never reported; with the test's immediate timers the 8 s bound
fired at once and killed it -> `OPEN_FAILED / EXIT_AT_START` (`camera-helper.ts:205`). Fix in the
TEST door only: `ProcessScript.reports` + `LIVING_PROGRESS` (`mic-support.ts:67`, `:71`, `:147`);
the fence test's living helper is `LIVING` (`fence.test.ts:355`). Added `:427` the opposite case
(a helper that never reports, timers fired in clock order: opened at 1.5 s, at 8 s killed and
reported `OPEN_FAILED / NO_FRAME_WITHIN_8S`, `openSources()` empty) and `:446` its control.
**No real device can be reached through this test:** every registry in it is built with the
scripted door (`fence.test.ts:359`, `:394`, `:432`, `:450`), and that door starts a real process
for one command only - `mic-support.ts:134`: `if (options.command === MKFIFO) return
startHelperProcess(options);` - everything else is a scripted object that spawns nothing; the
program path is `/opt/dems/helpers/ffmpeg` (`support.ts:101`), which is never started.

## Commands and results

| Command | Result |
|---|---|
| `npx vitest run --root apps/core-server --project unit src/capture/adapters/local src/capture/fence </dev/null` | in the sandbox 232 / 3 (`mic-helper.generated.test.ts`: `ps` and loopback bind EPERM); repeated with the sandbox off: **12 files, 235 passed, 0 failed** |
| `npm run typecheck -w apps/core-server` | 29 errors in 15 files, **none in `adapters/local` or `fence`** (in-flight: `capture/__tests__/{forwarder,forwarder-engine,records,supervisor}.test.ts`, `sealing/pipeline/contract.ts`, `test/support/capture.ts`, module `__tests__/support.ts` x6, `db/reset`, `recording-fragments`) |
| `npm run lint -w apps/core-server` | no finding in the two folders (warnings elsewhere) |
| static guards `adapters/__tests__/static.test.ts`, `test/static` | 153 / 2: A-5 (red by design) and `imports.test.ts` (new folders of rows in flight) - neither names this pass's files |

Run folders left (generated pictures only): `.cache/m3worker/runs/d3_{vfr_before,vfr_after,stop_control,av_pm80,av_pm80_default}`.

## Checks for the test runner

None outstanding.

## For the user (Terminal app, repository root; not from the Claude app)

    npx tsx apps/core-server/src/capture/adapters/local/__tests__/e2e/local-mic-capture.ts --program "$PWD/.data/helpers/ffmpeg" --diagnose

Microphone: at most 23 s in total (4 x at most 5.75 s; the orange indicator may blink between
variants). Seen: the first line with that figure, four JSON lines A-D about 5 s apart, one closing
line with `reading`. About 22 s. No file, no sound played. Speaking is not needed.

## Decisions for the controller

1. Microphone: wait for the user's four lines. Expected if the hypothesis holds: A and B at 8/9 with `reportedInputRate` 48000 and median about 12 ms, C at 1/1 with about 111 per mille zeros -> `BUFFERS_MISSING_BEFORE_OUTPUT_LINE`. Then no argument fixes it: ruling between another capture program for the microphone (new component) and the D stop-gap (rate only, holes of silence).
2. Camera grid: `fixedGrid` exists and is OFF. Ruling: (a) switch it on and accept up to 16.7 ms + repeated / dropped frames, which needs `M4-LOCAL-AV-1`'s 2 ms bound and "every flash" re-based; (b) keep variable-rate and rule a variable-rate form of row 60's check for the local camera (D133 (4) said no); (c) a device-timestamp design (a row, H-17 again).
3. Row 71b: session stop before source close (request filed).
4. Ports 8565 / 8566 are not usable without widening the protocol's media range.

## Follow-up (ruling D144): real-mode db tests take row 61's boot fixture

`capture.boot` is mounted, so a real-mode boot needs a worker that says HELLO, a private media root and a signing key.
- `capture/fence/__tests__/fence.db.test.ts`: `REAL` (and `DEVELOPMENT`, which spreads it) now carries `dataDir` + `captureWorkerPath` of `realBootFixture('fence')`, key provisioned, removed in `afterAll`.
- `engine/__tests__/capture-actions.db.test.ts`: the real-mode boot of `booted()` takes `realBootFixture('r58')`. `engineApp` could not name a worker, so `test/support/engine.ts` got ONE additive option `EngineAppOptions.config` (spread into `unitTestConfig`; existing callers unchanged).
- `modules/capture-config/__tests__/integration-c1.db.test.ts`: already carried the fixture in the working tree (`realBootFixture('c1')`, not this pass's edit); nothing changed.

`/usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db <the three files>` (once, sandbox off): **3 files, 26 passed, 1 failed.** The one red is `capture-actions.db.test.ts` A-4, unchanged cause: `BootError` at step `transcriber.config`, `TRANSCRIBER_CONFIG_UNRESOLVABLE / CPU_LOCAL_RUNTIME_MISSING` - left as ruled. Not checked: whether `capture.boot` runs before or after that step in A-4.
No device is opened by these tests: the helper program of the fence and c1 files is `/bin/echo` (`fence.db.test.ts:8-10`: it prints no list, so both local devices read "not listed"); the worker is the fixture's shell script (`capture/boot/__tests__/support.ts:5-8`: one HELLO, then `cat > /dev/null`); `capture-actions` names no helper and feeds generated telemetry frames.
