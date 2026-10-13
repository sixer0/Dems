---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 44
milestone: M3 / WP-03d
date: 2026-10-13
agent: test-expert (batch 9, agent R8)
tier: T2
requirement: experiment E-12 extended; S13-02 (g); AD-09 (3) (survivors: a killed parent, a relay stopped at the 25 s bound, an aborted open); the special-character account
status: complete on this Mac's doubles - 42 runs, 0 occurrences, 0 survivors. No product file was changed, nothing was built
---

# Row 44: experiment E-12 extended - the search for the fixture secret around a running relay

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. Runs: this Mac (arm64), loopback only, command sandbox off, the heavy-host lock taken per run, 2026-10-13 03:59 to 04:17 UTC, load average 4.9 to 36 (fifteen other agents on the host).

## 1. What was found

**0 occurrences of any searched text in any place, in 42 runs of 14 cases (3 runs each). 0 relay processes left, in every run. The control of the search was found in 42 of 42 runs.** No finding.

Result line of the fixture, verbatim:

```
ROW44 E-12: 42 run(s), 42 PASS, 0 FAIL, 0 FINDING; occurrences in all places of all runs: 0; relays left: 0; controls found: 42 of 42
```

## 2. What was observed, and how

| Subject | As run |
|---|---|
| The relay | `apps/capture-worker/build/capture-relay`, sha256 `815725e3b054c52616916c792d79ccbbc283dc14ba064f44c51065d7ac444837`, built 2026-10-13 10:15 local. Hashed at the start of every run: the same in all 42; no rebuild happened under the runs |
| The worker | `apps/capture-worker/build/capture-worker`, sha256 `fe6bda4e4cf4fb79a726165392e7d7b80c89e42e5af76a739c8a664a7b2a00ba`, the same in every run |
| How the relay was started | by a stand-in of the Core, `apps/capture-worker/test-fixtures/row044_door_parent.mts`: a Node process that imports, unchanged, `startCameraRelay` / `startCameraProbe` (`apps/core-server/src/capture/adapters/camera/relay-start.ts`, the one caller of the injection point) and `startProductionProcess` (`.../adapters/production-door.ts`). The door's own `spawn` call was read in every run: 0 arguments, an environment given with 0 keys, no shell, not detached, three pipes; the door read its own core-file limit as 0 |
| How the relay's real output was read | the door keeps a bounded, blanked head of each stream, so a search in it could miss a text. The stand-in wraps `spawn` of `node:child_process` before the door is loaded and adds ONE more `data` listener to the two streams of the relay program; the door's arguments and behaviour are unchanged. Both the raw bytes and the door's copies were searched |
| The camera | `test-fixtures/rtsp_test_camera.py` on 8565 (pull side, Digest), with its own switches: `--drop-after-frames` (loss and re-open), `--challenge basic`, `--sdp-codec hostile`, `--account special`, `--adversary slow-answers --adversary-delay-ms 1200` on the refusal paths (so that a relay that is about to be refused lives for seconds and can be sampled), `--first-keyframe-delay-ms` for the bound |
| The worker | the release worker in a live session through the existing harness (`e11_listener_path.py`, imported read-only), listeners 8559 and 8561; its other camera is pushed by the harness' control pusher and recorded in 24 of 24 worker runs |
| The guard | not in the relay's chain: the adapter starts the relay program itself (`relay-start.ts:88`, `command: start.program`). No guard process exists in these runs; its row is absent from the table for that reason |
| The texts searched | held in the memory of the fixture only: the camera's synthetic password and account (the special-character pair in its cases; the wrong password AND the real one in the wrong-password cases), the stream locator and its path, the ingest address given to the relay and its last element, the plan's right last element in the wrong-path case, the control camera's last element, the hostile codec text (300 characters) and its markup. Each also in its JSON-escaped and percent-encoded form |
| The repository's needles | `node scripts/secret-scan/count-only.mjs <run folder>` after every run: exit 0, no needle with a count above 0, in 42 of 42 runs |
| The control of the search | beside every case a sleeping process with one planted text as an argument and another in its environment, read by the same sampler with the same two `ps` calls: found in every sample of every run. A run whose control is not found gives no verdict |

