---
task_id: 2026-10-07_dems_real_capture_sealing
pass: fix F-M3 (the findings of code-review row 63, milestone M3)
date: 2026-10-10
agent: coder-execution
tier: 2
source_review: gateway_check/16_m3_code_review.md (BLOCKER 0 / MAJOR 3 / MINOR 12 / NOTE 5; eight carried questions)
ruling: decision D179
baseline: tree at commit abf742f (every suite green); nothing committed by this pass; no migration
status: complete (see section 6 for what is NOT proven and section 7 for the decisions left to the controller)
---

# 116 - Fix pass F-M3: the M3 code review (capture worker, protocol, supervisor, static rules)

Rule of this pass (D179): for every finding fixed, FIRST the test that shows it (red), then the
fix (green). "Red" below names the run that failed before the change; a finding whose red could
only be shown on a seam says so.

## 1. Findings: reproduced? - fix - test - status

### MAJOR

| Finding | Reproduced? | Fix (file:line) | Test (red -> green) | Status |
|---|---|---|---|---|
| **R63-01** a stop cannot tell a clean worker exit from a failed or killed one | YES. `review-m3.test.ts` on the supervisor of `abf742f`: 7 of 7 stop cases red (`stop()` resolved `undefined`, `lastCrash: null`, no `workerDown`) | `apps/core-server/src/capture/supervisor.ts:560` (`stopFailureOf`), `:578` (`afterDown`: on the STOP path the cause is read, `lastCrash` set, `workerDown` with `restartInMs: null` said BEFORE phase IDLE), `:1012` (no live worker: the session's last down), `:1022` (kill at the grace = `STOP_TIMEOUT`); `types.ts:199` (`CaptureStopOutcome`), `:80` (`WorkerDownCode.STOP_TIMEOUT`). `stop()` now resolves `{ clean, down }`. CLEAN only when the worker acknowledged the STOP, wrote `AUDIO_TIMELINE_END` for the audio timeline it had begun, and exited 0 with no signal | `apps/core-server/src/capture/__tests__/review-m3.test.ts`, block "R63-01" - production supervisor, fake process: CONTROL clean stop stays clean; CRASH + exit 70 while closing; non-zero exit; kill at the grace; exit 0 without the acknowledgement; exit 0 with the timeline left open; a stop of a FAULTED session; a worker that never recorded; the crash of one session is not the outcome of the next. 28 of 28 green | **fixed in the supervisor.** The mapping `clean: false` -> the capture-session hand-off `INTERRUPTED` is fix F-M5's file (`capture-session/index.ts:1104` already reads this shape); notice line filed |
| **R63-02** nothing during a recording holds a fragment under the verifier's 64 MiB bound | YES. Writer: `writer_test` built with the rule off fails 3 SIZE BOUND checks. Worker: e2e `neg_r63_02_no_size_bound` (proof build with the rule off, same source): fragments above the bound are written, synced and checkpointed | ONE number: `packages/capture-protocol/src/index.ts:401` (named setting `maxFragmentBytes`, `--max-fragment-bytes`, default 64 MiB, max = the worker's compiled cap 256 MiB); the launcher passes the seal's bound, `apps/core-server/src/capture/index.ts:120`. Worker: `apps/capture-worker/src/ingest.c:301` (`write_bounded_locked`: every video and audio packet; when the sample at hand would take the OPEN fragment past the bound the fragment is CLOSED there, `:320`, and the sample begins the next one; the next keyframe begins a fragment again, `:312`); warning once per camera `:326` (`CAPTURE_FAULT` / `FRAGMENT_SIZE_BOUND_REACHED`, additive reason, advisory); backstop in the writer `sink.c:484` (`WRITER_FRAGMENT_TOO_LARGE`: a larger fragment is refused before a byte of it is written) | unit: `writer_test.c` "size bound" (+ negative control `-DDEMS_PROOF_NO_FRAGMENT_BOUND` in `make unit`); pins: `protocol-pins.test.ts` "R63-02: the fragment size bound is ONE number" (verifier = seal = launcher = package default = worker default); e2e `r63_02_fragment_size_bound` (generated source: pseudo-random pictures, keyframe every 5 s, about 9 MB per GOP; bound 2 MiB): every durable fragment <= bound (largest 2,039,774 of 2,097,152), 22 cuts per camera, 1,400 of 1,400 video packets in the file one frame apart, decodes, checkpoints contiguous, running hash = closed-file re-hash, the Core's tail validation MATCH, keyframe flags of the worker = the Core's box walk; control `neg_r63_02_no_size_bound` fails on exactly the three bound criteria | **fixed.** See section 2 for the spec decision (cut, not fault) |
| **R63-03** the long-keyframe-interval warning and the clock-near-bound flag reach no operator | not this pass | - | - | **fix F-M5's** (as briefed) |

