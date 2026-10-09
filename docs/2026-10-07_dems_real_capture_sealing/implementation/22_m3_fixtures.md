---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 60
milestone: M3-W4
date: 2026-10-09
agent: coder-execution (driver; no pair reviewer follows this row - decision D88: quality control is the M3 code review, row 63, and the M3 gate, row 64)
tier: 3
source_plan: identification/02_structured.md rev 2.3 row 60; masterplan/05_capture_architecture_spec.md A.8, A.8.1, F
status: needs-review
---

# Row 60 - fixtures, analysers, the one capture e2e target (M3-W4; closes NM-14)

Status: **needs-review**. Everything the row names is built and measured (section 2: the e2e target,
78 verdicts, exit 0, twice each incl. 23 negative controls). It is not "complete" because: (a) the
mediated request of row 65 (mic lateness bound beyond +-5,000 ppm, a change of `audio.c` and of the
protocol) arrived after the official series and is NOT built - follow-up, section 7; (b) twelve
decisions taken here need the controller's ruling (section 6); (c) the ONVIF stub has only been
driven by a reference client written in its own test file, never by the `onvif` package (not
installed) - section 4.4.

All commands run from `/Users/gsp-budi/Documents/DEMS`, sandbox off where a loopback port is bound
or `ps` / `lsof` is read. Text evidence: `implementation/evidence/22_m3_fixtures/`. Media and run
folders: `.cache/m3worker/` (git-ignored). FFmpeg libraries linked: libavformat 63.1.102, libavcodec
63.1.102, libavfilter 12.1.102, libswresample 7.1.102, libavutil 61.1.102 (FFmpeg 9.0.2).

## 0. What is real and what is a stand-in

| Thing | State |
|---|---|
| Capture worker, production supervisor | REAL (row 58). This row changed three worker lines (section 5) |
| Cameras | STAND-IN: `test-fixtures/fake_cam.c`, a process each, its own clock, RTSP push over TCP to 127.0.0.1 |
| Microphones | STAND-IN: `test-fixtures/fake_mic.c`, one separate process, own clock reads, own sample clock with `--ppm` |
| ONVIF camera | STAND-IN: `apps/core-server/test/support/fake-onvif-stub.ts`. No product code uses it yet (rows 131, 142) |
| The client that drives the stub's outcomes | a REFERENCE inside the stub's test file, not the product's client |
| SR-drift camera, M3-AV-2 case (c) | NOT built (row 62) |
| Long-GOP writer rule (OP-GOP), M3-KC-4 | NOT here (row 59); this row delivers the camera and reports what the worker says |

## 1. Where things live (decision D60-1)

| Path | Content |
|---|---|
| `apps/capture-worker/test-fixtures/` | NM-14 media fixtures, the target capture spec A.8 names: `fake_cam.c` (117 lines; `--gop` `:49`), `fake_mic.c` (144; `--ppm`, `--stop-at/--resume-at`, `--deliver-late-us` `:73`), `av_analyse.py` (280), `negative-control/skeleton111.c` + `README.md` |
| `apps/capture-worker/test/m3worker.py` | the harness, same path and same command line as in row 58 (1,539 lines) |
| `apps/capture-worker/test/e2e.py` | the series runner behind `make e2e` (new) |
| `apps/capture-worker/test/fake_mic.c` | STUB: three lines that include `../test-fixtures/fake_mic.c` (the file moved; the old path still compiles; nothing builds it) |
| `apps/capture-worker/README.md` | new; section "How to run the capture e2e" |
| `apps/core-server/test/support/fake-onvif-stub.ts`, `fake-onvif-stub.test.ts` | the ONVIF stub and its test. **Deviation from A.8's single target**, on purpose: the Node tests of rows 131 / 142 import it, `apps/capture-worker` is no npm workspace, and here it is type-checked and linted with the server. Import: `from '<...>/test/support/fake-onvif-stub'` |

No dependency on the docs tree or on a commit (F-14): `grep -n 'docs/\|git \|101ce62\|EVID\|m3proof'`
over `m3worker.py`, `e2e.py`, `Makefile`, `test-fixtures/*.c|*.py` finds comments only. The row-111
skeleton is vendored byte for byte: SHA-256 `bc08286c...1fd2894` = `git show 101ce62:apps/capture-worker/src/capture_worker.c`
(compared once, at vendoring). `.cache/row58/official.sh` and the evidence copy of row 58 still run
(same sub-commands); `summarize.py` of row 58 reads result fields that were renamed and is superseded
by `summary.txt`.