A "sample" of a process place is one reading of `ps -o args= -ww -p <pid>` (arguments) or `ps eww -o command= -p <pid>` (arguments followed by the environment), taken about four times a second for as long as the process lived, the relay first and once at the moment its process ID was known. A sample of a text place is one whole stream, file or frame line.

## 3. Places x cases: occurrences / samples, summed over the 3 runs of a case

Case keys: A record with a camera loss and a re-open, then the order to stop (`push_established`, `camera_lost`, `camera_reopened` on standard output in 3 of 3 runs) - B record, HEVC, the special-character account - C probe (the probe report line) - D probe, special-character account - E probe, wrong password - F record, wrong password (exit 23) - G Basic only (exit 22) - H hostile description (exit 28) - I a wrong-path push refused by the worker's gate (exit 40, 1 gate refusal per run) - J unreachable camera (exit 20) - K the PARENT KILLED during a retry wait, through the door - L the same with the relay's pipes held by the observer - M the relay killed at the 25 s bound of an open - N an aborted open.

| Place | A | B | C | D | E | F | G | H | I | J | K | L | M | N |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| relay arguments | 0 / 120 | 0 / 49 | 0 / 42 | 0 / 3 | 0 / 39 | 0 / 39 | 0 / 21 | 0 / 39 | 0 / 2 | 0 / 3 | 0 / 56 | 0 / 54 | 0 / 372 | 0 / 27 |
| relay environment | 0 / 120 | 0 / 49 | 0 / 42 | 0 / 3 | 0 / 39 | 0 / 39 | 0 / 21 | 0 / 39 | 0 / 2 | 0 / 3 | 0 / 56 | 0 / 54 | 0 / 372 | 0 / 27 |
| Core stand-in arguments | 0 / 123 | 0 / 51 | 0 / 45 | 0 / 6 | 0 / 42 | 0 / 42 | 0 / 24 | 0 / 42 | 0 / 7 | 0 / 6 | 0 / 156 | 0 / 153 | 0 / 375 | 0 / 30 |
| Core stand-in environment | 0 / 123 | 0 / 51 | 0 / 45 | 0 / 6 | 0 / 42 | 0 / 42 | 0 / 24 | 0 / 42 | 0 / 7 | 0 / 6 | 0 / 156 | 0 / 153 | 0 / 375 | 0 / 30 |
| worker arguments | 0 / 133 | 0 / 98 | - | - | - | 0 / 98 | 0 / 97 | 0 / 97 | 0 / 98 | - | 0 / 166 | 0 / 165 | - | - |
| worker environment | 0 / 133 | 0 / 98 | - | - | - | 0 / 98 | 0 / 97 | 0 / 97 | 0 / 98 | - | 0 / 166 | 0 / 165 | - | - |
| relay standard output, raw (report lines) | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 |
| relay standard error, raw | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 |
| the door's copies (`diagnostics`, `output`, `onOutput`) | 0 / 9 | 0 / 9 | 0 / 9 | 0 / 9 | 0 / 9 | 0 / 9 | 0 / 9 | 0 / 9 | 0 / 9 | 0 / 9 | 0 / 9 | 0 / 9 | 0 / 9 | 0 / 9 |
| Core stand-in standard error | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 |
| worker frames (lines of its standard output) | 0 / 879 | 0 / 674 | - | - | - | 0 / 653 | 0 / 651 | 0 / 655 | 0 / 671 | - | 0 / 1021 | 0 / 1010 | - | - |
| worker log (`worker.jsonl`) | 0 / 3 | 0 / 3 | - | - | - | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 3 | - | 0 / 3 | 0 / 3 | - | - |
| worker files (audio manifest, media) | 0 / 9 | 0 / 9 | - | - | - | 0 / 6 | 0 / 6 | 0 / 6 | 0 / 6 | - | 0 / 9 | 0 / 9 | - | - |
| temporary files that appeared or changed during the run | 0 / 3 | 0 / 187 | 0 / 131 | 0 / 64 | 0 / 138 | 0 / 81 | 0 / 3 | 0 / 3 | 0 / 3 | 0 / 2 | 0 / 4 | 0 / 3 | 0 / 3 | 0 / 2 |
| regular files or folders held by a descriptor of the relay (`lsof`) | 0 / 119 | 0 / 48 | 0 / 41 | 0 / 3 | 0 / 39 | 0 / 38 | 0 / 21 | 0 / 39 | 0 / 1 | not sampled | 0 / 56 | 0 / 54 | 0 / 372 | 0 / 26 |
| new core files under `/cores` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

