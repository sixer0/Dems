---
task_slug: input_av_core_adapter_plan
row: 25
work_package: WP-02 (experiment E-7 final, on macOS)
date: 2026-10-13
agent: test-expert (batch 8, agent H)
status: complete on macOS; Linux unproven (9A/H-02, 9A/H-24, row 79)
tier: T2
---

# Row 25: experiment E-7 final on macOS - no child survives an abrupt end of the Core-side parent

Tier 2: what was found, why it matters, how it was verified, source. A measurement: no product file was changed, nothing was built. The programs that ran are the existing `apps/capture-worker/build/capture-guard` and `build/capture-relay`, the installed `ffmpeg`, the committed test camera, and the product file `apps/core-server/src/capture/adapters/production-door.ts` imported unchanged.

## 1. Result

21 runs counted (7 cells of 3 runs), all on 2026-10-13 01:46 to 02:01 UTC, FFmpeg 9.0.2, node v26.8.2. In 21 of 21 the door answered `started`, the child was delivering to its consumer before the trigger and had not ended by itself. The trigger is one `SIGKILL` of the node process that holds the production door; the consumer of the child stays alive.

| Cell (what the door started) | Runs | Survivors after the parent's SIGKILL | Helper gone after (ms) | Door child (guard or relay) gone after (ms) |
|---|---|---|---|---|
| `guard-mic`: guard, FFmpeg microphone form | 3 | **0** | 17.4, 31.4, 20.0 | 18.7, 31.4, 20.0 |
| `guard-micp`: the same with `-progress pipe:1` | 3 | **0** | 20.2, 20.1, 18.9 | 20.2, 20.1, 20.1 |
| `guard-relay`: guard, FFmpeg pull-and-push form | 3 | **0** | 21.4, 42.2, 49.1 | 21.4, 43.7, 49.1 |
| `guard-relayp`: the same with `-progress pipe:1` | 3 | **0** | 49.8, 37.8, 35.7 | 49.7, 39.2, 37.3 |
| `relay`: `build/capture-relay`, no guard (it reads its standard input itself) | 3 | **0** | - | 20.8, 29.6, 12.1 |
| CONTROL `bare-micp`: FFmpeg microphone form, the same door, **no guard** | 3 | 3 of 3 | never (8 s window) | - |
| CONTROL `bare-relayp`: FFmpeg pull-and-push form, the same door, **no guard** | 3 | 3 of 3 | never (8 s window) | - |

