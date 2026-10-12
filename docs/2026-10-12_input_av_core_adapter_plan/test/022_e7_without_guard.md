---
task_slug: input_av_core_adapter_plan
row: 22
work_package: WP-02 (experiment E-7 without a guard; hypothesis HA-11)
date: 2026-10-13
agent: test-expert
status: complete
tier: T2
---

# Row 22: experiment E-7 without a guard - does the FFmpeg helper end when its standard input ends, and does it survive an abrupt end of its parent

Tier 2: what was found, why it matters, how it was verified, source. **Observations only. It decides nothing**: rows 23 and 25 and the controller do. No product file was changed; only existing programs ran (the installed `ffmpeg`, the committed test camera of row 39).

## 1. Answer, per question

129 runs on this Mac (macOS, FFmpeg 9.0.2): 43 cells of 3 runs. In 129 of 129 the helper was delivering before the trigger and had not ended by itself.

| Question | Outcome observed | Runs |
|---|---|---|
| Does the helper end when its standard input **ends** (the parent closes its end of the pipe and stays alive) | **no**, with `-nostdin`, with `-stdin` and with neither: alive and still delivering 8 s later | 0 ended of 24 (two forms x three switches x 3, plus the two door-stdio forms x 3) |
| Does the helper **survive an abrupt end of its parent** (SIGKILL), standard input a pipe, its consumer alive | **yes**: alive, re-parented to process 1, still delivering at the end of the window | **survivors 30 of 30** (18 at 8 s over the three switches; 6 at 8 s and 6 at 45 s for the door-stdio forms with `-nostdin`) |
| The same with standard input `/dev/null` (what the development door does today) | **yes**, survives | survivors 12 of 12 |
| Does a broken standard-output and standard-error pipe end it (`-progress pipe:1`, the stdio of the Core's doors, parent killed) | **no** | 0 ended of 12 at 8 s, 0 of 6 at 45 s |
| How long until it ends | within the window: never, by itself. It ended only when something else happened: its **consumer** was killed at the same instant (0.05 to 0.11 s, 24 of 24), or the letter `q` was written to the pipe with `-stdin` or no switch (0.11 to 0.28 s, exit 0, 9 of 9) | - |
| Does `-nostdin` change that | only the keyboard: with `-nostdin` the letter `q` on the pipe does **not** end it (0 ended of 6). The end of the pipe ends it under no switch | - |
| Control: nothing done | still running and delivering after 8 s | 24 of 24 |

Row cell "surviving children after an abrupt end of the parent: a count": **42 of 42** runs in which the parent was killed and the helper's consumer lived (30 with a pipe as standard input, 12 with `/dev/null`); **0 of 24** when the consumer was killed with the parent. HA-11 ("the FFmpeg program does not end by itself when its standard input ends") is what was observed, 24 of 24.

"Guard needed: yes or no" is not answered here. What it rests on is in section 6.

## 2. Why it matters

Addendum 8, WP-02: the guard program "ends its child when its own standard input ends, so that the FFmpeg helper of a microphone follows the same liveness rule as the relay"; "E-7 runs once without the guard to show whether it is needed". AD-09 (3): E-7's count "0 surviving children" includes a relay stopped at its bound. Review `verification/03_plan_review.md:144`: standard input kept open as the liveness channel makes "no child outlives the Core" one mechanism on macOS and Linux. The production door keeps the pipe open (`production-door.ts:236`, stdio `pipe, pipe, pipe`); the development door gives `/dev/null` (`local/process-door.ts:96`).

## 3. What was run

Driver (git-ignored, the row's ownership is documents): `.cache/row022-e7-without-guard/e7_without_guard.py`, 353 lines, SHA-256 `0a995f99...326447a` as it stands; its header states the cases. One line was changed after the last run (the pull address is now joined from parts, so that the count-only scan finds no locator-shaped text in the file); it changes no argument.

```
# repository root, command sandbox off (127.0.0.1:8565 and :8566, a named pipe, ps / lsof); one lock hold per cell
git show HEAD:apps/capture-worker/test-fixtures/rtsp_test_camera.py > "$SCRATCH/rtsp_test_camera_head.py"   # commit 6e6707dd, SHA-256 3830d2a7...89ecfc
export ROW022_CAMERA="$SCRATCH/rtsp_test_camera_head.py"
/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
    python3 .cache/row022-e7-without-guard/e7_without_guard.py run <form> <switch> <ending> --runs 3 [--window 45]
python3 .cache/row022-e7-without-guard/e7_without_guard.py summary
```

- Program: `/opt/homebrew/bin/ffmpeg` 9.0.2. The private copy `.data/helpers/ffmpeg` has the same SHA-256 (`c8173e97...e4e1a8`); it was hashed, not run.
- The test camera is the committed file, copied out of the commit because its working copy was being edited by row 40 in this batch. It runs 320x240 H.264, Digest authentication; its one synthetic account is imported from it, never written (the helper's messages and command lines are kept with the account replaced).
- The parent is the driver's sub-command `wrapper`: it starts the helper as its child in its own process group (as Node's `spawn` without `detached`), holds the only write end of the pipe and writes nothing. The driver signals the wrapper only.
- No camera or microphone of this Mac: the audio is `-f lavfi sine`, the picture comes from the test camera's encoded clip.

### Forms (the helper's command)

| Form | Command |
|---|---|
| `mic` | `ffmpeg -hide_banner <switch> -nostats -loglevel warning -re -f lavfi -i sine=frequency=440:sample_rate=48000 -vn -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -y <named pipe>` - the quiet, generated-input and output lists of `mic-helper-args.ts:58-73`; a reader process drains the pipe. Standard output `/dev/null`, standard error a file |
| `relay` | `ffmpeg -hide_banner <switch> -nostats -loglevel warning -rtsp_transport tcp -i rtsp://<synthetic account>@127.0.0.1:8565/media/video1 -an -c copy -f rtsp -rtsp_transport tcp rtsp://127.0.0.1:8566/e7sink`; the push is received by `ffmpeg -rtsp_flags listen ... -c copy -f null -` |
| `micp`, `relayp` | the same with `-progress pipe:1` after the quiet switches (as `mic-helper-args.ts:142`) and with standard output and standard error as pipes the parent reads (the stdio of both doors). Run with `-nostdin` only |

`<switch>`: `-nostdin` (what the helper lists have today), `-stdin`, or neither.

### Endings

| Ending | What is done 1.5 s after the helper delivers |
|---|---|
| `none` | nothing (control) |
| `close` | the parent closes its end of the pipe and stays alive |
| `kill` | the parent gets SIGKILL; the consumer lives |
| `killc` | the parent and the helper's consumer (pipe reader / push listener) get SIGKILL at the same instant |
| `null` | standard input is `/dev/null`; the parent gets SIGKILL |
| `q` | the parent writes the letter `q` to the pipe and stays alive (positive control of the pipe) |

"Ended" = the helper's process is gone (or its exit was collected by the living parent), polled every 20 ms for 8 s (45 s where stated). "Still delivering" = the consumer's count grew over the last 0.6 s.

## 4. Facts per cell (3 runs each; `e/3` = helper ended within the window)

| Form, switch | `none` | `close` | `kill` | `killc` | `null` | `q` |
|---|---|---|---|---|---|---|
| `mic -nostdin` | 0/3 | 0/3 | 0/3, 3 survivors | 3/3 in 0.05, 0.08, 0.08 s | 0/3, 3 survivors | 0/3 |
| `mic -stdin` | 0/3 | 0/3 | 0/3, 3 survivors | 3/3 in 0.05, 0.07, 0.05 s | - | 3/3 in 0.13, 0.11, 0.11 s, exit 0 |
| `mic` (no switch) | 0/3 | 0/3 | 0/3, 3 survivors | 3/3 in 0.06, 0.05, 0.05 s | - | 3/3 in 0.11, 0.12, 0.11 s, exit 0 |
| `relay -nostdin` | 0/3 | 0/3 | 0/3, 3 survivors | 3/3 in 0.09, 0.08, 0.11 s | 0/3, 3 survivors | 0/3 |
| `relay -stdin` | 0/3 | 0/3 | 0/3, 3 survivors | 3/3 in 0.07, 0.07, 0.09 s | - | 3/3 in 0.28, 0.24, 0.28 s, exit 0 |
| `relay` (no switch) | 0/3 | 0/3 | 0/3, 3 survivors | 3/3 in 0.06, 0.07, 0.08 s | - | - |
| `micp -nostdin` | 0/3 | 0/3 | 0/3 at 8 s and 0/3 at 45 s: 6 survivors | 3/3 in 0.05, 0.05, 0.05 s | 0/3, 3 survivors | - |
| `relayp -nostdin` | 0/3 | 0/3 | 0/3 at 8 s and 0/3 at 45 s: 6 survivors | 3/3 in 0.08, 0.08, 0.07 s | 0/3, 3 survivors | - |

- Every survivor (42 of 42): parent process 1, state `S`, process group unchanged (the dead wrapper's), still delivering to its consumer.
- `killc`: the helper's last messages name the cause - `mic`: "Terminating thread with return code -32 (Broken pipe)", "Error writing trailer: Broken pipe"; `relay`: "Error muxing a packet", "Task finished with error code: -32 (Broken pipe)". The exit code was not collected (the parent was dead).
- `close`, `none`: the wrapper was alive at the end of the window and had collected no exit, 48 of 48.
- Helper messages otherwise: `mic` none; `relay` two warnings of the stream copy (unset timestamps, non-monotonic DTS) in every run, unrelated to the ending.
- Runs 2026-10-12T19:32:05Z to 22:29:04Z (the host slept between two batches); 1-minute load at the start of a run 0.6 to 7.4.

## 5. How it was verified

- Control per form and switch (`none`): the helper does not end by itself inside the window, 24 of 24; so an end in another cell belongs to its trigger.
- Positive control of the pipe (`q`): the helper does read the pipe when its switch lets it (9 of 9 ended, exit 0) and does not with `-nostdin` (0 of 6). So "the end of the pipe does not end it" is not a pipe that was never connected.
- The kill is abrupt and reaches the wrapper only: `os.kill(wrapper, SIGKILL)`, then the helper is looked up by its own process ID; a survivor's parent is read from `ps` (1 in 42 of 42).
- Cleanup and proof: each run ends its helper, wrapper, consumer and camera by process ID or group and records what is left: 0 processes and 0 listeners in 129 of 129. After the last run `pgrep -fl 'e7_without_guard|rtsp_test_camera_head|e7sink|mic\.pcm|row010_resumed_push|capture-worker/build/capture-worker|fake_mic'` printed nothing (exit 1) and `lsof -nP -iTCP -sTCP:LISTEN` had no row on 8559-8574.
- `node scripts/secret-scan/count-only.mjs .cache/row022-e7-without-guard`: `TOTAL: 0 in 0 file(s)` (after the one-line change named in section 3; before it the driver itself counted 1 for a format string, no value).

## 6. What makes it ambiguous

1. **Whether the helper is left depends on its consumer, not on its parent.** With the consumer alive it survives in 42 of 42; with the consumer gone it ends in 0.05 to 0.11 s in 24 of 24. In the product the consumer of the microphone's pipe and of a camera push is the capture worker, which ends on the end of its own standard input (`apps/capture-worker/src/capture_worker.c:461`, cited by the plan review; not run here). A killed Core may therefore leave no helper through that chain; this row did not run that chain, and it does not cover a helper whose consumer is not the worker, a helper started before the worker reads, or a worker that outlives the Core.
2. **macOS only.** Linux and the container build were not run (row 79, `9A/H-02`, `9A/H-24`). macOS has no parent-death signal; nothing here says what Linux does.
3. **The relay form is the FFmpeg program**, as the row's title asks, not the relay of row 41 (a program of its own, which reads its standard input as its stop order). The relay half of E-7 is row 44's.
4. **Generated sources.** The audio is `lavfi`, not `avfoundation` or `alsa`; a device input that fails when its session ends could behave otherwise. The Linux list of `mic-helper-args.ts:208` was not runnable here.
5. **Windows of 8 s, and 45 s for the two door-stdio cells.** "Survives" means alive and delivering at the end of that window; nothing longer was watched.
6. Standard input closed as a descriptor (no file at all on 0) was not a case; "ends" was a pipe at end-of-file or `/dev/null`.
7. The driver lives under `.cache/` and is in no commit. If row 25 is to reuse it, it needs a home in a row whose ownership allows one. DRIVER DECISION 1: kept out of `apps/capture-worker/test-fixtures/` because the row's profile says "docs only". DRIVER DECISION 2: the forms `micp` / `relayp`, the ending `q` and the 45 s window were added beyond the row's wording (the lists carry `-progress pipe:1` and the doors pipe standard output; a pipe that is never read proves nothing).

## 7. Rules kept

Heavy-host lock for every run, one hold per cell (8 to 40 s; 150 s for the two 45 s cells). Ports 8565 (test camera) and 8566 (push listener) on 127.0.0.1 only. Only processes of the driver were ended. No worker, no Core, no database, no `.env`, no file under `apps/` written. Written: this record, `delegation_progress/row_022.md`, `.cache/row022-e7-without-guard/` (driver, `runs/<cell>_r<n>/result.json`, `console/`, `summary.txt`, the camera's clip cache; 3.6 MB), and one copy of the committed test camera in the session scratch folder.