`-` = no worker runs in the case (a probe pushes nothing; J, M and N end before a push). No door error existed in these 42 runs (every start message was taken); a door error is searched in row 159.

Thin cells, said plainly: in I, J and D the relay lived for milliseconds (2, 3 and 3 process samples in three runs); the text places of those cases are complete, the process places are a handful of readings. The slowed camera was not used there: I ends at the worker's gate, J has no camera, D is the unslowed probe beside C.

What `ps` showed of the relay in every sample: ONE word (the program path) and 0 words of environment. Of the worker: 9 words (its switches and two paths of the run folder), 0 of environment. Of the stand-in: 4 words and its inherited shell environment, with 0 occurrences.

Files counted APART because they are the doubles' own and not a place of the product: the test camera's journal `camera.jsonl` names its own stream path once per run (54 in the 69 runs of both rows); the control pusher's FFmpeg trace and the harness' own result file hold the control's address and are removed after each worker run, as row 41 does.

## 4. The cases the row names

**The special-character account authenticates** (B, D): 3 of 3 record runs (HEVC, sets in band) with exit 0, one `ingest_connected`, 0 gate refusals, a file of 1.5 MB; 3 of 3 probe runs with the probe line. Requests at the camera per run: 1 without an answer, 4 with an accepted Digest answer, 0 refused, 0 of the Basic scheme.

**The parent killed during a retry wait** (the case row 43 left open). The camera drops the stream after 60 pictures; the relay says `camera_lost` and waits 2 s before its first try; 0.70 to 0.71 s into that wait the parent is killed with `SIGKILL`.

| | K: through the door (Node parent) | L: the observer holds the relay's pipes |
|---|---|---|
| relay alive in the wait, before the kill | 3 of 3 | 3 of 3 |
| time from the kill to "no relay process" | 47, 27, 60 ms | 3, 69, 12 ms |
| relay alive 6.5 s later | 0 of 3 | 0 of 3 |
| lines added to the camera's journal after the kill (a late try would add some: the tries were due 1.3 s and 3.3 s after it) | 0, 0, 0 | 0, 0, 0 |
| bytes on standard output after the kill | not observable (the pipes died with the parent) | 0, 0, 0 |
| bytes on standard error after the kill | not observable | 191, 191, 191: the relay's own exit line, word `STOPPED`, fixed shape, 0 occurrences |
| both pipes at their end after the kill | - | 2, 48, 5 ms |
| the worker | its file of the first leg closed, exit 0, control recorded | the same |

In K the exit code is not observable (no parent is left to wait for it); L shows what the relay does: it takes the end of its input as the order to stop. The 27 to 69 ms are the resolution of the poll (`ps`), not the relay's (row 43: 50 ms by construction).

**A relay stopped at the 25 s bound** (M). The camera sends pictures and no keyframe for 45 s, so the open is still under way at the bound. The stand-in does what the adapter does at `CAMERA_OPEN_BOUND_MS` (`onvif-relay.ts:338`): `kill('SIGKILL')` through the door, then waits for the end. In 3 of 3 runs: relay alive when the bound fired at 25.0 s; ended by `SIGKILL` 2, 3, 2 ms later; nothing pushed, nothing on standard output, 0 bytes on either stream after the kill; 0 relays left. 372 process samples over the 75 s.

**An aborted open** (N): the same kill 1.5 s into the open. 3 of 3: ended by `SIGKILL` in 2, 3, 2 ms; 0 relays left.

**Survivors**, counted over the whole host by the relay's absolute path after every run, and by the harness' own count of the run's process groups and listeners: 0 and 0 in 42 of 42 runs. No relay had to be killed by a run's clean-up.

## 5. Commands (repository root, command sandbox off)

