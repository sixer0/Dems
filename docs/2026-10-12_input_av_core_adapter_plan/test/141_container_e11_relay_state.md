---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: 141
package: WP-14 (milestone M5); AD-01 (6), AD-09 (2), BR-10; decision C51 (3)
date: 2026-10-13
agent: test-expert (agent C1)
tier: T2
status: complete - branch B CONFIRMED in the Ubuntu 24.04 container; one finding the samples cannot see (section 6); 6 driver decisions (section 11)
---

# Row 141 - container session 2: the E-11 observations, the announce line, BR-09 and the relay's process state on Linux

EVERY RESULT BELOW IS A CONTAINER RESULT: Ubuntu 24.04.5 user space, arm64, glibc 2.39, clang 18.1.3, the self-built FFmpeg 9.0.2 of the image (libavformat 63.1.102), on the kernel of this Mac's virtual machine (6.8.0-117). None settles an item for the production host. No real camera, no credential, no network: the containers ran with `--network none`, so the only address is the container's own loopback.

## 1. Verdict

**Branch B is CONFIRMED on Linux, in the container. Nothing differs that bears on the selection.** Both gate conditions of the row are met:

| Gate condition | Result | Evidence |
|---|---|---|
| AD-01 (6): the observations select the same branch as row 8 | **the same row of table 9.1: "O-1 ACCEPTED in any run / O-2 any / E-11b READABLE -> B"**. O-1 ACCEPTED 18, INCONCLUSIVE 3, REFUSED 0 of 21 on the worker of before the gate; E-11b by the letter of AD-01 (5) 12 of 12 | section 3 |
| BR-10: the line `Parsing[<n>]: ANNOUNCE <address> RTSP/1.0` with the same text, level 56 and instant as in `test/007` | **the same text byte for byte (18 of 18), level 56 (18 of 18), inside `avformat_open_input` and before `ANNOUNCE` is answered (18 of 18)** | section 4 |
| BR-10: the BR-09 cases of rows 142 and 178 pass on the worker rebuilt in the container | **38 of 38 as expected, three series**; row 58's gate fixture 12 of 12, three times | section 5 |
| the relay's core-file limit reads 0 and its "no new privileges" state reads set | **`Max core file size 0 / 0` and `NoNewPrivs: 1` in every sample that held a socket (3,203 of 3,203)**; file-size limit `0 / 0` | section 6 |

What stays provisional is not the branch but the platform: the same on the production host's own build is `9A/H-01` (section 9).

## 2. What ran, and on what

| | |
|---|---|
| Image used for every run | `dems/capture-linux-check:ubuntu-24.04-ffmpeg-9.0.2` as built at 14:25 WIB from the tree with this row's build-file change: `bc5b123c5304` (`02_image_build.log`). The image row 193 left (`cdacf98a3f10`) was NOT used: the worker's tree changed since (row 143b: `src/relay/*`) |
| Image at the end | rebuilt once more from the final tree (it differs from the run image by `test/static/pinned_calls.py` only): `b914f7078f7b`; recorded build `VERDICT make -C apps/capture-worker rc=0`, every step rc 0, `relay_unit_test: 982 checks passed`, the same three program hashes as the run image (`18_image_final_recorded.log`) |
| Programs, built IN the container | `capture-worker` 392,768 bytes sha256 `c333df58...8000b2`, names itself `capture-worker/0.6.0`; `capture-relay` 244,312 bytes `335c0217...fb2047`; `capture-guard` 80,976 bytes `2eba60d1...bb26ca`; `make versions` 63.1.102 / 63.1.102 / 12.1.102 / 7.1.102 / 61.1.102, libdir `/opt/dems/ffmpeg-9.0.2/lib` (`03_prep.log`) |
| In the container, beside the image's build | `make fixtures` rc 0 and `make proof` rc 0 (first time on Linux); the probe of `test/007` compiled from its appendix source (sha256 `6ed2cbda...bf7bf1b`, the file of row 7); the worker of commit `b7ed4c60` (section 3) |
| Container | ONE, `dems-c1-row141`, label `dems.agent=c1`, `--init --network none --cap-add SYS_PTRACE`, three bind mounts of `.cache/task4-row141/` and `.cache/task4-row079/` (scripts read-only, results). Every command in it was one `docker exec` under one hold of `.locks/heavy-host.lock`; between holds it slept. Removed at the end; `docker ps -a --filter label=dems.agent=c1`: 0 rows (`20_containers_left.log`) |
| Accounts | the worker series and the probe as the plain account `dems-check`; the relay fixtures as root, because their own `lsof` reading needs it (section 6) |
| Logs | `.cache/task4-row141/NN_*.log` (untracked), named per section |

