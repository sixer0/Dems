# DEMS capture worker

Back to the [repository README](../../README.md).

A small C program against the installed FFmpeg libraries (9.0.2), started and supervised by the
Core (`apps/core-server/src/capture`). It records one camera file per camera of the plan — up to
FOUR (D60, 2026-11-04: `VIDEO-01`..`VIDEO-04` at once, was two) — from RTSP ingests on
`127.0.0.1`, with the audio of each camera's paired microphone (see the correction below; the
"one audio track" of the first version is retired). The commands in this file run from the
repository root and install nothing; on the bench host the built worker and its stamp are
installed by the deploy procedure (section **Production notes** below).

Correction (2026-11-06, branch `audit/fix-20261105`, decisions D5, D117, D132): the worker is now
`capture-worker/0.8.0` on capture protocol 6. It no longer writes one shared audio track: each camera
VIDEO-0N carries the audio of its paired microphone MIC-0N, each microphone is also written to its own
file `MIC-0N.m4a` (track AUDIO-0N), and a camera whose paired microphone is missing gets a silent audio
track (`micMissing` in the plan). MIC-01 alone feeds the transcription tap. On the bench host the worker
is built against `/opt/dems/ffmpeg-9.0.2` (`PKG_CONFIG_PATH=/opt/dems/ffmpeg-9.0.2/lib/pkgconfig`).

## How it talks to the rest of DEMS

- **To the Core: capture protocol 6.** The Core starts the worker as a child process and they
  exchange one JSON object per line: commands on the worker's standard input, frames (`HELLO`,
  `HEARTBEAT`, `ACK`, `WARNING`, `RECORD`, `CRASH`, `TELEMETRY`) on its standard output, and
  nothing else ever on standard output (`src/ipc.c`). The shared contract is
  `packages/capture-protocol` (`@dems/capture-protocol`, `CAPTURE_PROTOCOL_VERSION = 6`, the same
  number as in `src/worker.h`). A Core and a worker of different protocol numbers refuse each
  other at `HELLO`. The worker's log is a JSON-lines file named by `--log`; standard error is not used.
- **From the cameras: RTSP ingest on loopback.** The worker listens on `127.0.0.1` TCP ports in
  8554-8564; each camera's relay (`build/capture-relay`, below) pulls the camera and pushes it there.
  On the bench host the nftables rule of `dems-loopback-rule.service` lets only the Core's service
  user connect to those ports.
- **Microphones** arrive as PCM inputs from the audio helper, which the Core starts through the
  guard (`build/capture-guard`, below).

## Folder layout

| Folder | Content |
|---|---|
| `src/` | the worker (static rules: `check.sh`): `capture_worker.c` (entry, plan, threads), `ipc.c` (protocol frames and the bounded log), `ingest.c` (RTSP ingest per camera), `audio.c` (filtering thread, one AAC encoder per paired microphone), `sink.c` (the fMP4 writer), `anchor.c` / `anchor.h` (video anchoring arithmetic), `micwatch.c` / `micwatch.h` (microphone warnings), `announce.c` / `announce.h` (the announce gate of an ingest), `worker.h` (version word and protocol number) |
| `src/relay/` | the capture relay (`relay.c`, `relay_core.c`, `relay_rtsp.c`, `relay.h`; static rules: `relay-check.sh`) |
| `src/guard/` | the capture guard (`guard.c`) |
| `test/` | unit checks (`anchor_test.c`, `sink_kill_test.c`), the end-to-end harness `m3worker.py`, the series runner `e2e.py`, planted lines of the static self-test |
| `test-fixtures/` | the NM-14 fixture set: `fake_cam.c`, `fake_mic.c`, the analysers `av_analyse.py`, and `negative-control/skeleton111.c` (a vendored old worker that the socket check must fail on) |
| `build/` | every binary (git-ignored) |

The fake ONVIF camera for the discovery and connection-test rows is TypeScript and lives where the
Node tests import it: `apps/core-server/test/support/fake-onvif-stub.ts`.

## Requirements and setup

- A C compiler, `make`, `pkg-config`, `python3` (test runners).
- FFmpeg 9.0.2 with its `pkg-config` files: the worker links `libavformat`, `libavcodec`,
  `libavfilter`, `libswresample` and `libavutil` (`LIBS_PC` in the `Makefile`). On the bench host the
  build lives at `/opt/dems/ffmpeg-9.0.2`; point `pkg-config` at it:

  ```
  PKG_CONFIG_PATH=/opt/dems/ffmpeg-9.0.2/lib/pkgconfig make -C apps/capture-worker
  ```

  On the development Mac the Homebrew FFmpeg 9.0.2 is found without the variable.
- `make versions` prints the library versions and directory that a build links.

## Make targets