```sh
# one run = one hold of the heavy-host lock; <case> from `... cases`, <n> = 1, 2, 3
/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
    python3 -B apps/capture-worker/test-fixtures/row044_e12_search.py run <case> <n>

# as run for this record
for n in 1 2 3; do for c in $(python3 -B apps/capture-worker/test-fixtures/row044_e12_search.py cases); do
  /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
      python3 -B apps/capture-worker/test-fixtures/row044_e12_search.py run $c $n >> .cache/row044-e12/batch.log 2>&1
done; done

python3 -B apps/capture-worker/test-fixtures/row044_e12_search.py summary     # the table of section 3 and the result line
```

A run ends itself after 300 s without a verdict (it never holds the lock longer). Results: `.cache/row044-e12/runs/<case>_<n>/result.json` (counts only), git-ignored, 64 MB with the media.

Every run of the record was the FIRST run of its case and number after the fixture's last change, except that four single runs were made earlier while the fixture was being written (probe twice, wrong password and record with a re-open once each; they passed, with 0 occurrences, and were overwritten by the 42). One earlier run hung in the fixture itself (it opened the harness' microphone pipes as files) and was stopped by hand after 6 minutes with the lock held: nothing of the product was involved, the fixture was corrected.

## 6. What is NOT proven here, and where it goes

| Not observed | Why | Goes to |
|---|---|---|
| The relay's memory (a debugger, a memory dump of the same user) | out of the row; S13-02 (c) | row 141 (not dumpable, read from the process table), `9A/H-01` |
| The relay's own core-file limit and file-size limit as numbers | macOS has no reader for the limits of another process; the door's refusal for a parent whose limit is not 0 and the empty file are row 159's | row 141, `9A/H-01`, `9A/H-24` |
| Core files written to disk | `/cores` showed 0 new files; no relay was made to crash (a crash on macOS writes a diagnostic report into the user's library, outside this task's area) | row 141 |
| Linux: `/proc/<pid>/cmdline`, `/proc/<pid>/environ`, the journal of a service unit | no Linux host | row 141 (the same fixture runs on doubles) |
| A real camera's answers (a realm, a nonce or a description that carries the account back) | doubles only | `9A/H-10` to `H-12`, `H-23` |
| The Core's own log sink, audit trail and persisted errors with the relay behind the real adapter | the adapter is registered nowhere before the lift; row 46 searched them at adapter level (61 texts, 0) | rows 85 / 88, gate M6 |
| An output a relay writes in the instant between two samples of `ps` | the arguments and the environment of a process cannot change after its start on this platform, so a sample is a reading of the same facts | - |

## 7. Driver decisions (for the controller to confirm)

1. **The relay was started by the real door inside a Node stand-in, with a read-only tap on `spawn`**, not by the Python double of rows 41 to 153: "exactly as the Core starts it", and a parent that can really be killed. The tap adds a listener and changes no argument.
2. **The 25 s bound and the aborted open were run at the door** (`kill('SIGKILL')` at 25,000 ms and at 1,500 ms), not through `onvif-relay.ts` with its reader and database: the adapter's own bound on a manual timer is row 46's T-1; what was open was the real relay's end, and that is what was counted.
3. **The parent-killed case was run twice**, because through the door nothing the relay writes afterwards can be read.
4. **No relay was made to crash** to look for a core file.
5. **The refusal cases use the camera's `slow-answers` switch (1.2 s per answer)** so that the relay can be sampled while it holds the account.
6. **A new fixture file was edited once by a script and afterwards with the Edit tool only** (section 8).

## 8. Files

New, test code only: `apps/capture-worker/test-fixtures/row044_e12_search.py`, `apps/capture-worker/test-fixtures/row044_door_parent.mts`. Docs: this record, `delegation_progress/row_044.md`; one line each in `delegation_progress/file_claims.md` and `file_requests.md` (information for row 141, not blocking).

The Edit-only rule was kept for every existing file. One deviation on a file of this row: `row044_e12_search.py`, written minutes before and never committed, was changed once by a scripted replace (six replacements, each asserted to match exactly once) before its first full run; every later change of it was made with the Edit tool. No product file, no existing fixture and nothing under `apps/capture-worker/src` or `build` was written. Nothing was committed, staged or stashed.

---
*Generated: 2026-10-13*
