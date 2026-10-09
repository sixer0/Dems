# Row 135 - local microphone source helper (R-11)

Status: complete for everything that needs no microphone. `M4-LOCAL-MIC-1` (the real device) is NOT run: it is a user-attended step, below.
Spec: `masterplan/05_capture_architecture_spec.md` §A.7.1 (ML-1..ML-8), §A.6.4 (HL-2..HL-14), §G.1 (G-R6, G-R12, G-R14). Decisions D74, D76, D86 (C-7), D87, D94, D95.

## What was built (all new files in `apps/core-server/src/capture/adapters/local/`)

| File | What |
|---|---|
| `mic-helper-args.ts` | The one argument table: device input `-f avfoundation -i none:<name>`, generated input (`TONE_880`, `TONE_440`, `lavfi sine`), the single output line `-vn -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -y <pipe>`, the pre-check list. Two computed values only: the device argument (passes `isUsableDeviceName`, always one `none:<name>` argument) and the pipe path (`isMicPipeArgument`, :74; `micPushArguments` :98; `micPrecheckArguments` :107). |
| `pipe-files.ts` | The only file-system file: lstat, mkdir, realpath, unlink (`createPipeFiles` :39). |
| `mic-pipe.ts` | `preparePipe` (:97): ids checked by `micPipePath`, path checked as an argument, run and session directory real, own, closed to others, resolved session dir exactly `<resolved run>/<sessionId>`, leftover pipe of the server's user removed, anything else (regular file, link, directory, stranger's pipe) refused with `OPEN_FAILED/TARGET_REFUSED`, `/usr/bin/mkfifo -m 600` through the door (exclusive), read back as FIFO, owner, 0600. `removePipe` (:148) removes only the server's own pipe. `runBounded` (:46). |
| `mic-helper.ts` | `createMicHelper` (:120): `prepare` (list -> exact-name rule -> program rule -> pipe; starts no helper), `LocalMicStream.start` (:182; list re-read, launch with empty env, settle time), `close` (:222; SIGTERM, SIGKILL after grace, pipe removed, idempotent), `precheck` (:259; the one short open), `presence`, `livePids`, `closeAll`. Uses row 134's door, `helperProgramRefusal`, `selectLocalDevice`, `LocalSourceError` and `errorOfHelperExit`: one door, one error mapping. |
| `mic-adapter.ts` | `createLocalMicAdapter` (:70): `AudioInputAdapter` of kind `LOCAL_DEVICE` (registry of `REAL_DEVELOPMENT` accepts it; production/simulated refuse it), `enumerate` (:101, device list only), `open` (:106, returns the stream, no helper yet), `openSources()` for the "is on" report, `onSourceLost`, `closeAll`. |

Start order: `open()` returns the pipe path (the plan needs it); `stream.start()` launches the helper after the worker has accepted the plan (ML-5), so the device is not held open earlier.

## Real vs stand-in
- Real: FFmpeg 9.0.2, `/usr/bin/mkfifo`, real FIFO, real file system, real process door, real device list parse of this Mac (`["MacBook Air Microphone"]`, exact name matches, `... 2` is `DEVICE_NOT_FOUND/NAME_ABSENT`).
- Played from a script: the FFmpeg program in the lifecycle/error-mapping tests (no device is opened by any test).
- Hypothesis H-18 stays open: the permission/busy output patterns (row 134's) were never observed on a real refusal; anything else is `OPEN_FAILED`.
- Not exercised: reading the helper's pipe by the real capture worker (`apps/capture-worker` is row 60's; nothing there was touched by this row). The pipe is the same `PCM_FIFO` kind the row-58 fixtures use. To wire at rows 136/140 and gate 70.

## Commands and results
- `npm -w apps/core-server run test -- <mic-helper-args, mic-pipe, mic-helper, mic-static tests>`: 4 files, 94 passed.
- `.../mic-helper.generated.test.ts` under `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock`, sandbox disabled (needs `ps`, loopback bind for the socket-check control): 8 passed. It runs the real helper with a generated 880 Hz tone into a real pipe and judges the bytes by numbers (tone period in sample slots): float32 LE, 48 kHz (within 0.5 %), mono. Negative control: the same pipeline with `s16le`, two channels, 44.1 kHz is refused by the same judge. `lsof -nP -a -p <helper pid> -i` is empty (control: the same call lists a UDP socket for a process that holds one). Command line = the table, environment empty. A helper blocked at an unread pipe stops on SIGTERM (measured: 1 ms) and the SIGKILL escalation is covered with a scripted process. Leftover check: found as a stranger's process, not found as the Core's own, gone after close.
- Attended-script dry run with the generated source: `local-mic-capture.ts --source generated --seconds 6` -> pass, 48,004 samples/s, 0 sockets, helper gone, format refusals none.
- Typecheck: no error in my files (errors seen in `records.test.ts`, `discovery-recording.test.ts` and `shared/api/sim-actions.ts`/`live/source/bindings.ts` belong to rows 78, 131, 66). Lint: no finding in my files.
- Red tests not mine: `src/capture/__tests__/static.test.ts` (G-R2, G-R8) and `adapters/__tests__/static.test.ts` (file list pin) are red only because the `local/` folder is not pinned yet; requests filed (three lines in `file_requests.md`). `A-5` is row 66's wiring. In the sandbox, `mic-helper.generated.test.ts` fails 2 of 8 (`ps` spawn EPERM, loopback bind EPERM): run it unsandboxed.

