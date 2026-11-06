---
task_id: 2026-10-07_dems_real_capture_sealing
row: 134
date: 2026-10-09
agent: coder-execution
status: needs-review
---

# Row 134 — local camera source helper (R-11)

Tier 3. The camera was **not opened** by this row: no agent touched the camera, TCC, System
Settings or `tccutil`. `M4-LOCAL-CAM-1` is the user-attended step of §6.

Paths below are relative to `apps/core-server/src/capture/adapters/local/` unless they start with
`apps/` or `docs/`.

## 1. What was built

| File | What it is |
|---|---|
| `process-door.ts:75` (`startHelperProcess`), `:179` (`inspectProgram`) | The second pinned process door (D95; `ipc.ts` is closed). `spawn` once, `shell: false` (`:88`), absolute program only, environment empty unless handed over, stdin closed, stdout and stderr read by code into 64 KiB buffers, every live child killed when the server exits. Also reads owner and mode bits on the way to a program (facts only) |
| `camera-helper-args.ts:95` (`cameraPushArguments`), `:107` (pre-check), `:40-48` (tables) | THE argument tables. Four computed values, each held to a shape: the plan's `ingestUrl` (`isLoopbackIngest`, `:63`: `LOOPBACK_RTSP_URL` + port 8554-8564), `S` twice (`:70`), the device name |
| `device-list.ts:28`, `:53`, `:67` | Parse of `-list_devices`; `isUsableDeviceName`; `selectLocalDevice` = exactly one listed entry equals the name **and** no other entry begins with it |
| `helper-program.ts:32` | The path rule of SEC35-43 as a pure function of the door's facts |
| `camera-helper.ts:181` (`open`), `:227` (`close`), `:253` (`precheck`), `:106` (`errorOfHelperExit`), `:92` (patterns) | Lifecycle: target check -> program rule -> device list -> start with `S` = server clock; settle 1.5 s; a refused connection is retried once after 500 ms with the list read again (HL-5); stop = `SIGTERM`, `SIGKILL` after 3 s (HL-8); an exit during the session is told once |
| `camera-adapter.ts:56` | `createLocalCameraAdapter`: the `CameraAdapter` of row 65 with `kind: LOCAL_DEVICE`, `hasOpener: true`; plus `presence()`, `precheck()`, `openSources()` (the `sourceOpen` indicator), `closeAll()`, `onSourceLost` |
| `errors.ts` | `LocalSourceError`: the five codes `DEVICE_NOT_FOUND`, `PERMISSION_DENIED`, `DEVICE_BUSY`, `OPEN_FAILED`, `HELPER_EXITED` + a closed `reason` list. No helper text, name, address or path in it |
| `leftover.ts:17` | `leftoverHelperPids`: counts helper processes this Core did not start (exact program path, via `/bin/ps` through the door). Kills nothing |
| `index.ts` | Barrel for row 136. Not re-exported by the adapter layer, registered nowhere |
| `__tests__/camera-helper.test.ts` | 32 unit tests (no camera, no FFmpeg start) |
| `__tests__/e2e/local_camera_e2e.py`, `print-camera-args.ts` | `M4-LOCAL-AV-1` and `M4-LOCAL-CAM-1` through the real worker; imports the row-60 harness read-only; the argument list is printed by the product table, never restated |
| `apps/core-server/test/static/credentials.test.ts:109-113` | Shared allowlist: one additive edit (the second door, by name) |

Why a device name needs more than equality: the avfoundation input of FFmpeg takes the first device
whose name **begins** with the text, reads a leading number as an index, knows `default` / `none`,
and matches `Capture screen N` by its own pattern. So a name that could be read as any of those is
refused (`NAME_NOT_ALLOWED`) and a list in which another entry begins with the name is refused
(`NAME_AMBIGUOUS`), both before any process but the list call.

## 2. Real vs stand-in

| Thing | State |
|---|---|
| Helper pipeline (encoder, GOP, clock options, RTSP/TCP push) into the worker | **real**, measured on a generated picture (§3) |
| Opening this Mac's camera | **not run** (user-attended, §6) |
| `PERMISSION_DENIED` / `DEVICE_BUSY` patterns (`camera-helper.ts:92-93`) | **hypothesis H-18, unverified**: narrow guesses; anything else is `OPEN_FAILED`. To be pinned from the text of a real refusal, if the user chooses to deny once |
| Frame size 1280x720 / 30 (H-16), VideoToolbox keyframe interval on a real camera (H-15) | not verified without the camera. On the generated picture VideoToolbox gave a keyframe exactly every 30 frames in every run |
| `GENERATED` table (development fake camera of slot 2, `:42`) | built, **not run through the worker** by this row (the AV check uses its own generator so that it has a truth) |
| Encoder fallback | an option (`encoder: 'X264'`), not an automatic retry |