- **Surviving child processes for the helper path: 0 of 12** (the row's Verification cell). Row 22 had 30 of 30 survivors for the same four forms without a guard; the two controls here reproduce that through the production door (6 of 6: parent process 1, state `S`, still delivering 0.6 s after the window).
- **The relay half: 0 of 3.** By the blueprint the relay half is carried by row 44; these three runs are the door-level fact row 44 can cite, with the limits of section 5.
- **Bound measured**: the last process of a guarded helper was gone at most **49.8 ms** after the SIGKILL (12 runs; 1-minute load 2.7 to 9.4); the relay at most **29.6 ms** (3 runs; load 10.8 to 11.7). The guard's own test states 16 to 24 ms after input end and at most 64 ms after a parent's SIGKILL (`implementation/023_guard_program.md` section 4); the figures agree. Polling step of this driver: 1 ms plus the cost of one `kill(pid, 0)` per watched process.
- `pgrep` and the listener list were empty afterwards (section 4).

## 2. Why it matters

AD-09 (3): "0 surviving children" after an abrupt end of the Core. The door's exit handler kills its children on a normal exit, but does not run on `SIGKILL` (`production-door.ts:238`, `implementation/021_production_door.md`, table "unproven": "No child survives an abrupt end of the Core ... E-7, rows 22 and 25"). Row 22 measured that FFmpeg does not end when its standard input ends or its parent dies (42 of 42 survivors while its consumer lives). The guard of row 23 was built for that; its own test used a double of a helper and a socket pair in place of the door (`023` section 5: "The guard through the real door: not run"). This row closes both on macOS: the real FFmpeg under the real guard through the real door.

## 3. What was run - which part is real code, which a stand-in

| Part | Real or stand-in |
|---|---|
| The start of the child: `startProductionProcess` of `production-door.ts`, with `credential.ts` for the relay's start message | **real product code**, imported unchanged by a 70-line node script (`door_parent.ts`, run with `node --import tsx`); stdio three pipes, empty environment, no shell, soft core-file limit 0 (the door would refuse otherwise) |
| The Core | **stand-in**: that node script. It holds the door and nothing else of the Core (no supervisor, no session, no database). Its abrupt end is `SIGKILL` |
| Guard | **real**: `build/capture-guard`, SHA-256 `772d9ef0...b083a9`, invoked as `<guard> <absolute ffmpeg> <arguments>` |
| Helper | **real program** `/opt/homebrew/bin/ffmpeg` 9.0.2, SHA-256 `c8173e97...e4e1a8`, the same bytes as the private copy `.data/helpers/ffmpeg`. Its **inputs are stand-ins**: `-f lavfi sine` for a microphone, the test camera for a camera. The argument lists are row 22's forms (section 3 of `test/022_e7_without_guard.md`), `-nostdin` |
| Relay | **real**: `build/capture-relay`, SHA-256 `dd814caa...8f6938`, started as `startCameraRelay` does (`camera/relay-start.ts:56-65`: no argument, empty environment, members `type, mode, ingest, attempt, access`) |
| Camera | **stand-in**: `apps/capture-worker/test-fixtures/rtsp_test_camera.py` on 127.0.0.1:8565, 320x240 H.264, Digest, its synthetic account (imported, never written) |
| Consumer of the microphone form | **stand-in**: a reader thread of the driver on a named pipe |
| Consumer of a push | **stand-in**: `ffmpeg -rtsp_flags listen ... -f null` on 127.0.0.1:8566 (FFmpeg form) and on 127.0.0.1:8559 (the relay: its ingest grammar accepts ports 8554-8564 only). **Not the capture worker** |

Exact commands (repository root, command sandbox off: loopback ports, `ps`, `pgrep`, `lsof`; one lock hold per cell, 8 to 25 s each):

```
/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock python3 -B .cache/task4-row025/e7_with_guard.py run <cell> --runs 3
#   <cell>: guard-mic | guard-micp | guard-relay | guard-relayp | relay | bare-micp | bare-relayp
python3 -B .cache/task4-row025/e7_with_guard.py summary
```

What one run does: start the consumer (and the camera), start the node parent with a specification file, read its line `started` with the process ID of the door's child, find the guard's child with `pgrep -P`, wait until the consumer's count grows, wait 1.5 s more, check that guard and helper are alive, `os.kill(parent, SIGKILL)`, poll `kill(pid, 0)` of the guard and of the helper every millisecond for at most 8 s, record when each is gone, then end what is left by process ID and record what remained.

Helper commands as the door received them (the door's `command` is the guard, the list below its `args`):

| Form | Arguments after the guard |
|---|---|
| `mic` | `/opt/homebrew/bin/ffmpeg -hide_banner -nostdin -nostats -loglevel warning -re -f lavfi -i sine=frequency=440:sample_rate=48000 -vn -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -y <named pipe>` |
| `micp` | the same with `-progress pipe:1` after `-loglevel warning` |
| `relay` | `/opt/homebrew/bin/ffmpeg -hide_banner -nostdin -nostats -loglevel warning -rtsp_transport tcp -i rtsp://<synthetic account>@127.0.0.1:8565/media/video1 -an -c copy -f rtsp -rtsp_transport tcp rtsp://127.0.0.1:8566/e7sink` |
| `relayp` | the same with `-progress pipe:1` |

Summary lines as printed:

```
bare-micp     runs 3  started 3  delivering 3  survivors 3  helper gone ms [None, None, None]  door child gone ms [None, None, None]  left 0  load [2.95, 2.89, 3.14]
bare-relayp   runs 3  started 3  delivering 3  survivors 3  helper gone ms [None, None, None]  door child gone ms [None, None, None]  left 0  load [10.11, 15.33, 15.37]
guard-mic     runs 3  started 3  delivering 3  survivors 0  helper gone ms [17.4, 31.4, 20.0]  door child gone ms [18.7, 31.4, 20.0]  left 0  load [2.74, 2.74, 2.68]
guard-micp    runs 3  started 3  delivering 3  survivors 0  helper gone ms [20.2, 20.1, 18.9]  door child gone ms [20.2, 20.1, 20.1]  left 0  load [2.68, 2.95, 2.95]
guard-relay   runs 3  started 3  delivering 3  survivors 0  helper gone ms [21.4, 42.2, 49.1]  door child gone ms [21.4, 43.7, 49.1]  left 0  load [9.16, 9.07, 8.98]
guard-relayp  runs 3  started 3  delivering 3  survivors 0  helper gone ms [49.8, 37.8, 35.7]  door child gone ms [49.7, 39.2, 37.3]  left 0  load [9.22, 9.12, 9.43]
relay         runs 3  started 3  delivering 3  survivors 0  helper gone ms [None, None, None]  door child gone ms [20.8, 29.6, 12.1]  left 0  load [11.66, 11.21, 10.79]
```

Runs not counted, stated for completeness: one trial run each of `guard-mic`, `guard-relay` and `relay` before the counted series (0 survivors, 18.8 / 34.1 / 24.1 ms; their folders were overwritten by the counted runs), one start that failed because the driver named `node` without its path, and 12 runs in which the driver's own push listener did not start (a missing `-listen_timeout` in the driver; the door was never reached, no child existed, `door_event` null). Both were faults of the driver and were corrected before the counted series.

## 4. How it was verified

- **The instrument finds a survivor**: the two controls start the same FFmpeg forms through the same door without the guard and are killed the same way: 6 of 6 survive, re-parented to process 1, still delivering. So "0" in the guarded cells is not a blind check.
- **The end belongs to the trigger**: in 21 of 21 the guard / relay / helper were alive 1.5 s after delivery began, immediately before the SIGKILL (`alive_before_trigger`), and `child_ended_by_itself_before_trigger` is false.
- **Only the parent is signalled**: `os.kill(parent.pid, SIGKILL)`; parent exit status -9 in 21 of 21. Guard and helper are in the parent's process group (rows `ps -o pid,ppid,pgid` in each `result.json`: `detached: false`), and no group signal is sent.
- **Microphone form**: the reader of the named pipe saw the end of the stream 6.8 to 24.4 ms after the SIGKILL in 6 of 6 - the helper closed its output before it ended (a SIGTERM from the guard, FFmpeg's ordinary end), it was not cut by the pipe.
- **Nothing left**: per run `left_after_cleanup` empty and `listeners_left` empty, 21 of 21. After the last run:

```
pgrep -fl 'task4-row025|e7sink|row25sink|capture-guard|rtsp_test_camera'      -> no line, exit 1
lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(8559|856[0-9]|857[0-4]) '             -> no line, exit 1
node scripts/secret-scan/count-only.mjs .cache/task4-row025                    -> TOTAL: 0 in 0 file(s)
```

(The specification file of a run holds the FFmpeg form's pull address with the synthetic account; the driver deletes it at the end of each run.)

## 5. What makes it ambiguous, and what stays unproven

1. **macOS only.** On Linux the guard has a second mechanism (parent-death signal, `guard.c:159-166`) that is not compiled here, and `poll` / `FIONREAD` on Linux pipes were not run: `9A/H-02`, `9A/H-24`, row 79 (container).
2. **The stand-in for the Core is a node process that holds only the door.** A real Core also holds the worker and, at an abrupt end, the worker ends on the end of its own standard input. Here the consumer was deliberately NOT the worker and stayed alive: the harder case. The whole chain (Core, worker, relay, guard, helper in one session) under a SIGKILL of the real Core was not run; it is the E-7 half of row 44.
3. **A SIGKILL of the guard itself** (the door's `kill('SIGKILL')`, or the door's exit handler on a NORMAL exit of the Core, which sends SIGKILL to the guard) was not a case of this row. `023` section 5 states that on macOS the helper then lives on until its consumer goes. For the controller: on a normal Core exit the door kills the guard, not the helper; whether a helper is then left depends on the consumer. Not measured here - a candidate for row 44 or a row of its own.
4. **Generated sources.** `lavfi` is not `alsa`; a device input could react differently to SIGTERM (it has 2,000 ms before the guard's SIGKILL; the longest end here was 49.8 ms).
5. **The relay's consumer was FFmpeg listening**, not the worker's ingest: the relay ended in at most 29.6 ms with its push open; with the real worker the TEARDOWN exchange may take longer (bounded by the relay at 2 s for closing the push, `041` section 3).
6. **Window 8 s; three runs per cell.** "0 survivors" is 15 of 15 on one host, not a distribution; load during the relay cells was 9 to 15 (other agents' work), during the microphone cells 2.7 to 3.1.
7. The guard's exit code was not collected (its parent was dead).

## 6. Driver decisions (for the controller to confirm)

1. **The relay half was run** although the blueprint's Verification cell names it as row 44's: the delegation asked for it. It is evidence for row 44, not its closure.
2. **Controls without the guard through the door** were added (6 runs): the row does not ask for them; without them "0" proves nothing.
3. **The driver lives under `.cache/task4-row025/`** (git-ignored; the row's profile is "docs only"): `e7_with_guard.py` (295 lines, SHA-256 `0abc1efc...cf9bb7`), `door_parent.ts` (70 lines, SHA-256 `02c07858...0d9e38`), `runs/<cell>_r<n>/result.json`. If the check is to be repeatable from a commit it needs a home in a row whose ownership allows one (the same remark as row 22, ambiguity 7).

## 7. Rules kept

Heavy-host lock for every run, one hold per cell. Ports 8565 (camera double), 8566 and 8559 (push listeners), loopback only. No worker, no Core instance, no database, no `.env`, no microphone or camera of this Mac. Nothing built; no file under `apps/` or `packages/` written. Existing files edited with the Edit tool only (one line in `file_claims.md`). Only processes of the driver were ended.

---
*Generated: 2026-10-13*