```
make -C apps/capture-worker            static rules + their self-test + unit checks + build/capture-worker
                                       (+ its stamp) + the relay + the guard  (also: npm run test:capture-worker)
make -C apps/capture-worker check      the worker's static rules (check.sh)
make -C apps/capture-worker selftest   the self-test of the static rules
make -C apps/capture-worker unit       the unit checks
make -C apps/capture-worker relay      relay-check, relay-unit, relay-asan, relay-fuzz and build/capture-relay
make -C apps/capture-worker guard      build/capture-guard and its tests
make -C apps/capture-worker proof      the proof builds (negative controls; never started by the Core)
make -C apps/capture-worker fixtures   fake camera, fake mics, the vendored skeleton
make -C apps/capture-worker versions   the FFmpeg libraries this build links
make -C apps/capture-worker e2e        the end-to-end series, about 35 minutes (also: npm run test:capture-worker-e2e)
make -C apps/capture-worker clean      removes build/
```

The relay targets `relay-check`, `relay-unit`, `relay-asan`, `relay-fuzz` and `relay-fuzz-controls`
are described in the relay section below.

## Configuration

The worker, the relay and the guard read **no environment variables**. The worker takes its
settings as command-line arguments and the start message from the Core; the relay reads one start
line on standard input. What is configured is on the Core's side, in its environment file
(template: [`deploy/bench-config/core.env.example`](../../deploy/bench-config/core.env.example)):

| Core variable | What it names |
|---|---|
| `DEMS_CAPTURE_MODE` | `real` to start the worker at all (`simulated` starts none) |
| `DEMS_CAPTURE_WORKER` | absolute path of `capture-worker` |
| `DEMS_CAPTURE_RELAY` | absolute path of `capture-relay` |
| `DEMS_CAPTURE_GUARD` | absolute path of `capture-guard` |
| `DEMS_CAPTURE_AUDIO_HELPER` | absolute path of the audio helper the guard starts |
| `DEMS_MEDIA_DIR` | the media root the worker writes camera files into |

## Production notes

- The worker runs as a child of the Core (systemd unit `dems-core`), never as a unit of its own.
- Install the binary and its stamp together: binary 0755, stamp `capture-worker.stamp` 0644, both
  root-owned. At boot the Core checks that the stamp names this binary's sha256, the source it was
  built from, the worker version and the protocol; a mismatch is refused (`CAPTURE_WORKER_BUILD_STAMP_STALE`,
  `CAPTURE_WORKER_VERSION_MISMATCH`, `CAPTURE_WORKER_PROTOCOL_MISMATCH`). A healthy REAL_PRODUCTION boot logs one
  `CAPTURE_BOOT_CHECKS_PASSED` line naming `capture-worker/0.8.0`.
- Rebuild on the host only when `apps/capture-worker` changed: `make clean`, then
  `PKG_CONFIG_PATH=/opt/dems/ffmpeg-9.0.2/lib/pkgconfig make check selftest unit build/capture-worker relay-check`
  under the heavy-host lock (root README, section **Deploy procedure (short)**).
- The gated end-to-end D5 tests cannot pass on the bench host: its loopback rule refuses pushers
  started as a normal user (decisions D150, D153).
- Unit files and the loopback rule: [`deploy/bench-config/README.md`](../../deploy/bench-config/README.md).

## How to run the capture e2e

```
make -C apps/capture-worker e2e
```

One target, one exit code. It builds everything above, then runs the whole series of checks on the
fixtures: every check twice and every negative control twice.

| Exit code | Meaning |
|--:|---|
| 0 | every verdict is the expected one: each check PASS, each negative control FAIL on the criteria it is meant to fail on |
| 1 | at least one verdict is not the expected one, a check crashed, timed out or printed no result, or a listener was left on the two ports |
| 2 | the series could not run: the build failed, or no two free ports in 8554-8564 |
| 75 | the heavy-host lock could not be taken within 30 minutes; nothing was run |

What you need to know before you run it:

- **Sandbox off.** It binds two TCP ports on `127.0.0.1` (the first two free ones of 8555, 8557,
  8559-8564; 8554 / 8556 / 8558 belong to the Android emulators and are never used) and reads the
  process and socket tables (`ps`, `lsof`). Inside the Bash sandbox both fail with EPERM.
- **It takes the heavy-host lock.** One heavy job runs on this host at a time: the target
  re-starts itself under `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock` (repository root,
  git-ignored) and holds it until the series ends. The STT / diarization engine runs take the same
  lock, so neither can start inside the other. It waits up to 30 minutes for the lock and exits
  **75** if it cannot be had (nothing was run). Only a caller that already holds the lock opts
  out: `make -C apps/capture-worker e2e E2E_NO_LOCK=1`. A single check by hand is wrapped the same
  way (last section).
- **About 35 minutes** on an idle host. Before each timing-sensitive check the runner waits while
  the 1-minute load is above 8 or a `whisper-cli` / `omlx` process is alive (up to 15 minutes per
  check), and writes the load at the start of every check into the summary.
