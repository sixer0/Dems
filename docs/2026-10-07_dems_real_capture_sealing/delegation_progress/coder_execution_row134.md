# coder-execution — row 134 (local camera source helper, R-11)

Status: **needs-review** (code and automated checks complete; two rulings and two pin requests open; `M4-LOCAL-CAM-1` is the user's step). Date 2026-10-09.

Implementation note: `docs/2026-10-07_dems_real_capture_sealing/implementation/65_r11_local_camera_helper.md`.

## Files created (all under `apps/core-server/src/capture/adapters/local/`)

- `process-door.ts`, `camera-helper-args.ts`, `device-list.ts`, `helper-program.ts`, `errors.ts`, `camera-helper.ts`, `camera-adapter.ts`, `leftover.ts`, `index.ts`
- `__tests__/camera-helper.test.ts`
- `__tests__/e2e/local_camera_e2e.py`, `__tests__/e2e/print-camera-args.ts`

## Shared file edited (one additive edit, Edit tool)

- `apps/core-server/test/static/credentials.test.ts` — the second pinned process door, by name (`LOCAL_HELPER_DOOR`).

## Not touched

`apps/capture-worker/**`, `src/capture/ipc.ts`, `src/capture/adapters/**` outside `local/`, row 135's files inside `local/` (`mic-*.ts`, `pipe-files.ts`, its tests), any frozen file, any lockfile. No commit. No dependency.

## Checks

| Check | Result |
|---|---|
| `M4-LOCAL-AV-1` | 2 + 2 runs PASS (max error 0.03-0.05 ms vs the 2 ms bound); 2 + 2 negative-control runs FAIL as required; 1 run PASS on the libx264 fallback |
| `M4-LOCAL-WORKER-1` | helper sockets: 0 LISTEN, 0 UDP, 1 TCP to 127.0.0.1:<plan port>, in all 9 runs; nothing written under `apps/capture-worker/` (the tree's diff there is other rows') |
| `M4-SEC-HELPER-1` | 32 unit tests pass (name rule, crafted names, program path rule, argument table, leftovers) |
| `M4-SEC-PRIV-1` | 0 media in `git status`, 0 under `docs/`, no local-device recording exists, no viewing or permission tool used |
| `M4-LOCAL-CAM-1` | **not run — user-attended** (note §6: one command, what the user sees and clicks) |

## Open items for the controller

1. D-134-1: spec erratum — the pipeline needs `-fps_mode passthrough -enc_time_base 1/90000`; the spec's line as printed fails the AV bounds.
2. D-134-2: SEC35-43 as written refuses `/opt/homebrew/bin/ffmpeg` on this Mac (`/opt/homebrew/bin` and `Cellar` are group-writable). Ruling needed before the adapter can open the device in a session.
3. D-134-4: folder name `local/` vs the spec's `local-device/`.
4. Two requests in `file_requests.md` (09:43:39Z): pins of `src/capture/__tests__/static.test.ts` (2 tests red from this row's door until applied) and of `src/capture/adapters/__tests__/static.test.ts`.
5. H-18 (permission / busy texts) unverified; `GENERATED` table not run through the worker.