## Checks
| Check | Status |
|---|---|
| `M4-SEC-HELPER-1` pipe half and name half | pass: ids/path/dir/link/regular-file/stranger's-pipe refusals on the real file system (a mutation of the regular-file refusal turns two tests red); near-match, absent, ambiguous, video-only, screen-only lists -> `DEVICE_NOT_FOUND`, only the list process ran, no pipe, no directory |
| `M4-LOCAL-WORKER-1` | helper half pass (0 sockets, writes only the 0600 pipe under the run directory); worker half: this row edited nothing under `apps/capture-worker` (the modified files there are row 60's) |
| `M4-SEC-PRIV-1` | media in `git status` 0, media under `docs/` 0, `.data/` ignored and 0 tracked files; this row's command log has no use of an image/audio reading tool and no permission-database or settings tool (static rule in `mic-static.test.ts`, with planted controls); generated tone only, numbers only |
| `M4-LOCAL-MIC-1` | NOT RUN (user-attended) |

## Findings for the controller
1. **The Homebrew FFmpeg path fails the production program rule** (`/opt/homebrew/bin/ffmpeg` -> `DIRECTORY_WRITABLE`: `/opt/homebrew/bin` and `Cellar` are group-writable, `admin` 775). `DEMS_CAPTURE_HELPER_FFMPEG` must name a copy in a private folder. I made one for verification: `.data/helpers/ffmpeg` (copy of the 9.0.2 binary, git-ignored, runs; passes the rule). Row 136's boot step should state this.
2. A run directory with a double slash, `@`, `;`, `$` or other characters outside `A-Za-z0-9._ +:/-` is refused at `open` (a trailing slash is fine). `TMPDIR`-style paths ending in `/` joined with `/` hit this during development.
3. Two empty session directories remain in `.data/run/capture/` (`SES-ATTENDED-*`) from the generated dry runs; no media, no pipe. Not deleted by me; the helper removes the pipe, not the session directory (row 71 owns that).
4. FFmpeg's `-re` allows a 0.5 s initial burst on a generated input; rate figures are read from the second second on. Chunk sizes seen on the generated input were 4,096-8,192 bytes (21-43 ms); the real device's chunk size (H-20) is still unknown.

## To wire when row N lands
- 134: add the microphone exports to `local/index.ts` (request filed); pin `local/` in the two static tests (requests filed).
- 136: register `createLocalMicAdapter` (id from the next free `MIC-NN`), pass the helper program and `<dataDir>/run/capture`; feed `helper.livePids()` into `leftoverHelperPids` as the own set; `onSourceLost` into the microphone-loss path; the fake mic of slot 2 uses `source: { kind: 'GENERATED', tone: 'TONE_880' }` through `createMicHelper().prepare`.
- 71: call `stream.start()` after the worker accepts the plan, `stream.close()` on every exit path, `closeAll()` on shutdown.
- 140 / gate 70: the through-the-worker variant of `M4-LOCAL-MIC-1`.

## USER-ATTENDED STEP: `M4-LOCAL-MIC-1` (2 runs, +1 at the gate)
Run in YOUR OWN Terminal (not inside an agent sandbox: there the device list is empty). From the repository root, one command:

```
npx tsx apps/core-server/src/capture/adapters/local/__tests__/e2e/local-mic-capture.ts --program "$PWD/.data/helpers/ffmpeg" --source device --seconds 10
```

(If `.data/helpers/ffmpeg` is missing: `mkdir -p .data/helpers && cp /opt/homebrew/Cellar/ffmpeg/9.0.2/bin/ffmpeg .data/helpers/ffmpeg`.)

What you will see and must do:
1. The script prints the program-rule verdict and reads the device list (opens nothing).
2. It then opens the microphone once for 0.2 s. macOS shows a permission question naming the app that started the command (your Terminal application; the wording and buttons vary by macOS version, typically "<app> would like to access the microphone" with Don't Allow / OK). Click the allow button yourself. The run waits up to two minutes for your answer. If you refuse: System Settings > Privacy & Security > Microphone is yours to change; no agent touches it.
3. The orange microphone indicator is on for about 10 s while it reads the pipe. Speak or tap near the Mac during that time (the level check needs a sound above -50 dBFS).
4. It prints one JSON line of numbers (bytes, samples per second, peak/rms dBFS, longest run of exact zeros, chunk sizes and arrival gaps, socket count, helper gone) and `PASS` or `FAIL: <reason>`. Nothing is written to disk but the pipe, which is removed. Nothing is played, kept or uploaded. Paste the JSON line back; it contains no audio content.
Exit code 0 pass, 1 failed check, 2 refused (nothing opened).
