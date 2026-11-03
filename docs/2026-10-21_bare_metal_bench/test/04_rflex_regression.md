# Row 115: R-FLEX regression (finished on host .73)

Date: 2026-10-22. Controller: Claude Code on the Windows workstation over SSH (alias `dems`), decisions D29, D30, D32.
Host: Ubuntu 24.04.1, Node 26.12.1 (signature-verified, `~/.local/dems-dev/node-26.12.1`), npm 11.20.0, `npm ci --ignore-scripts` + the reviewed `@embedded-postgres/linux-x64` symlink step only.
Logs: `test/04_rflex_regression_logs/` - `h_*` (the 9 suites, run 1), `r_*` (R-FLEX tree) and `b_*` (pre-R-FLEX baseline) with vitest JSON reports, `attempt1/` (first comparison, before the dev cluster existed). `*.log` is git-ignored (`.gitignore:49`); the `.meta`, `.json` files and this report carry the evidence.

## Method
The Mac run (handoff §3) left only `*.log.meta` on the host, and the suites carry macOS assumptions (`/usr/bin/lockf`, `/usr/sbin/lsof`, umask 022, a built capture worker). So the suites were re-run here and every suite that is not green is compared, test by test (vitest JSON `fullName`), with the same suite on a baseline tree on the same host: `~/dems-baseline-r115` = `git worktree` of e05a1567 + the row-80 restore point (`tracked.diff` applied, `untracked.tar.gz` without `docs/*`; `git status --porcelain` equals `porcelain.txt` minus docs, AppleDouble `._*` files removed). A failure is an R-FLEX regression only if the baseline does not have it. Temporary host shims for the macOS paths: `/usr/bin/lockf` (-> flock) and `/usr/sbin/lsof` (-> /usr/bin/lsof), recorded in `status_tasks.md`, removed before row 20.

## Results
| Suite | Command | R-FLEX tree | Baseline | Failing only in R-FLEX |
|---|---|---|---|---|
| s1 typecheck | `npm run typecheck` | rc 2: 1 error, `apps/mobile/src/runtime/live-stall-link.test.ts(28,12) TS2339 unref on number` | the same error | 0 (pre-existing on Linux; mobile, untouched by R-FLEX). `typecheck -w @dems/core-server`: rc 0 after row 143 |
| s2 lint | `npm run lint` | rc 0 | - | 0 |
| s3 shared | `npm run test -w @dems/shared -- --maxWorkers=2` | rc 0 | - | 0 |
| s4 core unit | `npx vitest run --root apps/core-server --project unit --maxWorkers=2` | 9034 tests: 8973 pass, 47 fail | 8955: 8894 pass, 47 fail | **0** (47 in both) |
| s5 core db | `npx vitest run --root apps/core-server --project db --maxWorkers=2` | 3360: 3114 pass, 171 fail | 3356: 3110 pass, 171 fail | **0** (171 in both) |
| s6 core web | `npm run test -w @dems/core-web -- --maxWorkers=2` | 2505: 2504 pass, 1 fail (box-check CW-01) | Mac baseline `b6`: same | 0 (pre-existing, as on the Mac) |
| s7 mobile | `npx -w apps/mobile jest --maxWorkers=2` | rc 0 | - | 0 |
| s8 host scripts | `bash scripts/host/test_host_profile_scripts.sh` | 141 passed, 0 failed (shellcheck section SKIPPED: not installed) | - | 0 |
| s9 dev session e2e | `DEMS_DEV_SESSION_E2E=1 vitest ... development-session-e2e.db.test.ts` | 4: 2 fail | 4: 2 fail | **0** |

Before the run, the open regression of handoff §3 (`card-listing.test.ts` 22 + `usb-audio-macos.test.ts` 1) was fixed in tests only by row 142 (`implementation/88_row142_regression_fix.md`): audio adapter tests 345/345. After row 118's blocking finding F1, row 143 changed `factory-scan/service.ts` (+3 tests that failed first): capture-config unit 368/368, capture-config db (factory-scan, network, camera-network) 37/37.

## The failures present in BOTH trees (Linux environment, not R-FLEX)
- Capture worker program absent (not built: rows 28-31 build FFmpeg 9.0.2 and the worker): s4 15, s5 90 - `boot.test.ts`, `session-capture.db.test.ts`, `fence.db.test.ts`, ...
- umask 0002 of the account: 3 (`DIRECTORY_WRITABLE` / `DIRECTORY_OWNER` expectations).
- Load timeouts: s4 1, s5 4 (as row 109 warned).
- D28 static pins: 4 (`capture/__tests__/static.test.ts`).
- Other platform differences (macOS socket snapshot forms, `reserved-ids`, two ws-discovery flood/socket-count tests = review F-2): the rest; identical test names in both trees.
These are inputs for the install rows (worker build) and for a later Linux-test task; none is caused by R-FLEX.

## Routing
None needed: 0 R-FLEX-only failures. Host load per step is in each `.meta` (`load=`). Each suite ran once per tree; the fixes were followed by targeted re-runs only.