## 3. Results

Device list (sandbox off, opens nothing): 4 video entries (`MacBook Air Camera`, `MacBook Air Desk
View Camera`, `Capture screen 0`, `Capture screen 1`), 1 audio entry; the call ends with exit code
251 — its text is what counts.

### M4-LOCAL-AV-1 — H-17, without the camera

Command (sandbox off, heavy-host lock, ports 8559 / 8561):

```
/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock python3 apps/core-server/src/capture/adapters/local/__tests__/e2e/local_camera_e2e.py av <name> --case zero|pm80 [--without <options> --expect-fail --must-fail-on regression_bound_2ms,product_bound_40ms]
```

The product argument list with **only** the avfoundation input section swapped for an FFmpeg
`lavfi` picture (1280x720 nv12, 30 fps, one white frame every 3 s); two helpers, one per camera;
beeps from the row-60 fake microphone; the row-60 sample-exact analyser. Truth: a side branch of the
same filter graph logs the wall clock at which each frame left the generator; truth of an event =
beep instant (microphone manifest) − generation instant of its flash frame. The script predicts the
flash instants from the first frames and schedules the beeps at +0 / +80 / −80 ms; the prediction
was off by 5-9 ms under load (reported per run), so the truths are e.g. +77.99 ms rather than +80.00
— the measured offset is compared with the truth as generated.

| Run | Verdict | Max abs error vs truth (cam1 / cam2) | Mean offset ms (cam1 / cam2) | Load (1 min) |
|---|---|---|---|--:|
| `l134_av_zero_r1` | PASS | 0.034 / 0.040 ms | −6.18 / −5.15 | 7.9 |
| `l134_av_zero_r2` | PASS | 0.051 / 0.042 ms | −3.33 / −4.90 | 8.3 |
| `l134_av_pm80_r1` | PASS | 0.040 / 0.033 ms | +77.99 / −84.97 | 10.7 |
| `l134_av_pm80_r2` | PASS | 0.046 / 0.044 ms | +77.48 / −83.02 | 8.5 |
| `l134_neg_nowallclock_r1`, `_r2` (`-use_wallclock_as_timestamps` removed) | FAIL as required, on both bounds | 204 / 205 ms; 194 / 194 ms | | 9.1 / 8.7 |
| `l134_neg_specline_r1`, `_r2` (the line exactly as the spec prints it, see D-134-1) | FAIL as required, on both bounds | 42.9 / 38.0 ms; 40.7 / 42.4 ms | | 10.1 / 11.0 |

Every PASS run also held: both bounds (2 ms, 40 ms) as separate verdicts, 4 of 4 events per camera,
0 `no_camera_wall_clock` lines, keyframe interval 30 frames, both files decode with 0 error lines
(timestamps passed through), 0 leftover processes. Exit codes: helper 255 on `SIGTERM` (FFmpeg's
normal answer to a signal — not an error in `camera-helper.ts`), worker 0. Results:
`.cache/m3worker/l134_official/*.out`, runs under `.cache/m3worker/runs/l134_*` (git-ignored).

Trials before the series (one run each, not counted): `-output_ts_offset` removed -> error of
hours; `-start_time_realtime` removed -> 262 ms; `-enc_time_base` removed -> 16 ms (fails 2 ms,
holds 40 ms); `-fps_mode` removed alone -> the helper does not run; libx264 fallback (`--encoder
X264`) -> PASS, 0.045 / 0.027 ms. Official x264 run `l134_av_x264_pm80_r1` (one run, load 5.2):
PASS, 0.045 / 0.068 ms.

### M4-LOCAL-WORKER-1

- This row wrote nothing under `apps/capture-worker/` (no command of the row writes there; the e2e script imports the harness read-only and sets `sys.dont_write_bytecode`). **`git diff --stat apps/capture-worker/src` is not empty and cannot show that by itself**: other rows edit the worker source in the same tree. Its digest was `01373ae5…` at the start of the row (3 files: `anchor.c`, `anchor.h`, `ingest.c`, 20 insertions, 4 deletions) and `78d23e4b…` at the end — it moved during the row: `worker.h` was edited at 16:45 by another row (4 files, 101 insertions, 17 deletions at the end). The controller's per-row attribution (D95 §4) is the check that holds here.
- Socket snapshot of each helper, mid-session, `lsof -nP -a -p <helper pid> -i` (in every run above, criteria `helper_no_listening_socket`, `helper_no_datagram_socket`, `helper_one_tcp_connection_to_loopback_plan_port`): **1 row per helper: 0 LISTEN, 0 UDP, 1 TCP, both ends 127.0.0.1, remote port = the plan's**.
- Not shown: a helper that listens making the check fail (no such helper was built as a control; the criteria are computed from the `lsof` rows and would count a `LISTEN` or `UDP` row).