## 2. The e2e target

```
make -C apps/capture-worker e2e                     (sandbox off)
```
`Makefile:88` -> `test/e2e.py`: build (`make all proof fixtures`), then 78 checks = every check and
every negative control twice (`--runs 2`) plus the five mux-flag regressions of row 58 P4 once.

| Property | How | Evidence |
|---|---|---|
| Aggregate exit code | `e2e.py` `judge` `:185`, `aggregate` `:197`: 0 only when every check is PASS with exit 0 and every negative control is FAIL, accepted by the harness as "failed as required"; a crash, a timeout or no result is never "failed as required"; 1 otherwise; 2 = could not run; 75 = lock not obtained | below |
| A negative control must fail FOR ITS REASON | `m3worker.py` `finish` `:191`: `--must-fail-on a,b` (+ `--may-fail-on`): the failed criteria must be exactly those | it caught my own wrong expectation in development: the 1,000-sample cut did not fail `count` (decoded - input was 984 of an allowed 0..2048) -> the count window was tightened and `count` moved to "may fail" |
| Heavy-host lock (coordinator rule, 2026-10-09) | the runner re-starts itself under `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock`; opt-out `E2E_NO_LOCK=1` for a caller that holds it | with the lock held by `sleep 6` the target waited and then ran (8 s for a 2.6 s check); during the series `lockf -k -t 0 .locks/heavy-host.lock true` -> "already locked", exit 75 |
| Load | waits before each timing-sensitive check while load > 8 or a `whisper-cli` / `omlx` PROGRAM is alive (by program name: a shell of another row that merely named `whisper-cli` in its wait loop stalled my first series) | load per check in `summary.txt` |
| Outside `npm test` | nothing in any `package.json` calls it | README |

**Official series** (`--tag row60 --ports 8559,8561`, under the lock; `evidence/22_m3_fixtures/e2e_row60_summary.txt`):