## 3. The branch-selecting observations (AD-01 (6))

The worker of the tree now HAS the gate, so observation O-1 on it is the gate's own result (section 5). The observation that selects the branch is what the LIBRARY does without the gate. It was therefore repeated twice: with the probe (the library alone), and with the worker of before the gate - commit `b7ed4c60`, the tree row 6 observed, sources unchanged, compiled in the container with that commit's compile line plus the feature-test macro of L-1 (`capture-worker/0.5.0`, sha256 `ea82ed3d...92ede1`, 0 lines of `ingest.c` name the gate, links `/opt/dems/ffmpeg-9.0.2/lib/libavformat.so.63`). DRIVER DECISION 2.

| Observation | macOS (`test/006`, `test/007`) | Container | Same |
|---|---|---|---|
| O-1, seven near misses x 3, worker without the gate | ACCEPTED 18 (six near misses, 3 of 3: four `200`, one `ingest_connected`, bytes in the file), INCONCLUSIVE 3 (trailing slash: `200 200`, closed at `SETUP`), REFUSED 0; controls ACCEPTED 21 of 21 | **ACCEPTED 18** (the same six, 3 of 3: statuses `200 200 200 200`, `ingest_connected=1`, 826,568 to 827,087 bytes), **INCONCLUSIVE 3** (trailing slash: `200 200`, no third status, `ingest_connected=0`, 0 bytes), **REFUSED 0**; controls ACCEPTED 21 of 21 | yes |
| O-2, second client on the right path | INCONCLUSIVE 3 of 3 (TCP connection refused, no status) | INCONCLUSIVE 3 of 3 (`tcp_refused=True`, no status, one `ingest_connected`, the first stream whole) | yes |
| O-3 / O-3s | precondition never met; the listener takes one connection: right path afterwards refused 3 of 3; after one `OPTIONS` the same 3 of 3 | the same: 3 of 3 and `LISTENER_CONSUMED` 3 of 3 | yes |
| E-11b, the letter of AD-01 (5) | 12 of 12 wrong-path runs print a value equal to the wrong path and different from the listener's address; 0 of 12 from the context, options, metadata (`other_places=0`) | **12 of 12** (last character 3 observe + 3 refuse, six other near misses 1 each); `other_places=0` in 18 of 18 | yes |
| The library alone accepts a wrong path | probe `open=ok`, 25 packets, for six near misses; trailing slash `open=failed`, 0 packets | the same: 8 of 8 observe runs `open=ok packets=25`, trailing slash `open=failed packets=0` | yes |
| The probe's refusal at that instant | open failed, 0 packets, 3 of 3; right path accepted 3 of 3 | open failed (-1094995529), 0 packets, `ANNOUNCE` not answered, 3 of 3; right path 25 packets 3 of 3 | yes |

Selection by table 9.1: "ACCEPTED in any run" holds (18 runs), E-11b READABLE by the letter (12 of 12): **row 3, branch B** - the row and the word gate RC-1 used (`gateway_check/008`, section 3). Row 5 (inconclusive runs) names the same branch.

## 4. The announce line on the Linux library (BR-10)

18 probe runs (`04_e11b_probe.log`, facts counted by `c1/probe_facts.sh` in `04b_probe_facts.log`; the raw outputs are under `.cache/task4-row141/out/e11b-probe/`).

| Property | macOS (`test/007`) | Container | Count |
|---|---|---|---|
| Text | `Parsing[61]: ANNOUNCE rtsp://127.0.0.1:8563/e11b/Hs3kP9wQ2nVb7Xc2 RTSP/1.0` | **the same characters**; in every run the message is exactly `Parsing[<n>]: ANNOUNCE <address as sent> RTSP/1.0` with `<n>` the length of the request line (53 to 65 over the seven near misses) | 18 of 18; exactly one such line per run |
| Format string in the binary | `Parsing[%d]: %s` in `libavformat.63.dylib` | `Parsing[%d]: %s`, `Updating control URI to %s`, `WARNING: Path %s differs from expected %s` in `libavformat.so.63` (`strings`) | - |
| Level | 56 | **56** | 18 of 18 |
| Context handed to the callback | the listener's own | the listener's own (`ctx=listener`) | 18 of 18 |
| Instant | inside `avformat_open_input`, before the `200` with `CSeq: 2` is sent | **inside `avformat_open_input`, before `Sending response: RTSP/1.0 200 OK / CSeq: 2`** (or with no answer sent at all, in the refuse runs) | 18 of 18 |
| The other two messages | level 24 `WARNING: Path ... differs from expected ...`; level 32 `Updating control URI to ...` only when the address differs | the same levels; `update_messages=1 differs_messages=2` on a wrong path, 0 and 0 on the right one; 43 against 40 messages at the end of the open | as on macOS |

