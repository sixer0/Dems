# Integration pass E1 - the FAKE camera's generated picture: pacing and bitrate

Date 2026-10-10. Agent coder-execution. Status: complete. No commit, no migration.
Source: row 82c finding F-82c-1 (`implementation/37c_m7_seal_fixes_demo_seed.md` section 1) and its BLOCKING request line in `delegation_progress/file_requests.md` (01:17:07Z, "WANTED, two edits").

## Already present (read first)

| Edit of the request | State before this pass | Where |
|---|---|---|
| (1) `realtime` in the lavfi graph: `testsrc2=size=1280x720:rate=30,realtime,settb=1/1000000` | PRESENT (row 140, finding 2) | `apps/core-server/src/capture/adapters/local/camera-helper-args.ts:42` (`GENERATED_INPUT`) |
| (2) `ENCODER.X264` gains `-b:v 4M -maxrate 4M -bufsize 4M` after `-bf 0` | MISSING (list ended `-g 30 -bf 0 -flags +global_header`) | `camera-helper-args.ts:45` |

## Changed

- `camera-helper-args.ts:45`: `ENCODER.X264` now `... '-g', '30', '-bf', '0', '-b:v', '4M', '-maxrate', '4M', '-bufsize', '4M', '-flags', '+global_header'`. Nothing else in the file. `GENERATED_INPUT`, `ENCODER.VIDEOTOOLBOX`, `DEVICE_INPUT` and the precheck list are untouched.
- Pin moved: `adapters/local/__tests__/camera-helper.test.ts:174` (X264 fallback slice) now states the rate.
- Pin added (new `it`, same file, after the first one): the GENERATED list holds the `realtime` graph, the `-bf 0 -b:v 4M -maxrate 4M -bufsize 4M -flags` run, no `avfoundation`; the VIDEOTOOLBOX device list holds no `-maxrate` (control that the real-camera default list did not move).
- Pin line added: `capture/fence/__tests__/fence.test.ts:410` (FAKE camera call args contain `-b:v 4M -maxrate 4M -bufsize 4M`).
- `capture/__tests__/static.test.ts` needed no edit (it reads `CAMERA_HELPER_TABLE.literals`, computed from the tables; `-maxrate` and `-bufsize` enter through the X264 spread, `4M` was already a literal).
- Not touched: `mic-helper-args.ts`, `demo-seed/source-arguments.ts` (its table already states the same rate, `-b:v 4000000 -maxrate 4000000 -bufsize 4000000`, `source-arguments.ts:49`), db files, schema pins.

## One thing to know

`ENCODER.X264` is one table for both sources. The real camera's DEFAULT encoder is VIDEOTOOLBOX (`camera-helper.ts:215`: X264 only for a generated source), so the default real-camera list did not change. The explicit DEVICE + X264 fallback list (opt-in, `--encoder X264` of the e2e harness) now also carries the 4 Mbit/s cap, which is the plan profile's rate. If that fallback must stay uncapped, the table has to be split: a design choice, not made here.

## Results (each once)

| Check | Command | Result |
|---|---|---|
| Unit, area | `npx vitest run --root apps/core-server --project unit src/capture/adapters/local src/capture/fence src/sealing-host` | first run in the sandbox: EPERM on a loopback/UDP bind in `mic-helper.generated.test.ts` (sandbox); re-run with the sandbox off: 18 files, 291 passed |
| Static guard | `... --project unit src/capture/__tests__/static.test.ts` | 49 passed |
| Typecheck | `npm run typecheck -w apps/core-server` | exit 0, no output |
| Lint | `npm run lint -w apps/core-server` (oxlint) | exit 0 |

## Measured run (generated picture only, no device)

Neither named script measures this table: `print-camera-args.ts` builds DEVICE lists only; `demo-seed.generated.test.ts` measures the demo seed's own table (`source-arguments.ts`) against a byte bound. So a throw-away script (scratchpad, not in the repo) built the list with `cameraPushArguments({ source: 'GENERATED', encoder: 'X264', ... })`, swapped only the push tail for `-f mp4 -movflags frag_keyframe+empty_moov+default_base_moof -y <file>`, and ran the project helper `.data/helpers/ffmpeg` (9.0.2) for 8 s of wall time (stopped with SIGINT as the Core stops the helper; `-t` cannot be used with `-copyts` plus wall-clock stamps: it ended in 0.07 s with an empty file).

Argument list read BEFORE the run: input `-re -f lavfi -use_wallclock_as_timestamps 1 -i testsrc2=size=1280x720:rate=30,realtime,settb=1/1000000`; no `avfoundation`; the script also refuses to start if `avfoundation` is present or `testsrc` is absent. No device opened.

| Quantity | Value |
|---|---|
| Wall time | 8.03 s |
| Video frames (second ffmpeg, `-c copy -f null`) | 240 |
| File size | 4,221,074 bytes (4.22 MB) |
| Per 2 s fragment | about 1.05 MB |
| Row 82c's figures for the same edits | 240 frames, 4,221,254 bytes |
| Before (row 82c) | 372 MB for 6 s unpaced; 7.75 MB for 8 s paced without the rate |

The helper printed one stderr line, "Resumed reading ... after a lag of 0.500s" (host scheduling jitter), no error.

## Not proven here / for the test runner

Kill matrix, seal e2e, worker e2e are NOT run (brief). Checks for the test runner: M7-REF-1, the S6 kill cells and seal-e2e, which were red with FRAGMENT_TOO_LARGE on a fast host before this edit; they should no longer see a fragment above 64 MiB. Command and locks as the runner's own brief states (heavy: `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock <command>`).