### M4-SEC-HELPER-1 (unit, `camera-helper.test.ts`)

`npx vitest run --root apps/core-server --project unit src/capture/adapters/local/__tests__/camera-helper.test.ts` -> 32 passed. Covered: program path refused when relative, missing, not a file, foreign-owned, group- or other-writable, or reached through a writable / foreign directory incl. a symbolic link into a writable directory (on a real temp tree); near-match name, list without the name, duplicate, prefix twin -> `DEVICE_NOT_FOUND` with **0 helper processes** (1 list call); 27 crafted names (screen capture, index, `default`, `none`, `name:0`, leading `-`, shell marks) never reach an argument; every argument is a table literal or one of the four computed values; no `0.0.0.0`, `::`, `udp`, `listen`, `@`, shell mark or screen in any list; the only locator is the loopback one; leftover helpers counted, nothing killed. Pipe-path ids are row 135's.

### M4-SEC-PRIV-1

`git status --porcelain` media-extension count 0; 0 media / image / waveform files added under `docs/`; no local-device recording exists (`.data/capture-local/` was not created); no viewing tool was used on any media (the generated runs were judged by `ffprobe` / the analyser, numbers only); no permission-database or system-settings tool in the command log.

### Workspace gates

- `npm run typecheck -w apps/core-server`: 0 errors at the end of the row (earlier in the row 2 errors of other rows' in-flight files, none in this row's).
- `npx oxlint apps/core-server/src/capture/adapters/local`: 0 findings in this row's files.
- Static guards: `test/static/*` pass for this row (`credentials.test.ts` 13 passed). **Red because of this row, by design of D95, until the two requests of §5 are applied:** `src/capture/__tests__/static.test.ts` — "imported by files of the allowlist only" and "only ipc.ts starts a process"; `src/capture/adapters/__tests__/static.test.ts` — the file-list pin. Red from other rows: `test/static/network.test.ts` and "no file of the folder opens a socket" (`camera/ws-discovery.ts:35`, row 131).

## 4. Decisions taken (for the controller)

| # | Decision | Why |
|---|---|---|
| D-134-1 | **Two options added to the spec's pipeline: `-fps_mode passthrough -enc_time_base 1/90000`** (`camera-helper-args.ts:48`). Spec §A.6.4 needs an erratum | Measured: the line as printed in the spec fails both bounds (38-43 ms constant error; trial 52-61 ms). Without them FFmpeg puts the frames on a fixed 1/30 s grid that starts at the first frame, so the wall-clock stamps are lost. With them: 0.03-0.05 ms. H-17 **holds with the pair, fails without**. The FFmpeg command-line program stays the helper; the native fallback is not needed |
| D-134-2 | **The path rule of SEC35-43 refuses the only FFmpeg on this Mac**: `/opt/homebrew/bin` and `/opt/homebrew/Cellar` are mode 775 (group `admin`), so `/opt/homebrew/bin/ffmpeg` -> `DIRECTORY_WRITABLE` (also by its real path). Implemented as specified; **a ruling is needed before row 136 / the session rows can open the device through the adapter** | Options: relax to "not other-writable, group-writable only by the server user's own admin group"; or the user removes group write from the two folders; or a configured copy elsewhere (its libraries would still load from the same tree). The e2e script starts the program directly and is not affected |
| D-134-3 | Process door = own pinned file `process-door.ts`, not a variant inside `ipc.ts` | D95 (overrides spec HL-2 / G-R12 "the allowlist does not grow") |
| D-134-4 | Folder is `adapters/local/` (brief, D95); the spec (G-R12) and row 65's `types.ts` say `adapters/local-device/` | a naming ruling before row 136 writes G-R12 |
| D-134-5 | AV check uses a generator with a side log as truth, and beeps placed after the frame grid is seen | a `lavfi` picture cannot be told when to flash from outside; the truth is exact, the injected offset is approximate (reported) |
| D-134-6 | "Playable" for these files = decodes with 0 error lines **with timestamps passed through** + boxes tile + frames in both streams. The row-60 `playable()` is reported beside it and reads FAIL in most runs | Its decode pass re-times video onto a fixed grid; frames stamped by read time jitter (13-53 ms intervals at load 8-11) and collide there. The file's own timestamps are strictly increasing. Row 70 / `M4-LOCAL-CAM-1` should use the pass-through form |
| D-134-7 | The `GENERATED` table has `,settb=1/1000000` in its graph (not in the spec) | measured: the lavfi input's time base is 1/30 s, so the wall-clock stamp would be rounded to the frame grid |
| D-134-8 | A second open of the same device -> `DEVICE_BUSY` / `ALREADY_OPEN`; a refused program or target -> `OPEN_FAILED` with a reason; an unknown failure at start is `OPEN_FAILED`, after the settle time `HELPER_EXITED` | the five codes of HL-10 stay the only codes |
| D-134-9 | Row 135's files (`mic-*.ts`, `pipe-files.ts`, two tests) appeared in `local/` during the row; not touched; this row's static test judges its own nine files | noted in `file_requests.md` |

