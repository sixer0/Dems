---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: W86 (blueprint step 108; plan row 101)
date: 2026-10-06
agent: coder-execution
source_plan: docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md (row W86)
status: complete
tier: 2
---

# W86: README Live-mode run guide

## 1. Result at a glance

| Item | Result | Evidence |
|---|---|---|
| Write scope | `README.md` only, **190 lines added, 0 removed** against `acaff20` (19 hunks). No other tracked file written | §2; `git diff --stat acaff20 -- README.md` → `1 file changed, 190 insertions(+)` |
| Additions only | `git diff acaff20 -- README.md \| grep '^-' \| grep -v '^---' \| wc -l` → **0** | §6.1 |
| Console address in the Live section | The Live section (lines 219-350) names `http://127.0.0.1:5173` on 3 lines; `localhost` occurs only inside "never at `localhost`" warnings (2 lines); `http://localhost` or `localhost:<port>` URLs: **0** | §6.2 |
| AC-B-92 sentences (C1, C4 of SR-63) | Lines 227 and 228 | §6.3 |
| Credential values | Count-only scan of the three credential files' secret values in README, its pre-image, every W86 script, log and asset: **TOTAL matches: 0**. Published values unchanged: demo password 4 → 4 occurrences; old emulator PIN 5 → 5; the user's current emulator PIN 0 | §6.4 |
| Every new README command | Run once and passing, or named as an exception (pg:start / pg:stop → W90; the two removals, the AVD deletes and the user-only lock actions → documented only) | §3 |
| Web console in Live mode | Opened at `http://127.0.0.1:5173` in headless Chromium; sign-in 200 as the seeded Supervisor; dashboard LIVE; sign-out 204; Data mode switch to Simulated through its dialog | §4.1; `assets/86_w1..w4_*.png` |
| Device step | `dems2_phone` on lane 1 (backend 4421, `dems_lane_1`): `core=LIVE` → LIVE Login "Core online", "paired as DEV-0001"; `core=SIMULATED` → Simulated Login; device-session exit 0; lock status identical before and after | §4.2; `assets/86_m1_*.png`, `86_m2_*.png` |
| Left behind | Ports 4420, 4421, 5173, 8083, 9397 free (05:50:58); `.locks/core-server.pid` and `core-server.lane1.pid` empty; no reverse rule on emulator-5554; PostgreSQL still running (PID 19121), never stopped | §7 |

## 2. What was added (README line ranges after the edit; the file has 487 lines)

