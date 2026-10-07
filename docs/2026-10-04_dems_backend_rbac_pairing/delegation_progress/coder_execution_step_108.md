# coder-execution, step 108 (row W86): README Live-mode run guide

| Field | Value |
|---|---|
| Status | **complete** |
| Started / ended | 2026-10-06 05:30 / 05:55 WIB (runs: main 05:46:13-05:46:37, lane 05:47:58-05:48:51) |
| Report | `implementation/86_readme_live_mode.md` (Tier 2) |
| Write scope kept | `README.md` only (190 lines added, 0 removed against `acaff20`) plus this row's documents and `assets/86_*` |

## Files created or changed

- `README.md` (modified; pre-image `.cache/rollback/W86/README.md.pre`, SHA-256 `bac3dabd…a3cc`; after `b04b4904…1918`)
- `implementation/86_readme_live_mode.md`
- `delegation_progress/coder_execution_step_108.md` (this file)
- `implementation/assets/86_w1_live_login.png`, `86_w2_live_dashboard.png`, `86_w3_switch_dialog.png`, `86_w4_simulated_login_after_switch.png`, `86_m1_live_login_lane1.png`, `86_m2_simulated_login_lane1.png`
- `implementation/assets/86_run_main.log`, `86_run_lane.log`, `86_device_session.log`, `86_browser.json`, `86_pg_status_0537.txt`, `86_pg_init_refusal.txt`, `86_db_reset.txt`, `86_lock_status_0538.txt`, `86_readme.diff`
- `implementation/assets/86_run_main.sh.txt`, `86_web_step.sh.txt`, `86_cdp-main.mjs.txt`, `86_run_lane.sh.txt`, `86_device_w86.sh.txt`, `86_scan_secrets.mjs.txt`
- scratch `.cache/w86/**` (git-ignored)

## Verification (quoted in the report §6)

- `git diff acaff20 -- README.md | grep '^-' | grep -v '^---' | wc -l` → `0`; `1 file changed, 190 insertions(+)`
- Live section lines 219-350: `http://127.0.0.1:5173` on 3 lines; `localhost` only in two "never `localhost`" warnings; `http://localhost` / `localhost:<port>` URLs 0
- AC-B-92: line 227 (C1), line 228 (C4); Indonesian line 10
- Count-only credential scan (README, pre-image, 40 W86 files): `TOTAL matches: 0`; demo password 4 → 4; old PIN 5 → 5; user's PIN 0

## Commands run (pass) and exceptions

Run once, passing: `pg:status` (0), `pg:init` (1, the documented refusal), `db:create` (0, exists), `db:migrate` (0, nothing applied), `db:seed` (1, the documented ALREADY_SEEDED refusal), `db:status` (0), `db:reset` (0, once), `start:server` (4420 dems_demo flag off), health curl, `lsof` + `kill -TERM` (graceful), `DEMS_DEMO_CONTROLS=1 start:server` (flag on), `DEMS_CORE_PORT=4421 start:server` (lane 1), `DEMS_CORE_PROXY_PORT=4420 VITE_DEMS_CORE_MODE=live npm run dev:web` + browser at `http://127.0.0.1:5173` (sign-in 200, LIVE dashboard, sign-out 204, switch to Simulated, `localStorage.removeItem`), `device-session.sh` lane form (exit 0), force-stop, `core=LIVE` launch (LIVE Login, paired as DEV-0001), `core=SIMULATED` launch (ended Simulated), `emulator-user-lock.sh status`, `emulator -list-avds`.
Exceptions: `pg:start` / `pg:stop` → W90; `pg:remove-data`, `pg:remove`, `avdmanager delete … dems2_*` → documented only; `emulator-user-lock.sh setup/unlock/remove`, `emu finger touch` → user-only; `mobile:reverse` and `dev:mobile` exercised in the lane form (device tcp:4420 → host 4421, Metro 8083).

## Blockers

None. Device step not locked (keyguard false throughout; lock status identical before and after).

## Findings and decisions for the controller

- **F86-1** `package.json:26-27` (`emulator`, `emulator:phone`) still name the old AVDs; F45 gave their fix to W86, but this brief allowed only `README.md`. README line 158 warns; the scripts-only edit needs a slot.
- **F86-2** The old lock value remains in five original README lines (additions-only); each has a correction next to it; the user's PIN is printed nowhere.
- **F86-3** `am start -W` `Status: timeout` on a cold Metro while the app opens (re-confirms initialization/06 F-8); README line 313.
- **F86-4** `.locks/vite.pid` holds a stale PID (73328); untouched.
- **F86-5** The C1 notice on the web Login sits in the collapsed demo-operators disclosure (read from the DOM; never expanded, so no screenshot shows the password).
- **F86-6** `dems_demo` after this row: audit head 90, lineage 1 row, auth_sessions 6, paired_devices 0 — the base for W90, W94 to W98.
- **DV-1** four browser screenshots instead of one; **DV-2** one `cd` into the workspace root itself in the first `pg:status` call (no effect); **DV-3** `02_plan.md` tracking and `status_tasks.md` not updated (outside the write scope; the controller records the row).