One difference, of timing and not of order: on Linux the answer to `ANNOUNCE` leaves about 41 ms after the line was read (line at 82.3 ms, answer at 123.6 ms, open returned 124.8 ms in `observe_wrong_last_character_r1`), and the open returned 42 to 47 ms after the line in the 15 runs that were not refused; on macOS the open returned 1.4 to 1.8 ms after the line. The line still comes first in every run, and the stream probe ends 570 ms or more after the open. The gate reads the line during the open, so a later answer changes nothing for it.

The strongest evidence for "the same text" is not the probe but the worker: its gate accepts only a message equal, as a whole and in constant time, to the one it builds itself (`announce.c`), and it accepted every right-path push in the container (section 5).

## 5. BR-09 on the worker rebuilt in the container

| Check | Command (in the container, `dems-check`, `M3_PORTS=8559,8561`) | Result |
|---|---|---|
| Row 58's gate fixture, three times | `python3 -B apps/capture-worker/test-fixtures/row58_gate.py all` | `ROW58 GATE: 12 run(s), 12 PASS, 0 FAIL`, 3 of 3 (`06_row58_gate_r1..r3.log`): seven near misses and two foreign lines `INGEST_ANNOUNCE_NOT_MATCHED`, statuses `[200, None]`, `ic=0 bytes=0`; no `ANNOUNCE` request `INGEST_OPEN_FAILED`; the proof build `INGEST_ANNOUNCE_NOT_SEEN` for both cameras, worker rc 70; the right path `ic=1`, 75 frames; `path_text=0`, `leftover=0` in all 36 |
| The BR-09 checks of rows 142 and 178 in the worker's own series, three series | `E2E_NO_LOCK=1 python3 -B apps/capture-worker/test/e2e.py --only br09 --runs 3 --tag row141 --ports 8559,8561 --no-build --load-wait 0`, then `--runs 1 --tag row141b`, `--tag row141c` | each: `38 checks (33 expected PASS, 5 negative controls expected FAIL): 38 as expected, 0 unexpected`; `ports still listening after the series: none`; `AGGREGATE EXIT CODE 0` (`07_br09_series.log`, `07_br09_series_run_b.log`, `_c.log`). The series runs this block once whatever `--runs` says (D122), hence two further series |
| In them: both assignments (HB-1) | - | 6 of 6 per series, 18 of 18: the right camera records, the wrong one is refused by the gate. HB-1 holds on the Linux library |
| In them: every RTSP method first on a wrong path | - | the same split as on macOS, in all three series: `OPTIONS` and `ANNOUNCE` are refused by the gate (`INGEST_ANNOUNCE_NOT_MATCHED`); `DESCRIBE`, `SETUP`, `PLAY`, `PAUSE`, `RECORD`, `TEARDOWN`, `GET_PARAMETER`, `SET_PARAMETER`, `REDIRECT` are ended by the library before the gate (`INGEST_OPEN_FAILED`) (`14_br09_collect.log`) |
| In them: the case-A client on the right path | - | passes the gate, ends as `INGEST_NO_PICTURE_SIZE` / `CAMERA_NO_PICTURE`, the other camera's file complete, 2 of 2 per series |

