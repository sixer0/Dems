# DEMS capture worker

A small C program against the installed FFmpeg libraries (9.0.2), started and supervised by the
Core (`apps/core-server/src/capture`). It records two camera files from RTSP ingests on
`127.0.0.1` and one audio track from the microphone inputs. Everything here runs from the
repository root; nothing is installed.

| Folder | Content |
|---|---|
| `src/` | the worker (static rules: `check.sh`) |
| `test/` | unit checks (`anchor_test.c`, `sink_kill_test.c`), the end-to-end harness `m3worker.py`, the series runner `e2e.py`, planted lines of the static self-test |
| `test-fixtures/` | the NM-14 fixture set: `fake_cam.c`, `fake_mic.c`, the analysers `av_analyse.py`, and `negative-control/skeleton111.c` (a vendored old worker that the socket check must fail on) |
| `build/` | every binary (git-ignored) |

The fake ONVIF camera for the discovery and connection-test rows is TypeScript and lives where the
Node tests import it: `apps/core-server/test/support/fake-onvif-stub.ts`.

```
make -C apps/capture-worker            static rules + their self-test + unit checks + build/capture-worker
make -C apps/capture-worker proof      the proof builds (negative controls; never started by the Core)
make -C apps/capture-worker fixtures   fake camera, fake mics, the vendored skeleton
make -C apps/capture-worker versions   the FFmpeg libraries this build links
```

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
| M3-AV-1: 0 / +80 / -80 ms through the worker, incl. across a mic switch; the 2 ms regression bound and the +-40 ms product bound are two separate criteria | `av1_zero_switch_tap`, `av1_av2a_pm80` | `neg_av_forbidden_mux_option` (one forbidden mux option: fails both bounds, by seconds, while the files still decode); `neg_av_mic_latency_5ms` (the mics hand over 5 ms late: fails the regression bound and stays inside the product bound) |
| M3-AV-2 (a): cameras in their own processes on their own clocks, mics in another process, +-80 ms; also through the production supervisor | `av1_av2a_pm80`, `sup_av2_pm80` | `neg_av_forbidden_mux_option`, `neg_sup_forbidden_mux_option` |
| M3-AV-2 (b): +-200 ppm keeps the injected slope | `av2b_drift_200ppm` | `neg_av2b_drift_judged_as_none` (the same files judged as if nothing drifted) |
| M3-AV-2 (c): drift expressed in the sender reports | not here: blueprint row 62 builds that camera | - |
| M3-RTSP-BIND-1: every socket of the worker is TCP on 127.0.0.1 while a client asks for UDP; listener snapshot of worker and fixtures | `bind_udp`, criteria `listeners_are_the_two_loopback_ports` and `fixture_and_worker_sockets_loopback_only` of every session | `neg_bind_skeleton` (the vendored row-111 worker opens `UDP *:5000` / `*:5001`) |
| Mic on its own sample clock, stop and return | `mic_100ppm_fast`, `mic_100ppm_slow` (2 ms), `mic_2000ppm_slow` (5 ms), `mic_stop_and_return` (15 ms after the return) | `neg_mic_no_compensation` |
| Continuity (AU2-05), judged on decoded samples | `continuity` | `neg_continuity_cut`, `neg_continuity_toneslip` |
| Long-GOP camera (`--gop 250`): a fixture check. It reports what the worker says about the observed keyframe interval (today: nothing); the writer's rule is blueprint row 59's | `longgop_250` | `neg_gop50_judged_as_250` |
| Row-58 regressions: protocol, files that grow, one encoder in both files (H-4), camera stops, fatal error, never overwrite, kill before / after the first fragment through the supervisor, no camera, an ingest that never ends | `proto`, `wi1_*`, `optc_*`, `kc1`, `kc3`, `nocam_*`, `sup_nocam`, `f2_norefusal`, `p4_*` | `neg_h4_reencoded`, `neg_kc3_no_restart_allowed`, `neg_p4_stall_delay_moov` |
| The harness itself: leftovers are judged on the processes the run started | `harness_leftover_scope` | inside the check: a process of another run is not reported, an own one is |

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