### Carried questions ruled in D179

| Item | Reproduced? | Fix | Test | Status |
|---|---|---|---|---|
| **Q7 / R63-04** the version allowlist is applied at boot only | YES. `review-m3.test.ts` "R63-04" red on `abf742f`: a session `HELLO` `capture-worker/0.4.0+negctl` reached `RECORDING` | `supervisor.ts:274` (`helloRefusalOf` = the boot check's `workerVersionRefusalOf`, one rule), applied at `:680` to EVERY `HELLO`; refused = `CAPTURE_WORKER_VERSION_UNKNOWN` (`types.ts:65`), final, the worker is sent nothing. No bypass, no injected exception | first start; six other words (`-rc1`, `0.4`, `0.4.0.1`, `stub-worker`, `/x`, capitals); restart inside a session (option C): the replacing worker is refused, no START, no third worker; RECOVERY: `boot()` starts no worker; CONTROL: the release word records. e2e: `sup_refuses_proof_build` (unchanged since pass E2) still refuses the proof binary through the supervisor; every other control with a non-release binary already runs on the direct driver | **fixed.** The fake worker and (by fix F-M5, on request) the stub worker now say a release word |
| **Q8 / R63-05** protocol 4 members accepted and not validated | YES. `protocol.test.ts` "NO FREE TEXT FROM A WORKER" red on the schema of `abf742f` (the hostile `TELEMETRY.clocks[].deviceId` decoded `ok: true`) | Schema (`packages/capture-protocol/src/index.ts`): every ID is `CAPTURE_WIRE_ID` `[A-Za-z0-9._:-]{1,128}` (`:489`: session, correlation, device, track); `CRASH.signal` `^SIG[A-Z0-9]{1,12}$` (`:492`); `keyId` `^KID-...` (`:494`); `HELLO.workerVersion` a word (`:496`). A frame that breaks a form is `FRAME_NOT_A_MESSAGE` = the existing protocol-violation path of `ipc.ts`. What a schema cannot know, the supervisor holds: telemetry names devices of the plan only (`supervisor.ts:780`, `TELEMETRY_SUBJECT_UNKNOWN`); an `OPERATOR_SWITCH` interval names a waiting command (`:814`, `SWITCH_NOT_COMMANDED`) | one hostile frame per member: `TELEMETRY` clocks / ingest / fragments / levels `deviceId`, `sessionId`, `CRASH.signal` (6 values), interval `correlationId` (2), `keyId` (5), checkpoint `deviceId`, `HELLO.workerVersion`, `ACK.correlationId` - each beside its accepted control; supervisor: 6 telemetry cases + the uncommanded switch + its control | **fixed** |
| **Q6 / R63-08** four evasions pass both static nets | YES. On the tree of `abf742f` the old rule returns rc 0 for the digraph paste, the assembler label, the weak reference, `removefile()` and a trigraph; the muxer-name change (`"mp4"` -> `"segment"`) passed because the call was pinned by count only | `test/static/pinned_calls.py`: digraphs, trigraphs, `asm` / `__asm__` / `alias` / `weakref` refused outright (the sources use none); `removefile` and kin banned; `avformat_alloc_output_context2` pinned to the one string literal `"mp4"` with no format object and no file name. NEW net that does not read C: the import list of the linked binary (`--imports`, `test/static/imports.pin`: fopen, ftruncate, link, open, rename, unlink), run by the Makefile after every link of `build/capture-worker`. The remaining limits are STATED in the header of `pinned_calls.py` ("LIMITS") | `planted.tsv` + 7 lines; `check.sh --selftest` + 3 mutations and the import net on two real programs (`creat()` through an assembler label is refused by what it imports; its control passes). `make selftest`: every planted line refused by its rule; `guard-family.test.ts` pins moved by delta | **fixed** (a tripwire with stated limits, plus one net on the binary) |
| **Q6 / R63-07** the libavformat pin does not hold at run time | by a seam (a real mismatch needs another installed FFmpeg): the start check on a build whose verified number is not the running library | `ingest.c:73` (`lavf_runtime_mismatch`: `avformat_version()` against the built version), `capture_worker.c:419`: the worker does not start - ONE frame `CRASH LIBAVFORMAT_VERSION_MISMATCH` (no session) INSTEAD of `HELLO`, exit 70 (`ipc.c:260`). Supervisor: that one frame before `HELLO` is a named, final refusal (`supervisor.ts:731`); any other frame before `HELLO` is still a protocol violation | `test/start_checks.sh` in `make unit` (exit 70, exactly one frame, no HELLO, the log names both versions; control: the release build says HELLO and exits 0); `review-m3.test.ts` "R63-07" + control; `protocol-pins.test.ts` | **fixed.** The boot handshake reads it as "no HELLO" (the Core does not boot in real mode on such a host); notice line to the owner of `capture/boot/**` |
| **Q5 / R63-09** the reported `F_FULLFSYNC` may have been `fsync()` | by a seam (this volume takes the full sync): `writer_test` built with the reporting of `abf742f` (`-DDEMS_PROOF_SILENT_SYNC_FALLBACK`) fails 4 SYNC LEVEL checks | `sink.c:339` (`full_sync` returns the level it ACHIEVED), `:327` (`sink_sync_level` of the file), `:435` (the first sync decides the level; a later weaker one is a FAILED sync, `WRITER_SYNC_LEVEL_CHANGED`, no checkpoint); stated in `FIRST_DURABLE_FRAGMENT.syncLevel` (`ingest.c:187`; protocol `:322`, `:759`, an optional enumerated member); the Core logs it per camera file, and writes `CAPTURE_SYNC_LEVEL_NOT_FULL` to the log and the persistent error log (`capture/index.ts:202`) | `writer_test.c` "sync level" (fallback said; level change refused) + its negative control; `protocol.test.ts` "R63-09"; e2e: every recorded session now requires `first_durable_fragment_states_its_sync_level` | **fixed in the worker and the Core's log.** "Keeps it in the session record" is capture-session's (request line to fix F-M5). The manifest has NO durability field: no request to its owner, as ruled |
| **Q3 / R63-13** `skippedSpanMs` understates when untimestamped packets lead | YES. `anchor_test` built with the old arithmetic (`-DNO_LEAD`) fails; the worker of `abf742f` states 980 ms for the D130 case where 1,000 ms are missing | `anchor.c:109` (`skipped_span_ms`: camera span + the untimestamped lead, from the host clock and never below count x nominal frame period); `ingest.c:546` (the lead is counted and timed), `:655`; protocol comment of `skippedSpanMs`; spec erratum PE-R63-13 in §C.4 (the timestamp-less first keyframe as its own cause) | `anchor_test.c` check (4): the D130 case, no lead (control), a 5 s late first report, arrivals above the count, no nominal rate; negative control in `make unit`. Seen in the worker: `video_started` `skipped_span_ms 1000 = span_camera_ms 980 + 1 lead packet x 20 ms` | **fixed** |
| **Q4 / R63-12** the wiring of the clock floor in the ingest is covered by no check | YES. e2e `neg_r63_12_floor_not_acted_on` (proof build: the floor judged, not acted on) fails on exactly `camera_3000ms_behind_is_given_up_by_the_clock_floor` | no product change for the wiring itself; the proof switch `DEMS_PROOF_NO_CLOCK_FLOOR` (`ingest.c:614`) and the fixture mode `behind` | e2e `r63_12_clock_floor_wiring`: a fixture camera 1.5 s behind is ANCHORED and its offset REPORTED (`TELEMETRY.clocks[].lagMs` 1,520.1 .. 1,520.2 ms over 540 frames; the worker's `camera_clock_floor` line 1,520.4 ms); one 3 s behind is given up BY THE FLOOR (`camera_clock_out_of_bound`, `rule: floor`, 3,020.3 ms) and by name (`CAPTURE_FAULT` / `CAMERA_CLOCK_OUT_OF_BOUND`, CAM-02) | **fixed (check added).** Plain statement: section 3 |

### MINOR

| Finding | Reproduced? | Fix | Test | Status |
|---|---|---|---|---|
| R63-04 | see Q7 | | | fixed |
| R63-05 | see Q8 | | | fixed |
| R63-06 the `-PROOF` mark hangs on one macro | YES: the sources of `abf742f` built with ONE other switch (`-DDEMS_PROOF_KEEP_TORN_TAIL`) say `"workerVersion":"capture-worker/0.4.0"` | `worker.h:57` (`DEMS_PROOF_BUILD` when ANY switch is defined: 9 `DEMS_PROOF_*` names, `MIC_MAX_PPM`, `DEMS_MOVFLAGS`, `DEMS_VERIFIED_LAVF_VERSION_INT`); `ipc.c:251`; `Makefile` `CFLAGS :=` (the environment no longer reaches the release build); `check.sh` holds the list complete (a switch the sources test that is missing from it is refused, with a planted mutation) | `test/start_checks.sh` (one switch, no mux seam -> `-PROOF`; control: release word); `check.sh --selftest`; `protocol-pins.test.ts` | fixed |
| R63-07 | see Q6 | | | fixed. NOT done: making `$(BIN)` depend on `check` (it would run the rules on every build of a test binary); `make` (target `all`) and `make e2e` run them; the import net IS in the `$(BIN)` recipe |
| R63-08 | see Q6 | | | fixed |
| R63-09 | see Q5 | | | fixed |
| R63-10 the anchoring allowance counts from after the probe | **YES - reproduced by this pass** (the review could not): the worker of `abf742f` on the new fixture mode REFUSES a camera whose clock is 1.5 s behind, inside the 2 s bound: `camera_clock_out_of_bound lag_ms 2042.1` = 1,520 ms of offset + about 520 ms the first packet waited inside libavformat during the probe, allowance 0 | `ingest.c:498`: the reference is taken when `avformat_open_input` returned; the trend's "live" instant stays one second after the probe | red: `srcam --mode behind --variant before` (worker built from `abf742f`) FAIL; green: `r63_12_clock_floor_wiring` (the 1.5 s camera is anchored and records) | fixed. Consequence stated in section 3 and decision 7.2 |
| R63-11 the monotonic guard rewrites timestamps without a word | YES: on the worker of `abf742f` the new check fails (no line, no count) | `ingest.c:674`: every sample the guard moved is counted (`retimed` of `camera_summary`), the first is logged with its numbers (`video_timestamp_moved`) | e2e `r63_11_moved_timestamp_is_said` (fixture: frame 120 repeats the RTP timestamp of frame 119): logged once, summary counts 1, the camera with plain timestamps counts 0, the file's time never goes backwards | fixed (said, not changed). A B-frame fixture was NOT added: the behaviour of libavformat for B-frame RTP input stays undetermined |
| R63-12 | see Q4 | | | fixed |
| R63-13 | see Q3 | | | fixed |
| R63-14 the P25 record is stale | YES (`git diff 9d3a1ef..abf742f --numstat`: 29 / 69 / 2) | spec §I erratum PE-R63-14: every edit 1-30 with file, category, authority and state; edits 15-18 landed; 19-22 (D114); the four module registrations numbered 23-30 for the first time (D143, D140, D146, D147 (E)); THE SINGLE SOURCE of the waived lines is the list `WAIVED` of `capture/__tests__/static.test.ts` (comments of that list now carry the edit numbers). `app.ts` was NOT edited (a header line would itself be an edit of the frozen file) | the digest pins of `static.test.ts` (unchanged, green) | fixed (record) |
| R63-15 no whole e2e run with exit 0 for the committed tree | - | - | the whole series, once, on the tree of this pass: section 5 | see section 5 |

### NOTE

| Finding | Status |
|---|---|
| R63-16 video of a camera given up by the floor stays in its file | NOT fixed; now MEASURED: 28 video packets (0.56 s) of the camera 3 s behind are in its file before the floor gives it up (`r63_12_clock_floor_wiring`, `video_packets_of_the_given_up_camera`). Decision 7.2 |
| R63-17 three stale headers | `capture/index.ts` and `capture/ipc.ts` corrected; `modules/recording-fragments/index.ts:31-34` is outside this pass's area (note line filed) |
| R63-18 `gop_frames` read nowhere; `atoi` for two arguments | `--heartbeat-ms` and `--listen-timeout-s` are read with the strict `whole_number` (`capture_worker.c:379`); `gop_frames` is logged as `gop_frames_target` with the statement that nothing is enforced from it on a copied stream |
| R63-19 `playable()` re-times video to the nominal rate | NOT changed: it is the verdict function of about 60 checks of the series, and this pass's one whole run must judge the worker, not a changed judge. The pass-through form is used by the new checks (`playable_own_timebase`) |
| R63-20 two hand-written parts where a kit exists | recorded here as decisions under the ready-made-frameworks rule: (a) the JSON reader of `ipc.c` (135 lines) - the worker links only the FFmpeg that is installed and installs nothing (D24, `Makefile:2`); a JSON library would be a new dependency of an evidence-writing process; the reader is held strict by the plan checks (`proto`); (b) the C tokenizer of `pinned_calls.py` - kept as a tripwire; the ready-made answer the review names, the import list of the linked binary, is now the second net |

## 2. R63-02: the decision from the spec text (cut at the bound, not a fault)

The ruling asked to decide from the spec whether a fragment that does not start on a keyframe is
forbidden. It is NOT forbidden; it is the stated exception to a default:

- `masterplan/05_capture_architecture_spec.md:1003` rejects mid-GOP fragments "**for the default**";
  `:1019` names "a hard ceiling ... that accepts a mid-GOP cut (fragments without a keyframe)" as an
  open option, "Not decided here". The gate answer Q-GOP (a) chose the WARNING for the keyframe
  INTERVAL; it did not rule on a byte bound.
- `masterplan/06_evidence_package_spec.md:242` (field 50 `tracks[].keyframeAligned`) and `:304`
  (field 72 `files[].fragments[].keyframe`) are booleans that exist to state it; no V-check of the
  verifier requires a keyframe (`packages/shared/src/evidence-verify`: no reader of either field).
- Counter-reading, for the controller: `06_evidence_package_spec.md:879` "each fragment must be
  independently decodable for per-fragment AEAD (OD-03) and for the one-fragment tamper demo". It
  is the "Why it matters" row of the decision for the default; AEAD seals bytes and does not decode.
  If the controller reads it as a prohibition, the alternative is one line: `write_bounded_locked`
  returns an error at the bound instead of cutting (the track then faults by name and the session
  seals interrupted with the durable prefix) - and the open GOP is lost, which the cut avoids.

What the cut does: no sample is lost; the fragment after a cut carries `keyframe: false`; the next
keyframe begins a fragment again (so every camera GOP still starts one); the track's
`keyframeAligned` is false in the manifest for such a file. A SINGLE sample above the bound cannot
be put into any fragment: `SAMPLE_ABOVE_FRAGMENT_BOUND`, fatal (not reachable at 64 MiB with a
real camera).

## 3. Camera clocks: what is accepted, said plainly (Q4)

- A camera whose wall clock is up to **2.0 s** away from the host's is **ACCEPTED AND RECORDED AT
  ITS OWN CLOCK. Its video is placed that far from the truth. The offset is REPORTED, not
  corrected**: per camera in `TELEMETRY.clocks[].lagMs` (arrival minus camera time; it contains the
  delivery delay, about 20 ms on the fixture) and in the worker's `camera_clock_floor` log line.
  Nothing in the worker raises an operator-visible warning for a static offset inside the bound: a
  static offset cannot be told from a delivery delay without a round trip (`anchor.h`, "WHAT IT
  CANNOT SEE"). `nearBound` sees movement since the session's baseline only.
- Manifest field 40 (`tracks[].clockOffsetMs`) is written from the camera ADAPTER's `ntpOffsetMs`
  (`capture-session/index.ts`, "Field 40"), not from the worker's measurement. The worker's lag is
  not in the manifest.
- Above 2.0 s behind (or ahead): given up by name (`CAPTURE_FAULT` / `CAMERA_CLOCK_OUT_OF_BOUND`),
  at anchoring or - when the wait at anchoring hid it - by the floor one second into the stream.
  Up to that second its video is in the file at the wrong time (R63-16, measured above).

## 4. Fast proof (commands and results)

| Check | Command | Result |
|---|---|---|
| Worker static rules + self-test | `make -C apps/capture-worker check selftest` | rules OK; every planted line and mutation refused by its rule (75 "refused as required", the import net on two real programs among them) |
| Worker unit | `make -C apps/capture-worker unit` | all hold; negative controls fail as required: old slew, no tick, first-live-only, no floor, **no lead (R63-13)**, no truncation, **no size bound (R63-02, 3 checks)**, **silent sync fallback (R63-09, 4 checks)**, shared log quota; `start_checks` (R63-06, R63-07) |
| Protocol package | `npx vitest run --root packages/capture-protocol` | 31 passed (red before the schema change: 4 failed) |
| Core capture unit files + static guards | `npx vitest run --project unit src/capture/__tests__ test/static` (in `apps/core-server`) | 504 passed, 1 failed (30 files): `static.test.ts` "the client never leaves the file" - the ONVIF facade exports `connectionTargetOf`, an in-flight edit of fix F-M4 (`capture/adapters/**`), not this pass |
| Typecheck, lint | `npm run typecheck -w apps/core-server`, `npm run lint -w apps/core-server`, the same for `packages/capture-protocol` | clean |

`ipc.test.ts` (real stub process): 16 of 16 when run alone; two of its cases timed out once inside
the whole-folder run while the host was loaded by the parallel passes.

## 5. R63-15: the whole worker e2e series, once

Command (sandbox off, loopback only, the runner took `.locks/heavy-host.lock` itself; started once):

    make -C apps/capture-worker e2e E2E_ARGS="--tag fixM3_full --ports 8563,8564"

Result (`.cache/m3worker/e2e/fixM3_full/summary.txt`, `summary.json`; 2,288 s; libavformat 63.1.102;
load at the start of the timing-sensitive checks 0.97 .. 4.89):

    122 checks (81 expected PASS, 41 negative controls expected FAIL): 122 as expected, 0 unexpected
    ports still listening after the series: none
    AGGREGATE EXIT CODE 0

The series is the 117 checks of the tree at `abf742f` plus the 5 of this pass
(`r63_02_fragment_size_bound`, `neg_r63_02_no_size_bound`, `r63_12_clock_floor_wiring`,
`neg_r63_12_floor_not_acted_on`, `r63_11_moved_timestamp_is_said`). It built the worker from the
sources of this pass (last source change 10:46:41, build of the series 10:53) and ran every check
of the plain series against them, through the direct driver and through the production supervisor
(`sup_*`: the real worker's HELLO `capture-worker/0.5.0` is taken, its stop is clean, the proof
build is refused). No verdict was adjusted.

Before the whole run, the five NEW checks were tried once (`--tag fixM3_try`): four did not give
their expected verdict, each for a fault of the CHECK, not of the worker - a criterion that read
the held first frame as a gap, one that counted the end-of-stream warning as "another warning",
a wrong measure of the source's GOP bytes, and the same end-of-stream warning in the clock check.
That trial also showed that after a cut at the bound hardly any fragment started on a keyframe
(the muxer does not cut at a keyframe inside `min_frag_duration`); the worker was changed so that
the next keyframe begins a fragment again (`ingest.c:312`), and the four were run once more
(`--tag fixM3_try2`: 4 of 4 as expected) before the whole series. Red runs on the worker built
from `abf742f` (`M3_WORKER_BEFORE`): `srcam --mode behind` FAIL (R63-10 reproduced), `srcam --mode
retime` FAIL.

## 6. Not proven / real versus stand-in

- R63-07 and R63-09 are proven on SEAMS (a build that expects another library number; a hook that
  answers as a volume without the full sync). No second FFmpeg and no such volume exists on this host.
- R63-02 is proven at a bound of 2 MiB passed to the worker; the product passes 64 MiB. The rule
  and the code path are the same at any number (one comparison against `g_max_fragment_bytes`);
  a run that really writes more than 64 MiB between two keyframes was NOT made.
- R63-01: the supervisor's half is proven on the fake process; the session's `INTERRUPTED` hand-off
  and the interrupted seal are fix F-M5's and fix F-M7's files and suites.
- No device, emulator or browser check belongs to this pass. No local camera or microphone was opened.

## 7. Decisions for the controller

1. **R63-02: cut, not fault** - decided from the spec lines of section 2; the counter-reading is
   named there with its one-line alternative.
2. **R63-10 changes who is given up when.** Before: a camera whose first packets waited more than
   the remaining margin during the probe was refused at anchoring - also a camera INSIDE the bound
   (reproduced: 1.5 s behind, refused). Now it is anchored; a camera really beyond the bound that
   connects before it sends is anchored too and given up by the floor up to one second later, with
   that second of video (28 packets on the fixture) in its file at the wrong time. Removing that
   second needs either holding the first sample until the floor is judged (every such camera file
   would start up to 1 s later, and `FIRST_VIDEO_SAMPLE.skipped` would need a fifth reason = a
   protocol change), or a ruling that the second is acceptable because the fault is raised by name.
3. **A real-mode boot on a volume without the full sync** (R63-09): the worker now SAYS `FSYNC`
   and the Core logs it at warn; whether the boot should REFUSE such a volume is not decided.
4. **Version of the protocol stays 4**; three additions are additive (a warning reason, a named
   setting, an optional record member). The closed forms refuse frames no worker of this tree
   writes. The worker names itself `capture-worker/0.5.0`.
5. **The static test `forwarder-engine.test.ts`** (one CONTROL case) and **`fault-lifecycle.test.ts`**
   (one case) were edited by this pass although fix F-M5 works in that folder: both asserted the
   behaviour D179 rules out (telemetry with unknown IDs handed on; an uncommanded switch handed on).

## 8. Checks for the test runner

| Command | Lock | Expected |
|---|---|---|
| `npm run test:db -w apps/core-server -- src/capture-session src/capture-notices src/capture/fence src/modules/sessions/__tests__/audio-intervals.db.test.ts` | `.locks/db-migrate.lock` | green apart from the baseline; these files drive the fake worker whose HELLO word and STOP behaviour changed (section 1, R63-01 / Q7), and the supervisor now ends a worker for telemetry outside the plan |
| `npm test -w apps/core-server` (once per commit, the controller's) | - | the baseline + the one F-M4 attribution above |