```
78 checks (55 expected PASS, 23 negative controls expected FAIL): 78 as expected, 0 unexpected
ports still listening after the series: none
load at the start of the timing-sensitive checks: 2.28 .. 7.87
AGGREGATE EXIT CODE 0          make exit=0          1,420 s
```
An earlier attempt of the same series without the lock was stopped by me at check 23 when the lock
rule arrived (all 23 as expected; a reviewer's STT run had overlapped its first three checks). It is
not counted.

**The exit code can be non-zero** (`evidence/22_m3_fixtures/`):

| Proof | Command | Result |
|---|---|---|
| every recorded verdict flipped in turn (no run) | `python3 apps/capture-worker/test/e2e.py --prove-aggregate .cache/m3worker/e2e/row60` | "each of the 78 verdicts flipped in turn: 0 flips leave the aggregate at 0" |
| ONE real flipped verdict in a scratch run | `make -C apps/capture-worker e2e E2E_ARGS="--tag scratch --ports 8559,8561 --no-build --only 'av1_av2a_pm80_r1' --runs 1 --append 'av1_av2a_pm80_r1=--variant negctl'"` | `expect PASS got FAIL rc 1 UNEXPECTED`, `AGGREGATE EXIT CODE 1`, `make: *** [e2e] Error 1` (make itself then exits 2) |
| a check that crashes | scratch run of two checks whose base run does not exist | `got NO-RESULT ... UNEXPECTED`, exit 1 - also for the negative control among them |

## 3. Results by catalogue check (run 1 / run 2; load at start in `summary.txt`)

| Check | Result | Negative control (FAILED as required, both runs) |
|---|---|---|
| **M3-AV-1** 0 ms, with mic switch and tap | error 0.028 / 0.033 ms; T0 error 14 / 13 us. `av_regression_2ms` PASS and `av_product_40ms` PASS are two criteria | forbidden mux option (`use_editlist=1`): error 5,478 and 5,638 / 5,788 and 5,948 ms -> BOTH criteria fail, files still playable. Mics 5 ms late (`--deliver-late-us 5000`): 5.029 / 5.025 ms -> regression FAIL, product PASS: the two bounds are independent assertions |
| **M3-AV-1 / M3-AV-2 (a)** +80 / -80 ms, cameras and mics in separate processes | +80.0375 and -79.9625 / +80.0250 and -79.9750 ms (error 0.038 / 0.025) | same forbidden-option control |
| M3-AV-2 (a) through the production supervisor | +80.028 and -79.972 / +80.024 and -79.976 ms | forbidden option through the supervisor: 5,868 and 6,028 / 5,864 and 6,024 ms |
| **M3-AV-2 (b)** +-200 ppm keeps the injected slope | max error 0.033 / 0.031 ms; fitted +200.02 and -200.09 / +200.09 and -200.03 ppm (tolerance 71 ppm = 2 ms over 28 s) | the same files judged as "no drift": error 6.02 and 6.38 ms -> regression FAIL, product PASS |
| M3-AV-2 (c) | not built (row 62) | - |
| **M3-RTSP-BIND-1** worker sockets with a UDP-asking client | 41 snapshots each: 0 UDP, 0 off loopback; seen `127.0.0.1:8559 (LISTEN)`, `127.0.0.1:8561 (LISTEN)`, one ESTABLISHED on 8561; `INGEST_OPEN_REFUSED` after 31 logged libav errors; other camera recorded; exit 0 | vendored row-111 binary: `UDP *:5000`, `UDP *:5001` -> fails `no_udp_socket` and `every_socket_on_loopback` |
| **Listener snapshot** (worker + fixtures; 33 session-type checks) | before the sources: listeners exactly `127.0.0.1:8559`, `127.0.0.1:8561`; one second into the streams: 4 sockets of 4 own processes, 0 off loopback, 0 UDP, 0 on the ports of other systems (5173-5178, 8000, 5432, 4421-4423, 4432, 8081). 33 of 33 lines identical | the bind control above; both ends of a connection must be 127.0.0.1 (row 58 checked that the text occurred in the row) |
| Mic 100 ppm fast / slow (2 ms bound) | 0.64 and 0.68 / 0.75 and 0.77 ms; slow 1.18 and 1.20 / 1.09 and 1.21 ms; audible every second, 0 null-level frames | no compensation (2,000 ppm): 30.6 and 34.6 / 37.3 and 39.3 ms -> fails the mic bound (the product bound may or may not fail: 39.3 is close) |
| Mic 2,000 ppm slow (5 ms bound, D58-14) | 1.81 and 1.85 / 1.91 and 1.89 ms | same |
| Mic stops at 12 s, returns at 17 s (15 ms bound) | after the return 1.77 and 1.21 / 1.31 and 1.29 ms; silence in the gap; 100 telemetry frames with `dbfs: null`; one restart per mic | - (criteria `silent_in_the_gap`, `heard_again_after_the_return`) |
| **Continuity (AU2-05)**, decoded samples | spacing error 0 samples on all 5 intervals, position error 0.0 on all 6 beeps (= manifest + 1,024: file time 0 = T0 - 1024/48000 holds, N-12), decoded - input 2,016 / 1,056, standby tone 0.475 s with phase deviation 0.0033 rad. Packet grid `[1024]` printed, not judged | 1,000 samples cut: spacing -1000, position -1000 -> FAIL. 100 samples lost and 100 repeated inside the standby window: count, spacing, position still PASS, `tone` FAILS (1.048 rad) |
| **Long-GOP camera** (`--gop 250`) | keyframe distance in both files `[250]`; video samples per fragment `[0, 0, 250, 250, 250, 250, 250, 150]` (two audio-only stall cuts, then 5 s fragments); AV error 0.022 / 0.015 ms on 7 events; 1 event per camera not recorded (first GOP). **The worker reports nothing about the observed keyframe interval** (0 log lines, 0 warnings) | a GOP-50 run judged as 250 -> FAIL |
| Leftover scope (R-7) | another run's `fake_mic` is not reported; an own one is; gone after its kill | inside the check |
| Unit (`make unit`) | anchor checks hold; old slew rule fails; **without the tick it fails (R-1)**; 200 kills, 0 violations | two red builds of the same test |
| Row-58 regressions (`proto`, `camstop`, `fatal` x3 + control, `kc1`, `kc3`, `nocam` x2, `sup nocam`, `norefusal`, P4 x4) | PASS both runs | re-encoded file (H-4), `maxRestarts 0`, `delay_moov` under a stall (5,779 / 5,939 ms): FAIL |

Not in the target: the option-C mutation of the supervisor (`neg_kc1`, row 58): it edits a tracked
server source and does not belong in a shared tree.

## 4. What was built

### 4.1 Fixtures

| Row text | Where | Note |
|---|---|---|
| fake RTSP sources; separate-clock camera in its own process (H-10, AU2-06); flash generator | `fake_cam.c` | one white frame at chosen frames; `claimed` vs true epoch = the injected offset; `--drift-ppm`; refuses any URL not `rtsp://127.0.0.1:` (`:53`); opens no listener |
| long-GOP camera (AU2-08) | `fake_cam.c --gop 250` (`:49`, `:61-66`) | x264 `keyint = min-keyint = N`, no scene cuts |
| fake mics, reference tones, beep generator | `fake_mic.c` | mic 1 noise + 1 kHz bursts at absolute instants on ITS clock; mic 2 880 Hz; manifest = truth |
| own sample clock, stop and return | `--ppm`, `--stop-at/--resume-at` (from row 58 fix round 1; now named checks) | - |
| a capture latency the worker cannot know | `--deliver-late-us` (new) | the control that the AV check sees a T0 error |
| 0 / +80 / -80 truths | `m3worker.py` `CASES`, `build_truth` `:324` | written to `truth.json` before the run |
| all fixture listeners on 127.0.0.1:8554-8564 | the media fixtures have none; the ONVIF stub refuses any other port and has no host option | `check.sh` `fixture_rules` `:75` (new static rule, 5 planted lines refused in `make selftest`) |

### 4.2 Analysers (`av_analyse.py`)

| Weakness | Fix |
|---|---|
| N-13: each flash was paired with the NEAREST beep | pairing by identity (`find_beeps` `:136`, `av_offsets` `:156`): a beep is the one onset within 0.25 s of where its own mic manifest puts it (exactly one, no stray onset); flash n of a camera is event n. Row 58's control read 5,520 / 3,680 ms; the same defect now reads 5,478 / 5,638 ms (the true per-camera values) |
| AU2-04: one merged verdict | returns `(regression, product, detail)`; callers keep two criteria |
| AU2-05 | `continuity` `:251`, `tone_phase` `:216` |
| AU2-03 | unchanged method: first decoded sample above threshold, frame pts |
| first GOP dropped by the worker | events with `frame < gop` are expected to be absent; any other mismatch of counts fails |

### 4.3 Harness (`m3worker.py`)

R-7: `spawn` `:95`, `own_processes` `:103`, `leftovers` `:162` - process groups the run created,
their descendants, and the worker pid a supervisor reported. Ports from `M3_PORTS` (`:49`). Socket
judgement on both endpoints (`endpoints` `:121`, `own_sockets` `:146`). Named criteria (`Crit`
`:175`). New sub-commands: `avcheck`, `gopcheck`, `continuity`, `selfcheck`; `session --gop
--mic-late-us`; `mic --mode p100|m100`. `build` calls `make all proof fixtures` only.

### 4.4 Fake ONVIF stub (`apps/core-server/test/support/fake-onvif-stub.ts`)

`createFakeOnvifStub({ ports: { discovery, device, rtsp }, credential, devices?, clockOffsetMs?, govLength?, rtspDigest? })` `:238`;
`freeFakeOnvifPorts()` `:192` (three free ports, looked for from 8564 downwards).

| Spec A.8.1 | Implemented |
|---|---|
| ST-1 | UDP on 127.0.0.1 answers a UNICAST Probe; N devices (0 = empty); `RelatesTo` = the Probe's MessageID; endpoint reference, Types, scopes Profile / hardware / name / location, XAddrs, MetadataVersion; answers a probe naming `Device` or `NetworkVideoTransmitter` or no type |
| ST-2 | `setDiscoveryMode`: `SILENT`, `WRONG_RELATES_TO`, `FOREIGN_XADDR` (192.0.2.10, never contacted), `NO_XADDRS`, `TWO_MATCHES_IN_ONE`, `EMPTY_MATCHES`, `OVERSIZED_BODY` (60 KiB; arrives on this macOS with a raised send buffer), `ENTITY_EXPANSION`, `NOT_XML`, `FLOOD_300`; `sendUnsolicited(target)` |
| ST-3 | HTTP SOAP: `GetSystemDateAndTime`, `GetServices`, `GetCapabilities` (no authentication), `GetProfiles`, `GetStreamUri` (WS-UsernameToken PasswordDigest with clock window 5 s and one-time nonce, OR HTTP Digest MD5 qop=auth); `setDeviceMode`: `NO_PROFILE`, `H265_ONLY`, `FOREIGN_STREAM_HOST`, `BASIC_ONLY`, `NO_ANSWER`; `closeDeviceListener()`; a wrong credential is 401 in every mode |
| ST-4 | TCP: `OPTIONS`, `DESCRIBE` (H.264, H.265, H.264 without parameter sets; optional digest challenge); every other method 405 AND a violation |
| ST-5 | `requestLog()` = `{ channel, method, operation, authPresent }`; `violations()` = `OPERATION_NOT_ALLOWED`, `PASSWORD_IN_CLEAR`, `RTSP_METHOD_NOT_ALLOWED` |

NOT implemented (stated in the file header): multicast, Hello / Bye, IPv6, TLS, WS-Security beyond
the UsernameToken, any operation outside the read-only list, SETUP / interleaved RTP, an XML parser
(requests are read with regular expressions), the V-4 random answer delay.

Test `fake-onvif-stub.test.ts`: **35 tests pass** (5.1 s; `npx vitest run --root apps/core-server --project unit test/support/fake-onvif-stub.test.ts`).
Outcomes driven on loopback by the reference client: `REACHABLE` (plain; with `GOP_ABOVE_BOUND` +
`NO_PARAMETER_SETS_IN_SDP`; behind an RTSP digest round), `UNREACHABLE` (refused; accepted and never
answered, 300 ms client timeout), `AUTHENTICATION_FAILED` (wrong secret, wrong user, `SCHEME_NOT_ALLOWED`
for Basic-only with 0 password-in-clear violations, RTSP refuses after one round), `WRONG_PROFILE`
(no profile; `STREAM_HOST_MISMATCH` with 0 RTSP requests), `NOT_H264` (ONVIF profile; RTSP SDP).
Listener snapshot in the test: `lsof` of the test process shows exactly `TCP 127.0.0.1:<p> (LISTEN)`
x2 and `UDP 127.0.0.1:<p>`. Mutations (`evidence/22_m3_fixtures/mutate_onvif_stub.sh`): 8 of 8 turn
1 to 12 tests red (foreign RelatesTo 12; clear password not recorded, TCP on every interface, SETUP
allowed, digest not compared, operation outside the list answered, port range not checked, UDP on
every interface: 1 each); file restored, SHA-256 equal, 35 pass.

HYPOTHESIS, not measured: the requests of the `onvif` npm package parse with the stub's
regular-expression reader. Rows 131 / 142 confirm or extend.

## 5. Worker source changed (the two items the brief allowed)

| Item | Change | Test |
|---|---|---|
| R-1 slew reference on report-less packets | `anchor_tick` (`src/anchor.c:25`, `anchor.h:32`), called for every video packet without a report (`src/ingest.c:361`) | `test/anchor_test.c:68-91`: 600 s without a report, then +200 ms: first step <= 10 us, with a report on every fifth packet largest step <= 10 us, <= 5,000 us in 10 s. Red: `-DNO_TICK` build fails with "first step ... 200000 us (allowed 10)" (`Makefile:64`, part of `make unit`). Consequence: with sparse reports the anchor moves SLOWER than 500 us/s, never faster |
| D58-16 as accepted by D85 | `OPEN_ERROR_LIMIT` 4 -> 32, code `INGEST_TRANSPORT_REFUSED` -> `INGEST_OPEN_REFUSED` (`src/ingest.c:58`, `:113`). The code is a log message only: 0 references in `apps/**/*.ts`, `packages/**` | `bind_udp` both runs: refusal logged once, after 31 libav error lines |

## 6. Decisions taken here (for the controller)

| ID | Decision |
|---|---|
| D60-1 | Homes as in section 1; ONVIF stub in `apps/core-server/test/support/` (deviation from A.8's target, reason given) |
| D60-2 | Pairing by identity, window 0.25 s, no stray onset (a stray is allowed only in the stop-and-return case) |
| D60-3 | The product bound is judged on error against truth, not on the absolute offset (a +-80 ms injection is by design beyond 40 ms) |
| D60-4 | Exit codes 0 / 1 / 2 / 75; a control must fail on named criteria |
| D60-5 | Continuity bounds: count 1,024..2,048 (resolution one AAC frame: alone it cannot see a small loss), spacing +-2 samples, position +-48 samples, tone 0.2 rad. Measured: 0, 0.0, 0.0033 |
| D60-6 | Mic bounds: +-100 ppm 2 ms (measured up to 1.21; 1.44 in a development run - the margin is small), 2,000 ppm 5 ms, return 15 ms |
| D60-7 | R-1 and D58-16 as in section 5 |
| D60-8 | Fixture static rule in `check.sh`; `negative-control/` excluded |
| D60-9 | Runner waits on load and on heavy programs by program name; heavy-host lock built in |
| D60-10 | Stub accepts WS-UsernameToken digest and HTTP Digest; ports chosen by the test inside 8554-8564, never 0 |
| D60-11 | Series uses the first two free ports of 8555, 8557, 8559-8564 unless `--ports` is given |
| D60-12 | Long GOP: reported as a gap for row 59 - nothing tells the operator that a camera sends a 5 s GOP |

## 7. Not proven, not built

1. **Mediated request of row 65** (mic buffer cap about 100 ms, an out-of-range telemetry field,
   +-20,000 ppm cases): NOT built. It changes `audio.c` and the protocol and invalidates the 78
   verdicts above; it needs its own run of the target. `MIC_WORKER_BUFFER_CAP_MS` stays 2,000
   (`FIFO_CAP (SR * 2)`), `reportsOutOfRange` stays false.
2. Fakes only; no real camera, microphone or ONVIF device. The stub was never driven by a real ONVIF client.
3. `lsof` snapshots every 100 ms cannot exclude a shorter bind; the guarantee rests on `protocol_whitelist=tcp` (row 58).
4. The series was run on a host with load 2.3-7.9 under the lock; not under STT load.
5. Continuity controls change decoded samples in memory, not a file.
6. `+1` runs: gate row 64.
7. Suites at the end (tree shared with eleven other drivers; attributed by file name, 0 failures and 0 type errors name a file of this row): capture-protocol 20 passed; shared 1 failed / 1,992 (`test/i18n.test.ts`, not this row); core-server unit 7-10 failed / 4,431, moving between two runs (capture `static.test.ts` and `adapters/__tests__/static.test.ts` of row 65, MODG x3, `modules/system`, `test/db/set4-rules`, `test/static/credentials`, `imports`); `src/capture` 3 failed / 207 passed of 210 (the two static files of row 65; the folder had 171 tests at HEAD); typecheck core-server and shared exit 2 on `capture/adapters/local/camera-helper-args.ts(54,15)` and `test/evidence-package.test.ts(453,17)` (not this row; core-server typecheck was 0 at 15:29 with this row's files in place); lint x3 exit 0; `make check selftest unit` green (23 planted lines refused); media in git 0; no process, no listener left.

## 8. Commands to re-run

```
make -C apps/capture-worker e2e E2E_ARGS="--tag gate --ports 8559,8561"      # about 25-35 min, takes the lock; expect AGGREGATE EXIT CODE 0
python3 apps/capture-worker/test/e2e.py --prove-aggregate .cache/m3worker/e2e/gate
make -C apps/capture-worker e2e E2E_ARGS="--tag scratch --ports 8559,8561 --no-build --only 'av1_av2a_pm80_r1' --runs 1 --append 'av1_av2a_pm80_r1=--variant negctl'"   # expect exit non-zero
make -C apps/capture-worker check selftest unit
npx vitest run --root apps/core-server --project unit test/support/fake-onvif-stub.test.ts </dev/null       # 35 passed
zsh docs/2026-10-07_dems_real_capture_sealing/implementation/evidence/22_m3_fixtures/mutate_onvif_stub.sh   # 8 red, restored
```

---
*Generated: 2026-10-09 16:55*