## 5. To wire when other rows land

- **Row 136**: registers `createLocalCameraAdapter({ id: <next CAM-NN>, program: <config DEMS_CAPTURE_HELPER_FFMPEG>, now: () => app.clock.now(), timers, onSourceLost })`; boot fence; `leftoverHelperPids` at boot; G-R12 / G-R14 static rules for the folder name ruled in D-134-4; the fake camera of slot 2 from `cameraPushArguments({ source: 'GENERATED', … })` (needs one run through the worker first).
- **Row 71**: calls `openSource` when the worker reports the ingest `WAITING`, closes every handle on stop / fault / shutdown (`closeAll`), maps `onSourceLost` to the camera-loss path.
- **Pre-check rows**: `precheck()` is the first open — the place where macOS asks; `presence()` is "Search again".
- **Requests filed** (`delegation_progress/file_requests.md`, 09:43:39Z): the three pins of `src/capture/__tests__/static.test.ts`; the file-list pin of `src/capture/adapters/__tests__/static.test.ts`.
- Error logging: this folder logs nothing (static rule: `index.ts` of the capture module is the only logger). The layer above logs the code and reason of a `LocalSourceError`.

## 6. User-attended step — `M4-LOCAL-CAM-1` (2 runs here, +1 at row 70)

Run by the user, in a terminal, from the repository root (one command per run):

```
DEMS_USER_ATTENDED=1 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock python3 apps/core-server/src/capture/adapters/local/__tests__/e2e/local_camera_e2e.py cam l134_cam_r1
```

(second run: `l134_cam_r2`.) What happens:

1. The device list is read; the run stops with `DEVICE_NOT_FOUND` unless exactly one entry is `MacBook Air Camera`.
2. The worker starts on 127.0.0.1:8559; the helper opens the camera. **On the first run macOS shows "<your terminal app> would like to access the camera" — click "Allow" (older wording: "OK").** The permission belongs to the terminal application (H-19). The script waits up to 60 s for the answer.
3. The camera's green light is on for about 10 s, then goes off. A JSON result is printed: duration, frame counts, keyframe intervals, SHA-256, the helper's socket snapshot, PASS / FAIL per criterion. Numbers only.
4. The recording (at most 10 s) stays at `.data/capture-local/runs/l134_cam_r1/media/VIDEO-01.mp4` (git-ignored). No agent opens it with a viewing tool; it is deleted only on the user's instruction: `rm -r .data/capture-local/runs/l134_cam_r1`.

If "Don't Allow" is clicked: the check is recorded **"blocked: user action"**, not failed. The helper's text is then in `.data/capture-local/runs/<name>/helper1.err` — the text H-18 needs for the two patterns. To be asked again, the user changes the answer in System Settings > Privacy & Security > Camera (the user's action only).

The script refuses to run `cam` without `DEMS_USER_ATTENDED=1` (verified: "refused: `cam` opens this Mac's camera…"). Its `cam` path has never been executed.

## 7. Not proven

- Anything with the real camera (H-15, H-16, H-18, H-19, the residual sensor-to-read delay of H-17).
- The series ran at a 1-minute load of 8-11 (other drivers); the errors stayed at 0.03-0.05 ms, the frame-interval jitter is from that load.
- The worker binary under test is the tree's current build (`apps/capture-worker/build/capture-worker`, SHA-256 `8f6a98ee68512ddf…` when read mid-row), which includes other rows' in-flight source edits; it may have been rebuilt between runs.