- **Not part of `npm test`.** It needs ports, FFmpeg and real time; under the parallel JS suites
  its timing checks would be noise. Run it at a gate.
- **Run it again after any FFmpeg upgrade.** The refusal of a non-TCP transport, the mux flags and
  the fixtures all rest on what libavformat does; `make versions` prints what is linked.
- **Results** land in `.cache/m3worker/e2e/<tag>/` (git-ignored): `summary.txt` (one line per
  check with its numbers, and `AGGREGATE EXIT CODE n` as the last line), `summary.json`, and one
  `<check>.out` with the full result of each check. Media of the runs is under
  `.cache/m3worker/runs/`. No media file is ever written inside the tracked tree.

Options go through `E2E_ARGS`:

```
make -C apps/capture-worker e2e E2E_ARGS="--list"                    the series; nothing is run
make -C apps/capture-worker e2e E2E_ARGS="--only 'av1_|neg_av'"      a subset (regular expression on the names)
make -C apps/capture-worker e2e E2E_ARGS="--ports 8559,8561"         a chosen port pair
make -C apps/capture-worker e2e E2E_ARGS="--runs 1 --tag quick"      one run of each instead of two
```

### What the series checks

| Catalogue check | Checks of the series | Negative control (must FAIL) |
|---|---|---|
| M3-AV-1: 0 / +80 / -80 ms through the worker, each camera against its own paired microphone (D5 pairs; the mic switch is retired, row 152b); the 2 ms regression bound and the +-40 ms product bound are two separate criteria | `av1_zero_tap`, `av1_av2a_pm80` | `neg_av_forbidden_mux_option` (one forbidden mux option: fails both bounds, by seconds, while the files still decode); `neg_av_mic_latency_5ms` (the mics hand over 5 ms late: fails the regression bound and stays inside the product bound) |
| M3-AV-2 (a): cameras in their own processes on their own clocks, mics in another process, +-80 ms; also through the production supervisor | `av1_av2a_pm80`, `sup_av2_pm80` | `neg_av_forbidden_mux_option`, `neg_sup_av_judged_as_no_offset` (the AV judgement of the session recorded through the supervisor). Correction (2026-10-10): the control `neg_sup_forbidden_mux_option` named here before is retired. The supervisor refuses a proof build by design (`CAPTURE_WORKER_PROOF_BUILD`), so a forbidden mux option can no longer be started through it. In its place: `sup_refuses_proof_build` (the proof build through the supervisor is refused with that code and nothing is recorded) with its control `neg_sup_release_worker_is_accepted`; the forbidden option itself stays covered by the direct-driver control and the static rule (decision D170) |
| M3-AV-2 (b): +-200 ppm keeps the injected slope | `av2b_drift_200ppm` | `neg_av2b_drift_judged_as_none` (the same files judged as if nothing drifted) |
| M3-AV-2 (c): drift expressed in the sender reports | not here: blueprint row 62 builds that camera | - |
| M3-RTSP-BIND-1: every socket of the worker is TCP on 127.0.0.1 while a client asks for UDP; listener snapshot of worker and fixtures | `bind_udp`, criteria `listeners_are_the_two_loopback_ports` and `fixture_and_worker_sockets_loopback_only` of every session | `neg_bind_skeleton` (the vendored row-111 worker opens `UDP *:5000` / `*:5001`) |
| Mic on its own sample clock, stop and return | `mic_100ppm_fast`, `mic_100ppm_slow` (2 ms), `mic_2000ppm_slow` (5 ms), `mic_stop_and_return` (15 ms after the return) | `neg_mic_no_compensation` |
| Continuity (AU2-05), judged on decoded samples, per pair (VIDEO-01 with MIC-01's beeps; VIDEO-02 with MIC-02's beeps and its 880 Hz tone's phase) | `continuity` | `neg_continuity_cut`, `neg_continuity_toneslip` |
| Long-GOP camera (`--gop 250`): a fixture check. It reports what the worker says about the observed keyframe interval (today: nothing); the writer's rule is blueprint row 59's | `longgop_250` | `neg_gop50_judged_as_250` |
| Row-58 regressions: protocol, files that grow, one encoder in both files (H-4), camera stops, fatal error, never overwrite, kill before / after the first fragment through the supervisor, no camera, an ingest that never ends | `proto`, `wi1_*`, `optc_*`, `kc1`, `kc3`, `nocam_*`, `sup_nocam`, `f2_norefusal`, `p4_*` | `neg_h4_reencoded`, `neg_kc3_no_restart_allowed`, `neg_p4_stall_delay_moov` |
| The harness itself: leftovers are judged on the processes the run started | `harness_leftover_scope` | inside the check: a process of another run is not reported, an own one is |
| The announce gate of an ingest (task 4 row 142; BR-09 of `docs/2026-10-12_input_av_core_adapter_plan/verification/05_security_branch_b.md`): with a live session-shaped address in force (128 random bits, new per run), a push to each of the seven near-miss addresses, a foreign camera's line, a second `ANNOUNCE`, and the announce line absent are refused - no `ingest_connected`, 0 bytes, the log code and the frame member of the case (`CAMERA_ANNOUNCE_NOT_MATCHED` / `CAMERA_ANNOUNCE_NOT_SEEN`) and never the other - while the other camera of the same session records; the right address is accepted on both cameras at once; a wrong-path client reads no part of the address; 0 path text in the worker's log, output and frames. Once each (`test-fixtures/br09_gate.py`) | `br09_right_path_both_cameras_each_its_own_line`, `br09_near_miss_<kind>` (7), `br09_foreign_line_on_camera_1` / `_2`, `br09_announce_line_absent_refused` (proof build `capture-worker-noannounce`), `br09_second_announce_same_address` / `_other_address`, `br09_wrong_path_client_reads_no_secret` | `neg_br09_right_path_judged_as_a_near_miss` (the right address, judged as a refusal: it records), `neg_br09_line_absent_judged_on_the_release_worker` (both cameras record), `neg_br09_single_announce_judged_as_a_second` (one announce passes the gate); the search of the oracle check has its control inside the check |

### The fMP4 writer (blueprint row 59)

`src/sink.c` is the writer of a camera file; its header states the rules (append-only, one whole
fragment at a time, the two hash chains, the sync policy and the durability point, truncation
after a failed write). What checks it:

| What | Check | Negative control (must FAIL) |
|---|---|---|
| Chains re-derived from the file with another SHA-256, two runs equal, failed and short writes, the cipher seam | `make unit`: `test/writer_test.c` | the same test built with the truncation switched off |
| The log quota is counted per source | `make unit`: `test/log_test.c` | the same test built with one shared quota |
| M3-WI-1: running hash == closed-file re-hash, checkpoints contiguous, the Core's tail validation, observed keyframe interval | criteria of every `session` check of the series (`writer_criteria` in `m3worker.py`) | - |
| M3-KC-2: SIGKILL mid-write; a cut inside an `mdat` that ffprobe accepts is flagged by the tail validation; a `.part` hard link is a second name | `kc2_sigkill_tail_validation` | `neg_kc2_file_not_cut` |
| M3-KC-4: long-GOP loss bounded by one fragment and reported | `kc4_longgop_loss_reported` | `neg_kc4_camera_inside_the_bound` |
| A write that comes back short goes back to the last good length | `writer_short_write_truncates` (proof build `capture-worker-writefault`) | `neg_writer_no_truncation` (`capture-worker-writefault-notrunc`) |
| Chain equality: the same bytes through the writer again | `chain_replay_same_bytes` (`build/writer_replay`) | `neg_chain_replay_one_byte_changed` |
| M3-MG-1: 0 media in git | `mg1_no_media_in_git` | its control is inside the check |

`test/tail_check.ts` runs the Core's `validateCameraFile` (`apps/core-server/src/capture/fragments.ts`)
on one file: `npx tsx apps/capture-worker/test/tail_check.ts <file> [--records <checkpoints.json>]`.
A subset run that ENDS on a check which kills the worker (`kc2`, `kc4`) reports the two ports as
"still listening" for about half a minute (the kernel holds the closed sockets); the whole series
does not end on one.

### Proving that the exit code can be non-zero

```
python3 apps/capture-worker/test/e2e.py --prove-aggregate .cache/m3worker/e2e/<tag>
```
re-reads a finished series, flips each recorded verdict in turn and requires a non-zero aggregate
every time (it runs nothing). For a real failure in a scratch run, give one check a defect:

```
make -C apps/capture-worker e2e E2E_ARGS="--tag scratch --only 'av1_av2a_pm80_r1' --runs 1 --append 'av1_av2a_pm80_r1=--variant negctl'"
```
(the check is run on the build with the forbidden mux option, reports FAIL, and the target exits 1).
`--flip NAME` treats the verdict of one check as its opposite without changing what is run.

### One check by hand

```
python3 apps/capture-worker/test/m3worker.py build
M3_PORTS=8559,8561 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
  python3 apps/capture-worker/test/m3worker.py session my_run --case pm80
```
Every check prints one JSON result with `verdict` and `criteria`. A negative control is run with
`--expect-fail --must-fail-on <criteria>`: it exits 0 only when it fails on exactly those.

## State at commit `f293221` (added 2026-10-10)

- The worker names itself `capture-worker/0.6.0` (`src/worker.h`; 0.5.0 at that commit, raised once by task 4 row 177 for the branch-B change set: the gate on the announced address, its two refusal codes, the per-camera end of a push without a picture) and speaks capture protocol 4. The Core starts only a release build of that form and refuses a proof build, another protocol version and a worker whose libavformat is not the one it was built and checked against (`CAPTURE_WORKER_MEDIA_LIBRARY_MISMATCH`).
- Checks added by the review fixes, in the series of `test/e2e.py`: `r63_02_fragment_size_bound` (control `neg_r63_02_no_size_bound`), `r63_12_clock_floor_wiring` (control `neg_r63_12_floor_not_acted_on`), `r63_11_moved_timestamp_is_said`. The Core passes the fragment size bound to the worker at every start (`--max-fragment-bytes`); the worker closes an open fragment at the bound and says so once per camera.
- The whole series ran once on the final worker on 2026-10-10: 122 checks, every one as expected, aggregate exit code 0 (decision D188 of `docs/2026-10-07_dems_real_capture_sealing/decisions/decisions.md`).
- Task 4 row 142 (2026-10-13) added 17 checks to the series (139 in all): the announce gate, table above. They were run by themselves (`E2E_ARGS="--only 'br09' --runs 1"`); the whole series on the worker with the gate is task 4 row 59. `check.sh` holds the gate in its place (rule BR-01: one open, one probe, the gate's test between them, no preprocessor line or jump around it; BR-03; BR-04: no `av_log_set_level`), with 7 planted lines and 6 mutations in its self-test.
- Task 4 row 178 (2026-10-13) added 21 checks (160 in all), the concurrency and leak cases of the gate, in `test-fixtures/br09_gate.py`: right and wrong pushed at the same instant with the wrong path on camera 1 and on camera 2, three times each; a raw wrong-path client whose first request is each of the eleven RTSP methods, every answered byte searched for the session's addresses; row 176's client without media on the right path (that camera ends as its own fault, the other camera's file is complete); two negative controls. Run by themselves: `E2E_ARGS="--only 'br09b' --runs 1"`. `check.sh` rule BR-04 also holds the words of a refusal (each log code and frame member a literal of one line; no frame reason from a text), with 4 planted lines and 3 mutations more.
- Task 4 rows N1 + N3 (2026-10-14; design `docs/2026-10-12_input_av_core_adapter_plan/masterplan/06_design_macos_microphone.md` revision 3, sections 7.2a and 8.2): **capture protocol 5** (`CAPTURE_PROTOCOL_VERSION` in `src/worker.h` and in `@dems/capture-protocol`, one change set; the worker's version word stays `capture-worker/0.6.0`). A Core of protocol 4 refuses this worker at `HELLO`, and the other way round.
  - A second microphone input kind, `PCM_FIFO_GAPPED`: the same bytes as `PCM_FIFO` (32-bit float, mono, 48,000 Hz) from a writer that does NOT promise every sample - the bench form of the macOS microphone path, which loses about one packet of 512 in ten. For such a microphone the worker makes no resampler and asks for no compensation (what it reads is copied, value for value), runs no rate controller (`ratePpm` is always null, `MIC_RATE_AT_LIMIT` cannot arise), inserts zeros where its buffer runs empty as it does for every microphone, and ACCOUNTS FOR EVERY SAMPLE from sample 0 of the timeline: the record `MIC_SAMPLE_ACCOUNT` every 60 s of the timeline and once more, closing, before `AUDIO_TIMELINE_END` (`timelineSamples = receivedSamples - discardedSamples - bufferedSamples + insertedSamples`, checked by the worker before it writes; an account that does not add up is not written and an error goes to the log), and one `AUDIO_INSERTED_RUN` per run of inserted silence of 4,800 samples (100 ms) or more on the track, with its first sample (the first 1,024 runs; the rest are counted in the account). `PCM_FIFO` is not changed: its every line is the line it was.
  - Every `TELEMETRY` level, of every kind, carries `timelineSamples`, `receivedSamples`, `insertedSamples` and `nonZero`.
  - `check.sh` rule N3-GAP: one place sets the flag (the plan reader), a closed set of functions reads it, the kind words are literals of the plan reader only, the resampler's five calls stand where a gapped microphone cannot reach them (8 planted lines and 6 mutations in the self-test).
  - Eleven checks joined the series (171 in all): `n3_gapped_<mode>` for ten modes of the stand-in `test/gapped_mic.c` (the measured pattern with a switch between two gapped microphones; a whole pipe beside a `PCM_FIFO` one; a writer that starts 4 s late; a standby that began before sample 0; a 3 s stop; a sample that is not a number with device IDs of 128 characters; 1,025 stops; the worker killed before, between and after its accounts), judged in `test/n3gapped.py` against the PCM tap and the stand-in's own manifest - every inserted zero, every run and every copied sample to the sample - and the control `neg_n3_one_tap_sample_removed`. Run by themselves: `E2E_ARGS="--only 'n3_' --runs 1"` (about 8 minutes).
  - The `m5_gap_analyser` failure of row A1 (17 samples) is not a miscount: one late delivery of the fixture writer under load inserted 17 zeros, which the worker counted (`missing` 17) and the analyser measured; reproduced on purpose (`docs/.../implementation/n13_worker_gapped_kind.md`).
- Audit 2026-11-05 row 87 (defect DF-02): the worker names itself **`capture-worker/0.7.0`**; the protocol stays 5. Every link of `build/capture-worker` writes **`build/capture-worker.stamp`** beside it (`stamp.sh`; `make build/capture-worker.stamp` writes a deleted one again): four ASCII lines `workerVersion=`, `protocolVersion=`, `sourceSha256=` (the sha256 of the listing `sha256sum $(SRC) $(HDR) Makefile`, run in this folder, in the Makefile's order) and `binarySha256=` (the sha256 of the program). Install the stamp with the program (0644 beside the 0755 binary); the Core's boot check (audit row 88) refuses a program without a stamp that matches it (`CAPTURE_WORKER_BUILD_STAMP_STALE`).
- Audit 2026-11-06 row 152b (N-31; decisions D135, D136): the operator's switch is RETIRED in the worker too. `SWITCH_AUDIO_SOURCE` is no command of the protocol any more (the worker ends on such a line with `PROTOCOL_VIOLATION`, a case of `proto`); the selector lane feeds only the MIC-01 transcription tap, set at START and never moved; `make check` rule AU2-07 now holds the graph command at ZERO call sites; the proof build `capture-worker-intervalskew` is gone. The switch-era checks follow the D5 pairs: `av1_zero_switch_tap` is `av1_zero_tap` (no `--switch`); the fake microphones put the reference beeps on every paired channel (`fake_mic --beep-on`, so the flash-to-beep check of camera 2 reads MIC-02's beeps); `continuity` is judged per pair; `m5_switch_bound_intervals` became `m5_tap_one_interval` (one start interval, the tap is channel 1 throughout; control `neg_m5_tap_judged_as_channel_2`); `m5_gap_analyser`, `neg_m5_gap_1000_removed_at_the_switch`, `neg_m5_switch_bound_judged_at_1us` and `neg_m5_interval_record_skewed` judged the removed switch and are gone; `n3_gapped_measured` runs without a switch (criterion `one_start_interval_mic01`).
- What the series does not prove: a power loss, a volume that really runs out of space, a volume without hard links, a real camera, a real microphone. The fragment bound was proven at a small bound, not at the product's bound. A camera more than 2 s behind the Core's clock is given up by name, and up to 1 s of its video may be wrongly timed before that. The operator-facing list is in the repository `README.md`, section "Real capture, sealing and transcript", "Known limits".

## The capture relay (`build/capture-relay`, added 2026-10-13, task 4 row 41)

A second, separate program in this folder: `src/relay/` (three C files, one header), built by `make relay` (part of `make`). The Core starts one per camera of a session attempt through its production process door. It reads one line from standard input (the start message), pulls the camera over RTSP on one TCP connection with a client of its own, answers a Digest challenge only, takes the video unchanged and pushes it to this worker's loopback ingest, announcing the address of the start message once. It takes no argument, reads no environment variable, writes report lines of fixed shape to standard output (rows 42 and 43, below) and only fixed words and numbers to standard error, and ends when its standard input ends. Record mode and probe mode; the re-open of the camera leg is row 43, below.

- The two programs have opposite socket rules and are kept apart: `check.sh` reads `src/*.c` and `src/*.h` (the worker, which listens on loopback and never dials out); `relay-check.sh` reads `src/relay/` (the relay, which dials the camera and the ingest and never listens). `Makefile` names the two source lists apart; the relay links `libavformat`, `libavcodec` and `libavutil` only and includes no header of the worker.
- `make relay-check` runs the relay's static rules and their self-test; `make relay-unit` the pure part (`test/relay_unit_test.c`); the adapter-level run on the test camera and the release worker is `test-fixtures/row041_relay.py` (sandbox off, heavy-host lock; its header has the command).
- Exit codes and the start message: `src/relay/relay.h`. Record: `docs/2026-10-12_input_av_core_adapter_plan/implementation/041_relay_record_mode.md`.
- Hardening (added 2026-10-13, task 4 row 186; the relay's own RTSP client is a CANDIDATE, decisions C38 and C39). Part of every `make`: `make relay-asan` (the unit checks with AddressSanitizer and UndefinedBehaviorSanitizer: the 34 named malformed-input cases of the security review, the real camera leg on a socket pair, three negative controls) and `make relay-fuzz` (`test/relay_fuzz.c`: seven entry points and a seeded mutation driver of its own, 2 s per entry point; longer: `make relay-fuzz RELAY_FUZZ_SECONDS=40`). Not part of `make`: `make relay-fuzz-controls` (16 copies of the sources with one bound removed each; the fuzz build must find every one, about 2 minutes) and `test-fixtures/row186_bounds.py` (the time bounds measured against a camera that trickles or floods: sandbox off, heavy-host lock; its header has the command). The release build of the relay carries `-D_FORTIFY_SOURCE=2 -fstack-protector-strong -fPIE`, held on the binary by `relay-check.sh --imports`. The test camera's hostile modes: `rtsp_test_camera.py --adversary <mode>` (its header lists them). Record: `docs/2026-10-12_input_av_core_adapter_plan/implementation/186_relay_client_hardening.md`.

- Probe mode and the report line (added 2026-10-13, task 4 row 42). The start message names a mode: `"mode":"record"` (members `type`, `mode`, `ingest`, `access`) or `"mode":"probe"` (members `type`, `mode`, `access`: a probe is given no ingest address); both may carry `"attempt":<1 to 999999999>`. Standard output carries at most ONE line. Record mode: `{"report":"push_established","v":1,"attempt":<n>}` once the worker answered the record request with success (the relay's half of the pairing; whether the worker's gate then took the push is the worker's own word). Probe mode: the camera is opened exactly as for a recording (the same client, Digest only), and at the first keyframe the relay writes `{"report":"probe","v":1,"attempt":<n>,"codec":"H264"|"HEVC","width":<n>,"height":<n>,"rate_milli":<n>,"sets_in_description":true|false,"sets_in_stream":true|false,"vps":"<hex>","sps":"<hex>","pps":"<hex>"}` and ends with code 0 without pushing (`rate_milli` 0: the description states no rate; exit 0 without a line: stopped before the answer). A line is at most 6,400 bytes (`RELAY_REPORT_MAX`), of a fixed character set, and holds no address, path, account or text of the camera; a line that cannot be written within 5 s ends the relay with code 43 `REPORT_NOT_WRITTEN`. The lines are made in `src/relay/relay_core.c`; `relay-check.sh` holds the one writer and its two callers; unit rows and the fuzz entry `report` cover them. Adapter-level runs: `test-fixtures/row042_probe.py` (sandbox off, heavy-host lock; its header has the command). Record: `docs/2026-10-12_input_av_core_adapter_plan/implementation/042_relay_probe_mode.md`.
- The re-open (added 2026-10-13, task 4 row 43). Once the push stands, the end of the camera leg (closed, stalled, not reachable) no longer ends the relay: it keeps its ONE connection to the worker and opens the camera again after 2, 2, 4, 8, 16, 30 s (6 tries per loss; the tries used up: it ends with the code of its last try). Nothing is forwarded after a re-open before the parameter sets and a keyframe of the new leg are held, and the stream must be the announced one (else `STREAM_INVALID`). The second refused Digest answer ends it (`AUTH_REFUSED`); a missing stream path ends it at once (`LOCATOR_NOT_FOUND`). Standard output gains one line per loss and one per re-open, numbers only: `{"report":"camera_lost","v":1,"attempt":<n>,"loss":<k>,"cause":<exit code number>}` and `{"report":"camera_reopened","v":1,"attempt":<n>,"loss":<k>,"tries":<1..6>,"held_back":<n>,"gap_ms":<n>}`. No exit code was added. Runs: `test-fixtures/row043_reopen.py` (its negative control is a relay whose gate opens at any picture after a re-open: the file then decodes without a message and holds pictures the camera never encoded). Record: `docs/2026-10-12_input_av_core_adapter_plan/implementation/043_relay_reconnect_gating.md`.
- Confinement (added 2026-10-13, task 4 row 153). `relay-check.sh` holds the one connect to the locator's host and port, every request to an address held to them, the relay's own socket rule at every leg, and the limits (core file 0, file size 0; on Linux not dumpable, no new privileges) before the first byte; `test-fixtures/row153_confinement.py` reads the relay's sockets and open files from the system's tables during a session with a re-open. The Linux confinement (system-call filter, unit hardening) is described in `docs/2026-10-12_input_av_core_adapter_plan/implementation/153_relay_confinement.md` and is not built here.
- Erratum of 2026-10-13 (rule RC-6; decision C65; review finding F3-04). The original sentence, `relay-check.sh:42` as committed in `3b388746`: "the relay binds nothing" (and, above in this file, the relay "dials the camera and the ingest and never listens"). The rule as it now stands: the relay still never listens, accepts, opens a datagram socket or resolves a name, and it binds exactly ONCE - its one camera socket, in `src/relay/relay_rtsp.c`, on one pinned line, to the source address of the start message and port 0, before the one connect and at every re-open; a failed bind ends the dial; record mode is refused without the address (script lines tagged `S13-11`; `bind` left the forbidden list of the import net, `listen` / `accept` / `accept4` stay in it). The full erratum, with the definition's own text, is section 12 of `docs/2026-10-12_input_av_core_adapter_plan/verification/06_security_relay_client.md`. The script's logic is not changed by this paragraph.

## The capture guard (`build/capture-guard`, added 2026-10-13, task 4 row 23)

A third, separate program: one source file, `src/guard/guard.c`, built and checked by `make guard` (part of `make`). The Core's production process door starts it in the place of a helper that cannot be trusted to end by itself (the FFmpeg audio helper: experiment E-7 showed it does not end when its standard input ends and survives a SIGKILL of its parent); the configuration key `DEMS_CAPTURE_GUARD` names the binary.

```
capture-guard <absolute path of the program> [its arguments ...]
```

- It starts ONE child with `execve`: no shell, no search path, the argument vector and the environment handed on unchanged, a core-file limit of 0.
- It ends the child (SIGTERM, a SIGKILL after 2 s) when its own standard input ends, when its parent is no longer the process that started it, or on SIGTERM; it reaps the child and passes its exit on (the child's status, or 128 + the signal's number). Its own codes: 120 usage, 121 core-file limit, 122 standard input is no pipe or socket, 123 not started, 126 not executed.
- A start message never passes through it: the child inherits the guard's standard input, the guard never reads it (it asks only whether it is at its end) and writes nothing to any descriptor. Held on the source and on the binary's imports by `test/guard_test.py`.
- `python3 test/guard_test.py all` (from this folder): static rules with 20 controls, the import net, and the behaviour measured on the double `test/guard_double.c`. No port and no worker; about 10 s.
- Not covered on macOS: a SIGKILL of the guard itself. On Linux the child gets the parent-death signal (a compile-time seam in `guard.c`), which no run on this Mac compiles: hardware check 9A/H-02. Record: `docs/2026-10-12_input_av_core_adapter_plan/implementation/023_guard_program.md`.

## Linux (added 2026-10-13, task 4 row 193)

`make -C apps/capture-worker` builds and passes in the Ubuntu 24.04 container of `scripts/host/container/` (clang 18, glibc 2.39, a self-built FFmpeg 9.0.2: the pinned library versions) as it does on this Mac. A container result: it settles nothing for the production host. What is written for both systems:

- The worker's compile line carries `-D_DEFAULT_SOURCE`, as the relay's and the guard's do. On macOS it changes no byte of the worker. Do not put `_POSIX_C_SOURCE` or `_XOPEN_SOURCE` in its place: on macOS they hide `F_FULLFSYNC` and the writer would sync less without saying so (`test/writer_test.c` fails on such a build).
- **The sync level is the platform's, and it is stated.** macOS: `F_FULLFSYNC`, with `FSYNC` as the stated fallback of a volume that refuses it. Linux has no such call: every camera file states `FSYNC`, never the other word, and the Core writes each such file to its persistent log (`apps/core-server/src/capture/index.ts`). What `fsync()` is worth on the evidence disk of the real host is hardware check `9A/H-03`; nothing here decides it. `writer_test.c` names the expected level per platform itself; on Linux its negative control (`-DDEMS_PROOF_SILENT_SYNC_FALLBACK`) fails on 2 checks (no level may be stated before a sync), on macOS on 4.
- The import net (`test/static/pinned_calls.py --imports`) reads the binary by its own object format. On ELF it cuts the symbol version and reads a function under its other linker names of glibc as well (`open64`, `__open_2`, `__open`). The calls Linux alone offers are in the watched list since task 4 row 141 (decision C89, which closes C51 (3)): `renameat2`, `memfd_create`, `open_by_handle_at`, `fallocate`, `execveat`, `fexecve`, `execvpe`, `pidfd_spawn`, `pidfd_spawnp`, `clone`, `_Fork`, `dlmopen` - the list `LINUX_ONLY` of `test/static/pinned_calls.py`, 12 names, 72 watched in all; none is an allowed function. Still outside the net, each with its reason in that file: `openat2`, `clone3` and `memfd_secret` (no function in glibc 2.39; reached through `syscall`, which is watched), `name_to_handle_at`, `copy_file_range`, `splice`, `posix_fallocate`. Record: `docs/2026-10-12_input_av_core_adapter_plan/test/141_container_e11_relay_state.md`, section 8.
- Not built or run on Linux yet: `make fixtures` (three compile lines without the macro), the fixture runs and `make e2e` (they need `lsof`, an H.264 encoder and `ffmpeg` on the search path). Record: `docs/2026-10-12_input_av_core_adapter_plan/implementation/193_worker_linux_build.md`.

## Linked libraries and their licence

`make -C apps/capture-worker versions` prints the FFmpeg libraries this build links. The worker links `libavformat`, `libavcodec`, `libavfilter`, `libswresample` and `libavutil` dynamically, through `pkg-config` (`Makefile`, `LIBS_PC`). On this Mac those are the libraries of the Homebrew FFmpeg 9.0.2, which is a GPL-3.0-or-later build. On the bench host they are the FFmpeg 9.0.2 build under `/opt/dems/ffmpeg-9.0.2` (added 2026-11-06). The record of that fact, and of what is and is not established for a distributed worker, is `THIRD_PARTY_NOTICES.md` at the repository root, section "Component register of the real-capture task", part 1. The binaries under `build/` are git-ignored and are in no package.