| Lines | Section | What | Why (source) |
|---|---|---|---|
| 10-11 | Ringkasan (Indonesian) | Bullet "Mode Live": the order of commands, `http://127.0.0.1:5173` (not `localhost`), the two AC-B-92 sentences in Indonesian. Bullet "Koreksi emulator": `dems2_*` names; the PIN of line 8 belongs to the old `dems_*` AVDs; the user's lock helper; the value not printed | bilingual structure kept; F45, D63 DN-6 |
| 23-24 | What this is (table) | Rows for `apps/core-server` and `scripts/pg` | plan §14.1 |
| 27 | What this is | "That describes Simulated mode ... In Live mode the Core server is the Core" (correction next to line 26) | initialization/06 §15 style correction |
| 49-50 | Quick start, demo values table | Correction row for the emulator PIN (old AVDs only); row "Live mode pairing code" (portal-issued, one time) | F45; spec 14.1 (pairing code 300 s, single use) |
| 65-66 | Prerequisites table | Row "AVDs in use since 2026-10-04" (`dems2_*`, ports); row "PostgreSQL (Live mode)" (embedded-postgres 18.4.0-beta.17, allowScripts) | D63; `package.json` dependencies |
| 86-87 | Prerequisites | Where provisioning and the new emulators are recorded | initialization/04, /06 |
| 113 | Start | "These three commands run Simulated mode" | |
| 127 | Start, mobile manual | `mobile:reverse` now also maps `tcp:4420` (its comment on line 118 names two ports) | `apps/mobile/package.json` `reverse` script |
| 140-141 | Start, scripted device sessions | `DEMS_AVD_PREFIX` (default `dems2_`), wake + dismiss, exit 77 (locked → the user's `unlock`), exit 69, PID files; `DEMS_CORE_HOST_PORT` lane mapping with the exact lane-1 command; `core=` deep links | `device-session.sh:1-90`; D63, D70 |
| 154-155 | Emulator networking | Boot `-avd dems2_phone` etc.; the `dems_*` names boot the old locked AVDs; `emulator -list-avds` | initialization/06 §15 rows 130-136 |
| 158 | Emulator networking | `npm run emulator` / `emulator:phone` name the old AVDs: do not use them | F45, F-12 (the `package.json` edit itself is out of this row's write scope, F86-1) |
| 160 | Emulator networking | Correction next to the PIN-unlock line: old AVDs only; on `dems2_phone` / `dems2_tablet` the user runs `emulator-user-lock.sh unlock`; no agent types a PIN | D70; memory rule |
| 180-192 | Emulator networking | New block "Screen lock and fingerprint on the `dems2_*` emulators" with the four helper commands (status / setup / unlock / remove), the current state (phone and tablet locked, phone2 lock-free), exit 77 for agents, the trade-off | D70 FU-DN2; initialization/06 §17.3 |
| 198 | Stop | Live mode: Ctrl-C / `kill -TERM`, `npm run pg:stop` | |
| 217 | Demo scenarios | Correction next to the presenter note: in Live mode both screens share one Core | |
| 219-350 | **New section `## Live mode`** | Intro (development-host mode; 0.1.0 packages stay Simulated); **Read this first** (C1 sentence l.227, C4 sentence l.228, console at `http://127.0.0.1:5173` never `localhost` l.229, the three credential files by name and role only l.230, sandbox note); **Ports** table; **1** PostgreSQL init / status / start / stop; **2** create / migrate / seed / status and reset (migrate lock, refusals, kept tables); **3** Core server (plain, demo flag, health, boot checks, stop, lane port); **4** web console Live (proxy, preselection vs stored choice, session lifetime, mock-core for Simulated sign-in); **5** pairing and the app in Live mode (reverse, deep links, `Status: timeout` note, pairing once per database, unpair / revoke, back to Simulated); **6** switching modes table; **Known limits in Live mode** (F69 + `sessionNew.live.coreLinkHint` text, W48-F4, the four-tab sentence of D144(3) / F79, R-C3, R-C4, R-C5, R-D2, R-E5 of 83 §P2.5, the demo flag); **Remove** (`pg:remove-data`, `pg:remove`, what each deletes, the uninstall never run, browser / app / reverse leftovers, pointer to plan §14) | plan row W86; spec SR-63, AC-B-67, AC-B-92, 14.1; plan §14, §15; 83 §P2.5; D144, D146, D153, D184, D185; F45, F69, F79, W48-F4 |
| 427-443 | Troubleshooting (table rows appended) | First boot of a fresh `dems2_*` AVD 36-71 s; Live: `pg:status` exits 2 / 3 / 4; `pg:init` refusal; boot-check stop (B-1, B-3, B-6); `DEMS_CORE_PORT` refusal; "Live mode needs another address"; "Core server unreachable" (console and app); `DEMS_CORE_PROXY_PORT` refusal; pre-check blocked on the Core link; demo controls disabled; `db:seed` already seeded; `db:reset` database in use; `device-session.sh` 77 and 69 | messages read in `scripts/pg/status.mjs`, `init.mjs`, `apps/core-server/src/index.ts`, `config.ts`, `db/schema/boot-checks.ts`, `plugins/db/index.ts:60`, `db/seed/seed.ts:304`, `db/reset/errors.ts:87`, `apps/core-web/vite.config.ts`, `packages/shared/src/i18n/en/common.ts` |
| 465-468 | Rollback (inside the code block) | `avdmanager delete avd -n dems2_tablet / dems2_phone / dems2_phone2` | initialization/06 §12, §15 row 278-281 |
| 480-481 | Rollback | Pointer to **Live mode → Remove** | |
| 487 | Licences and known issues | Backend task folder; Known limits pointer; credential files generated locally, never printed | |

Pre-image: `.cache/rollback/W86/README.md.pre` (SHA-256 `bac3dabd…a3cc`, equal to `acaff20`'s README: `git diff --quiet acaff20 -- README.md` exit 0 before the first edit). After: `README.md` SHA-256 `b04b4904ec2af878228740d22530e92718bf5b068eb291a9c093da5d40a71918`. Full diff of the added lines: `assets/86_readme.diff` (`git diff -U0`, no context lines).

## 3. Command-to-output table (every new README command)

All runs on 2026-10-06 (WIB). Database commands only against `dems_demo`. Full outputs in `.cache/w86/out/` and the assets named.

| # | README command (line) | Time | Exit | Output summary | Verdict |
|---|---|---|---|---|---|
| 1 | `npm run pg:status` (248) | 05:37:50, 05:46:13 | 0 | `server RUNNING, PID 19121 (127.0.0.1:4432, "ready", connect probe: open)`; HA-1..HA-4 PASS (HA-4 SQLSTATE 28P01); modes 700/600; key names only; `pg:status: OK, running` | PASS (`assets/86_pg_status_0537.txt`) |
| 2 | `npm run pg:init` (247) | 05:46:13 | 1 | Binaries SHA-256 recomputed, T2 PASS (18.4), CR-7 six paths ignored by `.gitignore:70`, then `refused: already provisioned, or partly provisioned (.data/postgres, .data/pg.pwfile, .data/pg.owner.env, .data/pg.env). Nothing was changed.` | PASS: the documented behaviour on an initialised host (`assets/86_pg_init_refusal.txt`) |
| 3 | `npm run pg:start` (249) | not run | | | Exception by the brief: another agent used the cluster; the stop / start pair is executed by **W90**'s clean-state rebuild |
| 4 | `npm run pg:stop` (250, 198) | not run | | | Same: **W90** |
| 5 | `npm run db:create -- --database dems_demo` (259) | 05:46:13 | 0 | `dems_demo already exists (owner dems_owner, encoding UTF8, locale C); nothing to do.` | PASS (idempotent) |
| 6 | `/usr/bin/lockf -k .locks/db-migrate.lock npm run db:migrate -- --database dems_demo` (260) | 05:46:14 | 0 | schema version before 1 (dbc-2); `no pending migration; nothing was applied.`; after 1 (dbc-2) | PASS (idempotent) |
| 7 | `/usr/bin/lockf -k .locks/db-migrate.lock npm run db:seed -- --database dems_demo` (261) | 05:46:14 | 1 | `the database dems_demo is already seeded (seeded_at 2026-10-04T03:28:35.448Z). Nothing was written. Seeding again is a reset.` `NOT SEEDED (ALREADY_SEEDED)` | PASS: the documented refusal on a seeded database; the fresh-cluster seed is W90's |
| 8 | `npm run db:status -- --database dems_demo` (262) | 05:37:59, 05:46:15, 05:46:16, 05:46:37 | 0 | schema 1 (dbc-2), 4 migrations, ledger matches; audit head 91 → 83 (after reset) → 90 (end) | PASS |
| 9 | `/usr/bin/lockf -k .locks/db-migrate.lock npm run db:reset -- --database dems_demo` (272) | 05:46:15 | 0 | chain discarded (91 rows), epoch 3 → 4, kept tables carried (auth_sessions 5, paired_devices 0, ...), `SCENARIO_LOADED is audit row 83`, done in 341 ms, `OK: dems_demo is reset` | PASS, run once as allowed (`assets/86_db_reset.txt`) |
| 10 | `npm run start:server` (280) | 05:46:16 | (stopped, npm exit 0) | listening after 0.75 s; `"port":4420,"database":"dems_demo","demoControls":false` | PASS |
| 11 | `curl -s http://127.0.0.1:4420/api/v1/health` (282) | 05:46:17, 05:46:36 | 0 | `{"status":"ok","service":"dems-core-server","version":"0.2.0","apiVersion":"v1",...,"ws":{"path":"/ws",...},"ready":{"database":true,"engine":true}}` | PASS |
| 12 | `lsof -nP -iTCP:4420 -sTCP:LISTEN` and `kill -TERM <pid>` (287) | 05:46:35, 05:46:36 | 0 | `node 19357 ... TCP 127.0.0.1:4420 (LISTEN)`; `kill -TERM 19357` → log `shutdown requested`, `shutdown complete`, npm exit 0; likewise PID 19604 | PASS |
| 13 | `DEMS_DEMO_CONTROLS=1 npm run start:server` (281, 439) | 05:46:35 | (stopped, npm exit 0) | `"port":4420,"database":"dems_demo","demoControls":true`; health 200 | PASS |
| 14 | `DEMS_CORE_PORT=4421 npm run start:server` (288) | 05:47:59 | (stopped, npm exit 0) | `"port":4421,"database":"dems_lane_1","demoControls":false`; health 200 (run with `env -u DEMS_DEMO_CONTROLS` in front, to be sure the flag was off) | PASS |
| 15 | `DEMS_CORE_PROXY_PORT=4420 VITE_DEMS_CORE_MODE=live npm run dev:web` (293) | 05:46:17 | (stopped) | `VITE v8.3.1 ready in 244 ms`, `Local: http://127.0.0.1:5173/`; health through the dev proxy 200; Vite log lines with "error": 0 | PASS |
| 16 | Open `http://127.0.0.1:5173/` and sign in (296) | 05:46:17-05:46:35 | driver 0 | §4.1 | PASS |
| 17 | `localStorage.removeItem('dems.core.mode.v1')` (349, Remove) | 05:46:35 | | in the page: before `SIMULATED`, after `null` | PASS |
| 18 | `npm run dev:mobile` (306) | 05:48:00 | | Existing command of Start (line 107), repeated in step 5. Exercised as the device session's Metro (`start:lane`, the same `expo start --localhost`) on lane port 8083 | PASS (lane form) |
| 19 | `ANDROID_SERIAL=emulator-5554 npm run mobile:reverse` (307) | 05:48:00 | | **Exercised with the lane's port**: the device session's `DEMS_CORE_HOST_PORT=4421` mapped `host-16 tcp:4420 tcp:4421` (plus `tcp:8081 tcp:8083`, `tcp:4400 tcp:4400`), read with `adb reverse --list`. Not run literally: it would have pointed device `tcp:4420` at host 4420 and `tcp:8081` at 8081 inside the lane session | PASS (lane form, as the brief directs) |
| 20 | `adb -s emulator-5554 shell am force-stop com.dems.demo.tablet` (308) | 05:48:01 | 0 | | PASS |
| 21 | `adb -s emulator-5554 shell 'am start -W ... "demsdemo:///login?core=LIVE&motion=off" ...'` (309) | 05:48:01 | 0 | `Status: timeout` (cold Metro bundle, finding F86-3); `runtime.live.ready` after 10 s; prefs `{"coreLinkSource":"LIVE"}`; app requests `GET /api/v1/pairing/device 200`, `GET /api/v1/auth/status 200`, `GET /api/v1/auth/session 401` (principal device); screencap: LIVE Login, "Core online", "Core: DEMS-IR-01 • paired as DEV-0001" | PASS (`assets/86_m1_live_login_lane1.png`) |
| 22 | `adb -s emulator-5554 shell 'am start -W ... "demsdemo:///login?core=SIMULATED&motion=off" ...'` (316) | 05:48:20 approx. | 0 | `Status: ok`; `runtime.sim.hydrated` after 2 s; prefs `{"coreLinkSource":"SIMULATED"}`; screencap: Simulated Login "paired (simulated)" | PASS (`assets/86_m2_simulated_login_lane1.png`) |
| 23 | `METRO_PORT=8083 DEMS_CORE_HOST_PORT=4421 apps/mobile/scripts/device-session.sh phone '<commands>'` (141) | 05:48:00-05:48:50 | 0 | serial emulator-5554 (`dems2_phone`), Metro 8083, cap 600 s; cleanup removed its rules (`adb reverse --list` empty afterwards) | PASS (`assets/86_device_session.log`) |
| 24 | `apps/mobile/scripts/emulator-user-lock.sh status` (183) | 05:38:04, 05:47:58, 05:48:50 | 0 | phone `dems2_phone` PIN, fingerprint 1, keyguard false; phone2 NONE / 0; tablet PIN / 1; identical before and after | PASS (`assets/86_lock_status_0538.txt`) |
| 25 | `apps/mobile/scripts/emulator-user-lock.sh setup / unlock / remove` (184-186, 160, 442) | not run | | | **User-only** by D70 and the emulator security rule; the script refuses without a terminal (77); no agent runs them |
| 26 | `~/Library/Android/sdk/emulator/emulator -list-avds` (154) | 05:38:04 | 0 | `dems2_phone`, `dems2_phone2`, `dems2_tablet`, `dems_phone`, `dems_phone2`, `dems_tablet` | PASS |
| 27 | `npm run pg:remove-data`, `npm run pg:remove` (343-344) | not run | | | **Documented only** (brief; W90 runs remove-data under its own rules; the uninstall is GP-02 / D17, written not executed) |
| 28 | `zsh -l -c 'avdmanager delete avd -n dems2_*'` (466-468) | not run | | | **Documented only**: destructive, the user's decision |
| 29 | `-avd dems2_phone` boot form (154), `adb -s <serial> emu finger touch 1` (191) | not run | | | The emulators were running (booting is `device-session.sh`'s, agents never boot from their own shell); the fingerprint touch is the user's |

Commands that the new lines only refer to and that were already in the README (`npm run dev:mock`, `npm run build:android`, `adb -s emulator-5554 reverse --remove-all`) were not re-run.

## 4. Live checks

### 4.1 Web console, main instance (`assets/86_browser.json`, `86_run_main.log`)

Headless Chromium 153.0.8010.12 (`chrome-headless-shell`, devtools on 127.0.0.1:9397, `--host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"`, so no `localhost` or other name could be resolved), fresh temporary profile (removed at the end). Driver `assets/86_cdp-main.mjs.txt`, adapted from W64's.

| Step | Observed |
|---|---|
| Login at `http://127.0.0.1:5173/login` | `page-login` shown; Data mode selector `data-mode=LIVE` (label "Data mode", Live pressed); demo notice (DOM text, disclosure NOT expanded): "Published demo credentials for synthetic accounts on this local demo. They are not a secret."; no "Live mode needs another address"; requests `GET /api/v1/auth/session 401`, `GET /api/v1/auth/status 200`, `GET /api/v1/health 200` (`86_w1_live_login.png`: footer "dems-core-server 0.2.0, Database Ready, Engine Ready, Core link Online, Mode Live") |
| Sign-in through the form, seeded SUPERVISOR `andi.pratama` | `POST /api/v1/auth/sign-in 200`; `/dashboard`, shell `data-core-mode=LIVE`, chip "LIVE"; no script-visible cookie (httpOnly) (`86_w2_live_dashboard.png`) |
| Sign-out | `POST /api/v1/auth/sign-out 204`; Login shown |
| Switch to Simulated | real mouse click on `login-mode-SIMULATED` → dialog "Switch to Simulated mode? You will be signed out and the console reloads. Simulated data and Live data are separate." → confirm → reload; selector `SIMULATED`, stored key `SIMULATED`, no API request (`86_w3_switch_dialog.png`, `86_w4_simulated_login_after_switch.png`) |
| README clean-up statement | `localStorage.removeItem('dems.core.mode.v1')`: before `SIMULATED`, after `null` |
| Console errors / exceptions | none in any step |
| Core server request log during the web step | `GET /api/v1/auth/session 401` ×1, `GET /api/v1/auth/status 200` ×2, `GET /api/v1/health 200` ×5, `POST /api/v1/auth/sign-in 200` ×1, `POST /api/v1/auth/sign-out 204` ×1; credential-shaped values in both server logs 0; error / fatal lines 0 |

### 4.2 Device, lane 1 (`assets/86_run_lane.log`, `86_device_session.log`)

Lock `.locks/core-server.lane1.lock`, then `device-session.sh phone` (`METRO_PORT=8083`, `DEMS_CORE_HOST_PORT=4421`, `DEVICE_SESSION_MAX_SECONDS=600`). No lane reset, no `db:*` command on `dems_lane_1`, no sign-in, no tap, no `uiautomator dump`, nothing on a keyguard; `dems2_phone2` and `dems2_tablet` untouched. Ended with the `core=SIMULATED` launch (prefs `SIMULATED`). Lane backend request log: `GET /api/v1/auth/session 401 principal=device`, `GET /api/v1/auth/status 200 principal=device`, `GET /api/v1/health 200` ×2, `GET /api/v1/pairing/device 200 principal=device`; demo operations 0; credential-shaped values 0; JS-log credential lines 0.

## 5. Inputs read

`masterplan/02_plan.md` row W86, §4, §14, §15; `masterplan/01_specs.md` §14.1, SR-63, AC-B-67, AC-B-92; `README.md` (pre-image in full); root and `apps/core-server` `package.json` scripts; `scripts/pg/init.mjs`, `start.mjs`, `stop.mjs`, `status.mjs`, `remove-data.mjs`, `remove.mjs`, `lib.mjs` (main, constants); `apps/core-server/src/config.ts`, `index.ts`, `db/commands/cli.ts`, `create.ts`, `migrate.ts`, `database-names.ts`, `db/seed/cli.ts`, `db/reset/cli.ts`; `apps/core-web/vite.config.ts`, `src/runtime/core-mode.ts`, `features/login/mode-selector.tsx`, `auth-card.tsx`; `apps/mobile/scripts/device-session.sh` (header), `emulator-user-lock.sh` (header), `src/runtime/debug.ts`, `features/settings/core-link-switch.tsx`, pairing and settings i18n; `packages/shared/src/i18n/en/common.ts`, `login.ts`, `session-new.ts`; `implementation/83_contract_closeout.md` §P2.5; `decisions/decisions.md` D63, D70, D120, D144, D146, D147, D153, D184, D185, F45, F60, F69, F79; `test/04_pairing_lifecycle.md` W48-F4; `initialization/06_lock_free_emulators.md` §12, §15, §16, §17.3; `implementation/82_mobile_settings.md` §7 (device recipe).

## 6. Verification (quoted)

### 6.1 Additions only

```
removed lines vs acaff20: 0
 README.md | 190 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 190 insertions(+)
```

Markdown tables: no row changes its column count (awk pipe-count scan, no output).

### 6.2 The Live section names `http://127.0.0.1`, not `localhost`

```
Live section: lines 219-350
console address lines with http://127.0.0.1:5173 in the Live section: 3
lines with 'localhost' in the Live section:
  +219 offset: 11:- **In Live mode the console is opened at `http://127.0.0.1:5173`, never at `localhost`.** ...
  +219 offset: 78:Open **`http://127.0.0.1:5173/`** (never `localhost`). ...
any http://localhost or localhost:<port> URL in the Live section: 0
```

### 6.3 The two AC-B-92 sentences

- Line 227: "**The seeded accounts use published demo credentials for synthetic accounts on a local demo.** Live mode seeds the same three operators with the same password as the demo credentials table in Quick start, and both Login screens say so. They are not a secret: the Live sign-in demonstrates the mechanism, it does not protect the data." (C1)
- Line 228: "**Live mode is for loopback only.** Every listener binds `127.0.0.1`: PostgreSQL (4432), the Core server (4420, lanes 4421-4423), Vite (5173, lanes 5176-5178) and Metro. Do not expose any of them on another interface, through a port forward or through a tunnel. Before anything leaves loopback, the seeded password must be replaced and the demo disclosure removed." (C4)
- Indonesian summary, line 10, carries both in one sentence.

### 6.4 No credential value that is not already published

`assets/86_scan_secrets.mjs.txt` reads the three files in process and counts fixed-string occurrences of the three secret values (the `pg.pwfile` line, `DEMS_PG_OWNER_PASSWORD`, `DEMS_PG_APP_PASSWORD`), printing counts only:

```
0  README.md  (pg.pwfile (dems_admin): 0; pg.owner.env DEMS_PG_OWNER_PASSWORD: 0; pg.env DEMS_PG_APP_PASSWORD: 0)
0  .cache/rollback/W86/README.md.pre  (...: 0; ...: 0; ...: 0)
TOTAL matches: 0
```

and over every file of `.cache/w86/` and every `assets/86_*` (40 files): `TOTAL matches: 0`. Published values: the demo operator password 4 → 4 occurrences in README (the Live section refers to the Quick start table and does not repeat it); the old emulator PIN token 5 → 5 (nothing removed, nothing added); the user's current emulator PIN 0 in README and 0 in W86 scratch; the demo password in W86 logs 0 files (the driver redacts it). The Simulated pairing code `482913` 2 → 3 (one mention in the new "Live mode pairing code" row, a value already published).

## 7. State after the row

| Item | State |
|---|---|
| Ports | 4420, 4421, 5173, 8083, 9397: no listener (05:50:58). 4432: PostgreSQL PID 19121, as before; never stopped |
| Lock-state files | `.locks/core-server.pid` and `.locks/core-server.lane1.pid` written during the runs and emptied at the end (the holder protocol of plan §4.1) |
| `dems_demo` | reset once: audit head 91 → 83 (seed) → **90** after the two server boots and one web sign-in / sign-out; lineage 1 row (the discarded chain: reset_no 1, epoch 3, 91 rows); auth_sessions 5 → 6; paired_devices 0. The next holder of 4420 (W90, W94 to W98) counts relative to this |
| `dems_lane_1` | not reset, no `db:*` command; four device-principal reads and two health reads by the lane backend |
| Emulators | `dems2_phone`: app force-stopped by device-session's cleanup, last mode SIMULATED, no reverse rule; lock status identical before and after; phone2 and tablet untouched |
| Tracked files | `README.md` only (`git status --porcelain` shows ` M README.md` among the paths checked; `package.json` untouched) |

## 8. Findings

| # | Finding | Evidence | Routed to |
|---|---|---|---|
| F86-1 | `package.json:26-27` (`emulator`, `emulator:phone`) still boot the old `dems_tablet` / `dems_phone` from a snapshot. F45 assigned their correction to this row, but this row's brief limits writes to `README.md`; the README now says not to use them (line 158). The scripts-only edit is still open | F45; initialization/06 F-12 | Controller: a scripts-only `package.json` slot (no install) |
| F86-2 | The old lock value stays printed in five lines of the README (8, 43, 147-159 block, 141): the additions-only rule forbids deleting them. Each now has a correcting line next to it; the user's current PIN is printed nowhere | §6.4; D63 DN-6 | The user's decision on the old AVDs (D63 DN-7); a later row with rewrite permission if wanted |
| F86-3 | `am start -W` printed `Status: timeout` on the first launch against a cold Metro while the app opened normally (re-confirms initialization/06 F-8). README line 313 tells the reader to check the screen | §3 row 21 | none |
| F86-4 | `.locks/vite.pid` holds PID 73328, which no longer exists (stale before this row). Left untouched: not this row's file | `ps -p 73328` empty at 05:37 | Controller (housekeeping) |
| F86-5 | The web Live Login shows the C1 disclosure inside the collapsed "Demo operators" disclosure; expanding it would also show the published password, so the driver read the notice's DOM text only and never expanded it | §4.1 | W90 reads the screens for SR-63 C1 to C3 |
| F86-6 | After the reset and two boots, `dems_demo` sits at audit head 90 with auth_sessions 6 (the boot sweep appended the "Sign-in expired" rows visible on `86_w2_live_dashboard.png`, the D146 F-4 pattern) | §7 | W90, W94 to W98 briefs |

## 9. Decisions and deviations

| # | Decision / deviation | Why |
|---|---|---|
| DN-1 | The Live section refers to the Quick start credentials table instead of repeating the password | AC-B-92 asks for no credential value beyond what is published; a reference keeps the count unchanged |
| DN-2 | Corrections of now-false lines are added beside them (11 places, §2), never by rewriting a line | additions-only rule of the brief |
| DN-3 | No test commands (`test:db`, `test:pg-scripts`) were added to the README | Each new command must be run once, and `test:db` would have run on the cluster another agent was using; out of the row's Live-mode scope |
| DN-4 | `npm run mobile:reverse` and `npm run dev:mobile` were exercised in their lane form inside the device session | the brief: the paired emulators belong to their lanes; the literal command would have redirected the session's rules |
| DV-1 | Four browser screenshots instead of one (Live Login, Live dashboard, switch dialog, Simulated Login after the switch) | evidence for the "switch modes" commands; none shows the password |
| DV-2 | The first `pg:status` call was written as `cd /Users/gsp-budi/Documents/DEMS && npm run pg:status`: a `cd` into the workspace root, which is already the working directory; no effect, every later command used none | recorded honestly |
| DV-3 | `masterplan/02_plan.md` tracking and `status_tasks.md` were not updated by this row | the brief limits writes to `README.md` and this row's documents; the controller records the row |

## 10. Rollback

```sh
# README: back to the state before this row (equal to acaff20's README)
cp -p .cache/rollback/W86/README.md.pre README.md
# or: git checkout acaff20 -- README.md
shasum -a 256 README.md     # bac3dabd916a39433e6bfe055b2d9157d87ca5d19743cb4323aaf12dd24fa3cc
# dems_demo after this row's reset: returns to the seed with the README's own command (Core server stopped)
/usr/bin/lockf -k .locks/db-migrate.lock npm run db:reset -- --database dems_demo
# scratch
rm -rf .cache/w86
```

The reset of `dems_demo` cannot be undone to the pre-reset chain: the discarded chain is kept only as its lineage row (reset_no 1, 91 rows, head `8cd683b6…`).

## 11. Files

| File | Kind |
|---|---|
| `README.md` | modified (190 lines added) |
| `docs/2026-10-04_dems_backend_rbac_pairing/implementation/86_readme_live_mode.md` | this report |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_step_108.md` | progress file |
| `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/86_w1_live_login.png`, `86_w2_live_dashboard.png`, `86_w3_switch_dialog.png`, `86_w4_simulated_login_after_switch.png` | browser screenshots (1440 × 900) |
| `.../assets/86_m1_live_login_lane1.png`, `86_m2_simulated_login_lane1.png` | device screencaps (1080 × 2424) |
| `.../assets/86_run_main.log`, `86_run_lane.log`, `86_device_session.log`, `86_browser.json`, `86_pg_status_0537.txt`, `86_pg_init_refusal.txt`, `86_db_reset.txt`, `86_lock_status_0538.txt`, `86_readme.diff` | logs and outputs |
| `.../assets/86_run_main.sh.txt`, `86_web_step.sh.txt`, `86_cdp-main.mjs.txt`, `86_run_lane.sh.txt`, `86_device_w86.sh.txt`, `86_scan_secrets.mjs.txt` | the scripts as run |
| `.cache/rollback/W86/README.md.pre`; `.cache/w86/**` | pre-image; scratch (git-ignored) |