The relay against the gate, in the container (it announces the plan's address; root, section 6): `row041_relay.py record` 6 of 6 three times (H.264 and HEVC, parameter sets in the description and in the stream, `gate_refusals=0`, `decode_errors=0`, 125 pictures in each file); `row043_reopen.py drop` 5 of 5; `row153_confinement.py all` 6 of 6; `row143b_source_bind.py all` 14 of 14.

## 6. The relay's process state, read from the process table during runs

Read by `c1/sample_relay.py` (root, every 50 ms, every process whose `comm` is `capture-relay`): `/proc/<pid>/status`, `/proc/<pid>/limits`, every link of `/proc/<pid>/fd`, and `lsof` for the socket ends. 3,211 samples of 33 relay processes in 6 fixture passes (`out/relay_samples_*.jsonl`; totals by `analyse_relay.py`).

| Subject | Number on Linux | Count |
|---|---|---|
| `NoNewPrivs` | **1** | 3,210 of 3,211 samples. The one other sample (re-open pass, pid 20547) shows a relay with descriptors 0, 1, 2 and NO socket, `NoNewPrivs: 0` and unlimited limits: the instant between the program's start and its hygiene step. No sample with a socket has anything but 1 |
| `Max core file size` (soft / hard) | **0 / 0** | the same 3,210 |
| `Max file size` (soft / hard) | **0 / 0** | the same 3,210 |
| `Max open files` | 1024 / 524288 (the container's; the relay does not set it) | all |
| Not dumpable | **set**: `prctl(PR_SET_DUMPABLE, SUID_DUMP_DISABLE) = 0` in every trace; started by `dems-check` (uid 1001) the relay's `/proc/<pid>/fd` belongs to uid 0, and the same account reading it gets `PermissionError` in 520 of 520 samples | pass `rec_plain_r1` |
| Descriptors | **the three standard streams (pipes, numbers 0, 1, 2) and at most two sockets (numbers 3 and 4): never more than 5**; descriptors that are neither a pipe nor a socket: **0** | 3,204 of 3,204 samples in which the list was read |
| What the sockets are | connected TCP only, peers `127.0.0.1:8559` (the ingest port given) and `127.0.0.1:8565` (the locator's); listening rows 0; datagram rows 0 | record passes: both sockets in 2,065 of 2,086 samples, the push alone or the camera leg alone in 21; re-open pass: push alone in 171 samples (the wait), both in 504 |
| The extra descriptor of macOS (`systm`, `com.apple.netsrc`, `test/159` section 5) | **does not exist on Linux** | 0 of 3,204 |
| `Seccomp` | 2 in every sample - and in a plain shell of the container too: it is the container runtime's default filter, NOT the relay's (none is built: `implementation/153` section 4) | - |
| Order of the hygiene step, from the trace | `prlimit64(RLIMIT_CORE, {0, 0})`, read back; `prlimit64(RLIMIT_FSIZE, {0, 0})`; `prctl(PR_SET_DUMPABLE, SUID_DUMP_DISABLE)`; `prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) = 0`: trace line 94 of 10,976 to 24,486, before any socket | 5 of 5 traces |

**FINDING, by the trace and invisible to the samples.** `strace -f` of one re-open pass (5 relays, `15_relay_strace.log`, traces under `out/strace/`): after the no-new-privileges call the pinned library opens `/dev/urandom` read-only, **4 times per run, 20 of 20**: `openat(AT_FDCWD, "/dev/urandom", O_RDONLY) = 5`, close-on-exec set, 4 bytes read, closed. For those instants a sixth descriptor exists that is a character device, not a socket. No 50 ms sample caught it. It is not a path to a secret, it is read-only, and the relay's own code opens nothing (its import net is green on the ELF binary). HYPOTHESIS, source not read: the random seed libavutil takes for a session or stream identifier. So the statement "standard streams and the relay's sockets, nothing else" is true of what the relay holds and false of every instant; RC-6's "opens no file after its start" needs that one exception named, and a system-call filter must be written with it. Request line filed.

**The system calls after the hygiene step**, all 5 traces together (the information row 153 asked for; arm64 names; a list for a filter must be taken again on the host's architecture): `ppoll` 35,980, `sendto` 26,956, `getsockname` 11,231, `close` 5,141, `recvfrom` 3,476, `fcntl` 117, `getsockopt` 60, `write` 44, `brk` 34, `getpeername` 27, `read` 25, `openat` 20 (all `/dev/urandom`), `socket` 16, `prlimit64` 16, `connect` 16, `munmap` 15, `mmap` 15, `mlock` 15, `shutdown` 11, `setsockopt` 11, `bind` 11, `getrandom` 5, `exit_group` 5. 23 names; no `listen`, no `accept`, no `execve`, no `clone`. `bind` 11 = one per dial of the camera leg (first open and every re-open), each followed by one `connect` of the same socket: decision C65 as built.

**The source address (C65).** In a `--network none` container the only address is the container's loopback, so the relay bound 127.0.0.1 before every connect. `row143b_source_bind.py all`: 14 of 14 - an address the container does not hold (192.0.2.1) ends 20 `CAMERA_UNREACHABLE` with `0 connection(s), 0 request(s)` at the counting double in probe and record mode; no source and 8 malformed forms end 10 with 0 connections.

**What a process without the capability sees (a fact for the Core, which has none).** The relay fixtures read the relay's sockets with `lsof`. Run as `dems-check` against a relay of the same account, all 6 record runs FAIL on exactly one criterion, `sockets_two_connected_streams_no_listener_no_datagram`, while relay, worker and files are as in the root passes (`09_relay_record_plain_account.log`): the kernel shows a not-dumpable process's descriptors and its program link to nobody without `CAP_SYS_PTRACE`. That is the confinement working, and the reason the container had the capability. The same closes `/usr/bin/readlink /proc/<pid>/exe` for the Core's leftover check (row 79, HA-12).

## 7. Inherited work (what row 193 left)

| Item | Change | Check |
|---|---|---|
| `make fixtures` fails on glibc | `apps/capture-worker/Makefile`: `-D_DEFAULT_SOURCE` on the three compile lines of `fake_mic`, `m5_mic`, `capture-worker-skeleton111` (now lines 260, 265, 274). Additive; Apple's headers do not read the macro | container `make fixtures rc=0`, `make proof rc=0`; macOS `make rc=0`, `make fixtures rc=0` (`01_mac_make_after_macro.log`) |
| `lsof`, `ffmpeg` on the path, `libx264` / `libx265` | `scripts/host/container/Dockerfile.ubuntu-24.04`: ONE added step - `lsof`, `libx264-dev`, `libx265-dev`, and a second build of the same verified archive (same SHA-256 checked again, no second download) as static libraries with the two encoders, of which only `ffmpeg` and `ffprobe` are kept under `/opt/dems/fixtures-ffmpeg-9.0.2/bin`, linked from `/usr/local/bin`, named by `DEMS_FFMPEG` / `DEMS_FFPROBE`. Its `lib`, `include` and `share` are removed in the step. `README.md` beside it: one dated section | in the image: `lsof` at `/usr/bin/lsof`; `ffmpeg -encoders` lists `libx264`, `libx265`; the fixtures' program links 0 libav libraries; the loader knows `libavformat.so.63` under `/opt/dems/ffmpeg-9.0.2/lib` and no other; `ffmpeg` and `libavformat-dev` of the distribution not installed (the step fails otherwise). BR-06: the worker's `make versions` unmoved |
| `build/fake_cam` | compiles, but it encodes through the PINNED libavcodec, which has no H.264 encoder: it cannot make a stream in the container. No fixture run of this row uses it (the pushers are the `ffmpeg` program and the test camera) | not closed; it concerns the parts of the full series that use it |

## 8. The watched-call list (decision C51 (3))

`apps/capture-worker/test/static/pinned_calls.py`: `FILE_MAKING` 60 -> **72** names; the 12 new ones are a list of their own, `LINUX_ONLY`, and all are banned in the sources (none is an allowed function). Derived from the container: `nm -u` of the three programs (`out/imports_*.txt`: worker 150 names, relay 90, guard 28) and what glibc 2.39 exports (`03_prep.log`).

| Name | glibc 2.39 exports it | In an import table of the three | Decision |
|---|---|---|---|
| `renameat2`, `memfd_create`, `open_by_handle_at` | yes | no | **watched** (a rename with flags; a file without a name; an open without a path) |
| `fallocate` | yes | no | **watched** (removes a range of an open file: truncation by another name) |
| `execveat`, `fexecve`, `execvpe`, `pidfd_spawn`, `pidfd_spawnp` | yes | no | **watched** (exec and spawn spellings macOS does not have) |
| `clone`, `_Fork` | yes | no | **watched** (other spellings of `fork`) |
| `dlmopen` | yes | no | **watched** (other spelling of `dlopen`) |
| `openat2`, `clone3`, `memfd_secret` | **no** | no | not watched: no function of that name exists in this C library; reachable only through `syscall`, which is watched |
| `name_to_handle_at` | yes | no | not watched: it reads a handle and makes nothing; its only use is `open_by_handle_at`, which is watched |
| `copy_file_range`, `splice`, `posix_fallocate` | yes | no | not watched: they write into or grow a file a watched function must have opened first; none removes data |
| `open64`, `creat64`, `fopen64`, `ftruncate64`, `__open_2` and their kind | yes | the worker imports the six pinned functions under their plain names | folded onto the watched name by the reader (row 193) |
| `mount`, `pivot_root`, `chroot`, `open_tree`, `fsopen`, `move_mount` | yes | no | not watched: not Linux-only as a kind (`mount`, `chroot` exist on macOS) and they need a capability the service account does not have; named for the review |
| `mkdtemp`, `mkostemps`, `mknodat`, `mkfifoat`, `sem_open` | yes | no | NOT Linux-only, watched on neither system: outside this decision, request line |

Control in the container (`c1/watch_control.sh`): one program per new name, each also calling the six pinned functions, handed to the import net. With the list of this row: **12 of 12 refused** (`imports <name>, which is not a pinned file-making function`); with the list of before: **0 of 12**; a program with the six pinned functions alone passes under both (`13_watch_list_new.log`, `13_watch_list_old.log`). `--reader-selftest` gained 6 ELF rows (26 spellings) and one check that every Linux-only name is watched and banned; it runs inside `check.sh --selftest` on both systems.

| Platform | `make -C apps/capture-worker` after the change | Lines |
|---|---|---|
| macOS | **rc 0** (`19_mac_make_final.log`) | `check.sh: src: static rules OK`; 154 `refused as required`; `relay_unit_test: 982 checks passed`, 34 of 34; `guard_test: all 83 checks hold`; import net of the Mach-O worker passes |
| Container (image `b914f7078f7b`, recorded build) | **rc 0**, every step rc 0 | the same 154 `refused as required` per pass; `sync wanted FSYNC`; 982 checks; the import net of the ELF worker passes; the token rules over `src` pass |

Not done, not this row's files: no planted line of `check.sh --selftest` names a Linux-only call; `relay-check.sh` and `guard_test.py` keep their own lists.

## 9. What a container cannot show, by check name

| Left to hardware | Why not here |
|---|---|
| `9A/H-01` | the production host's own build of the pinned library (amd64, its compiler): the announce line, the gate, BR-09 and the relay's process state there. This row is arm64 on a virtual machine's kernel |
| `9A/H-03` | the sync level on the real evidence disk (`FSYNC` on Linux; the container's file system is the virtual machine's) |
| `9A/H-24` | the relay's descriptors and limits and the leftover check under the real service manager and service account (no unit, no `IPAddressDeny`, no `ProtectSystem` in a container); whether the unit leaves `/dev/urandom` readable |
| `9A/H-09`, `H-10`, `H-11` | a second network interface: that the relay leaves by the camera-interface address, a re-open after the address is lost, an interface that is down with its address kept (C65). Here every address is one loopback |
| `9A/H-10` to `H-12`, `H-23` | a real camera's answers (the test camera and the FFmpeg client are the only peers) |
| the system-call filter | not built (C51 / row 153); the call list of section 6 is a container list on arm64 |
| O-2 / R-1 of `gateway_check/008` | still INCONCLUSIVE on Linux as on macOS: a second client is turned away below RTSP |

## 10. Commands

```sh
# repository root, command sandbox off; every line that starts a container or a build under the lock
/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock make -C apps/capture-worker            # macOS, after each of the two changes
/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
  docker build -f scripts/host/container/Dockerfile.ubuntu-24.04 -t dems/capture-linux-check:ubuntu-24.04-ffmpeg-9.0.2 .
/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock docker run -d --init --name dems-c1-row141 --label dems.agent=c1 \
  --network none --cap-add SYS_PTRACE -v "$PWD/.cache/task4-row141/c1:/c1:ro" -v "$PWD/.cache/task4-row079/c1:/c79:ro" \
  -v "$PWD/.cache/task4-row141/out:/out" dems/capture-linux-check:ubuntu-24.04-ffmpeg-9.0.2 sleep infinity

# one run = one lock hold: .cache/task4-row141/dx.sh <log> <account> <command...>  (docker exec -w /opt/dems/core, M3_PORTS=8559,8561, E2E_NO_LOCK=1)
dx.sh 03_prep.log root bash /c1/prep.sh ; dx.sh 03_prep.log root bash /c1/prep2.sh     # fixtures, proof builds, probe, the worker of b7ed4c60
dx.sh 04_e11b_probe.log dems-check python3 -B apps/capture-worker/test-fixtures/e11b_announced_path.py probe
dx.sh 04b_probe_facts.log dems-check bash /c1/probe_facts.sh
dx.sh 05_o1_before_gate_worker.log dems-check python3 -B /opt/dems/before/apps/capture-worker/test-fixtures/e11_listener_path.py all
dx.sh 06_row58_gate_rN.log dems-check python3 -B apps/capture-worker/test-fixtures/row58_gate.py all          # N = 1, 2, 3
dx.sh 07_br09_series.log dems-check python3 -B apps/capture-worker/test/e2e.py --only br09 --runs 3 --tag row141 --ports 8559,8561 --no-build --load-wait 0
dx.sh 08_relay_record_root_rN.log root bash /c1/relay_run.sh rec_root_rN root row041_relay.py record          # sampler beside it
dx.sh 09_relay_record_plain_account.log root bash /c1/relay_run.sh rec_plain_r1 dems-check row041_relay.py record
dx.sh 10_relay_reopen.log root bash /c1/relay_run.sh reopen_r1 root row043_reopen.py drop
dx.sh 11_relay_confinement.log root bash /c1/relay_run.sh conf_r1 root row153_confinement.py all
dx.sh 12_relay_source_bind.log root bash /c1/relay_run.sh bind_r1 root row143b_source_bind.py all
dx.sh 13_watch_list_old.log root bash /c1/watch_control.sh /opt/dems/core/apps/capture-worker/test/static/pinned_calls.py
dx.sh 13_watch_list_new.log root bash /c1/watch_control.sh /c1/new/pinned_calls.py
dx.sh 15_relay_strace.log root bash /c1/strace_relay.sh
python3 .cache/task4-row141/analyse_relay.py .cache/task4-row141/out/relay_samples_*.jsonl                    # host, reads only

/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock docker rm -f dems-c1-row141
docker ps -a --filter label=dems.agent=c1          # 0 rows
```

The pre-gate tree: `git archive b7ed4c60 apps/capture-worker | tar -x -C .cache/task4-row141/c1/before` (reads the repository, writes scratch only).

## 11. Driver decisions, for the controller to confirm

1. **The fixtures' encoder is a second build of the same archive, programs only**, not the distribution's `ffmpeg` 6.1.1: the pusher stays the client the macOS observations used (FFmpeg 9.0.2), and no second libavformat reaches the loader.
2. **O-1 was repeated on the worker of commit `b7ed4c60`**, compiled in the container, because the tree's worker has the gate. That commit's own link step could not be used: its import reader cannot read ELF (finding L-3, closed later) and deletes the binary; the two programs were compiled with its compile line directly.
3. **`--cap-add SYS_PTRACE` on the observation container.** Without it nobody in the container can read the relay's descriptors (section 6). It changes nothing the relay or the worker do.
4. **Twelve names, not two.** Beyond `renameat2` and `memfd_create`: the exec, spawn, fork and dlopen spellings Linux alone has, `open_by_handle_at`, and `fallocate` (it removes data from a file).
5. **One container for both rows, idle between lock holds**, in the place of one container per run: the built fixtures, proof builds and the probe stay; every command in it held the lock.
6. **Two `make` runs on macOS** (one after the build-file change, one after the list change), each under the lock, each rc 0: the brief named one, the second change needed its own.

## 12. Rules kept, and deviations stated

Claims line first. Existing repository files with the Edit tool only: `apps/capture-worker/Makefile` (3 lines), `scripts/host/container/Dockerfile.ubuntu-24.04` (one step), `scripts/host/container/README.md` (one section), `apps/capture-worker/test/static/pinned_calls.py` (the list, 6 reader rows, one check), `file_claims.md`, `file_requests.md`. Nothing under `apps/capture-worker/src/`. Nothing committed, staged or stashed. `apps/input-av` not opened; the build context holds 132 files, 0 under `apps/input-av`. No real device, no credential, no network address but the container's loopback.

Deviations: (a) my own scratch scripts under `.cache/` (untracked) were corrected three times by a scripted replace - no repository file was; (b) the first wait for the lock ended after 30 minutes without it (the worker's full series of agent C2 held it for about 46 minutes) and was started again; (c) `docker ps` readings and the two reads on this Mac that start no container (the argument lists and the leftover replay of row 79) ran without the lock; (d) the images `bc5b123c5304` (this row's run image) and `cdacf98a3f10` (row 193's) lost the tag and were not removed: nothing was pruned.

---
*Generated: 2026-10-13 15:55 WIB*
