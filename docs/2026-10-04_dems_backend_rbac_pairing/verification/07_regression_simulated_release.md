---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: W97 (plan step 109)
agent: verifier
date: 2026-10-07
narrative_tier: 3
form: short (D232/D233) — each check run once; no check failed or was flaky, so no extra verification run was needed
status: complete — all six criteria PASS, plus two Low traceability findings
---

# W97 — REGRESSION SC8: Simulated mode and the 0.1.0 release are unchanged

Run 2026-10-07 10:26 to 10:42 WIB. Repository `/Users/gsp-budi/Documents/DEMS`, worktree at HEAD `057fc17` plus the task's uncommitted work. Assets are under `verification/assets/07_*` (41 files).

Load (`uptime`, checked on its own): 4.53 at the start; highest 8.81 at 10:32; 3.87 at the end. It never reached 14.

## 1. Results

| # | Criterion | Command | Exit | Evidence | Result |
|---|---|---|---|---|---|
| 1a | The 61 simulator-dependent files pass (28 web, 33 mobile) | List: test files at `acaff20` that import `@dems/shared/sim` (`git show acaff20:<f> \| grep -q @dems/shared/sim`). Web: 28 (26 runnable plus the helpers `evidence/__tests__/harness.ts` and `composed/__tests__/test-utils.ts`). Mobile: 33. Saved in `07_61_files_list.txt`. Then `cd apps/core-web && npx vitest run --maxWorkers=2 <26 files>` and `cd apps/mobile && npx jest --maxWorkers=2 --runTestsByPath <33 files>` | 0 / 0 | Web `Test Files 26 passed (26)`, `Tests 322 passed (322)` (10:28:40, 32.6 s). The two helpers run inside those files. Mobile `Test Suites: 33 passed, 33 total`, `Tests: 387 passed, 387 total` (10:29:18, 23.4 s). Logs: `07_c1_web_26_runnable.log`, `07_c1_mobile_33.log` | PASS |
| 1b | Their diff against `acaff20` holds only W01's two files and recorded by-design changes | `git diff --stat acaff20 -- <61 files>`; `git hash-object` on the four protected web files | 0 | `10 files changed, 138 insertions(+), 20 deletions(-)`. W01's files print W01's recorded values (D25): `sim-fetch.test.ts` = `9e8b97c8…`, `storage-page.test.tsx` = `71f6f033…`. W01b's `dashboard.test.tsx` = `1ab07579…` (D165) and W01c's `security-audit.test.tsx` = `5470ce3f…` (D42) also match their records. Six later edits were recorded by design in gated fix logs (table 2). `07_c1_diff_61.txt` | PASS (finding F-1) |
| 2 | `shasum -a 256 -c` reports OK for every listed file | `cd release/web && shasum -a 256 -c SHA256SUMS.txt` and each `*.sha256`; the same in `release/android` | all 0 | web/SHA256SUMS.txt: 6 × OK. Six web `*.sha256`: 6 × OK. android/SHA256SUMS.txt: 8 × OK (APK and 7 licence files). `DEMS-Demo-0.1.0.apk.sha256`: OK. Extra anchor: each of the 7 artefact hashes appears in task 1's `report/report.md` (`grep -c` = 1 each). That file has not changed since commit `4b708c8`, so the checksum lists were not rewritten. `07_c2_release_shasum.txt` | PASS |
| 3 | macOS arm64 launcher, unpacked outside the workspace, prints `"ok": true` | `unzip …macos-arm64.zip` into `/tmp/claude-501/w97_launcher`; `./"DEMS Web Demo" --self-test` | 0 | `"ok": true`, `mode: "sea"`, 511 files, `hashMismatches: 0`, health 200 `shapeOk`, index 200 with CSP, WS `acceptOk`. `manifestSha256 823581db…d8a8` equals `release/web/BUILD-INFO.txt:9`. The first attempt inside the command sandbox got `listen EPERM` (the sandbox forbids binding a port, which is environmental). The second attempt ran with a per-command bypass (plan §4.1). The unpacked copy was then removed (`ls` → No such file). `07_c3_launcher_selftest.txt` | PASS |
| 4 | 19 mock-core tests pass; `git diff --stat acaff20 -- apps/mock-core scripts/release` is empty | `npm run test -w @dems/mock-core -- --maxWorkers=2` (bypass; binds 4410/4411); the `git diff` | 0 / 0 | `Test Files 4 passed (4)`, `Tests 19 passed (19)` (10:31:10). The diff printed 0 lines, and `git status --porcelain` printed 0 lines (no untracked file either). `07_c4_mock_core_tests.log` | PASS |
| 5 | `git diff acaff20 -- packages/shared/src/sim`: every change is covered by a recorded decision | `git diff --stat` and the full diff | 0 | 7 files, `169 insertions(+), 16 deletions(-)`. Each file maps to D37/D41 (W16), D53/D56/DR-07/D80 (SIM-GAP-1) or D201/D202 (FX-C). **No change lacks a recorded decision** (table 3). `07_c5_sim_diff.txt` | PASS (finding F-2) |
| 6a | Web Simulated walk on `http://127.0.0.1:5173` leaves no request line in the Core log | `node --import tsx .cache/w97/web_sim.mts` (Playwright-cache headless shell 1243, CDP port 50047 assigned by the OS, owner checked with lsof and `/json/version`, fresh profile, nothing blocked). Then `node .cache/w97/corelog.mjs <from> <to>` over `.cache/manual/main-server-w94.log` | 0 / 0 | Login selector switched to Simulated: switch confirmed 10:37:03.282, Simulated ready 10:37:05.569. Signed in as andi.pratama (SUPERVISOR), then Dashboard → Session Monitor → Evidence → Devices → sign-out; each page reached; `SIMULATED` badge visible. **Core log 10:37:05.569 to 10:37:25.743: `request lines: 0; socket lines: 0`.** On the browser side in that phase: 0 `/api/` or `/ws` requests to 5173, 0 responses ≥ 400, 0 exceptions. The heartbeat went to mock-core (`ws client connected origin http://127.0.0.1:5173` at 10:37:03.896, disconnected 10:37:25.023). The 3 request lines in the whole window (10:37:00.374 to .515: `GET /api/v1/auth/session 401`, `auth/status 200`, `health 200`) all come from the fresh profile's default Live Login page **before** the switch (see note N-1). `07_c6_web_core_window.txt`, `07_web_summary.json`, `07_web_0[1-6]_*.png` | PASS |
| 6b | Mobile Simulated walk on phone2 (emulator-5558, DEV-0005) leaves no request line | `am force-stop`; `am start -W … -d 'demsdemo:///login?core=SIMULATED&motion=off'`; Simulated sign-in on the app's Login form; taps on the Sessions, Evidence, Devices and Home tabs | 0 | Login reads "paired (simulated)", prefs `{"coreLinkSource":"SIMULATED"}`. All four tabs captured with simulator data. **Core log 10:37:58.201 to 10:39:17.212: `request lines: 0`.** The one line, `socket closed device:DEV-0005` at 10:37:59.039, is the earlier LIVE process ending at the force-stop, 0.8 s after the window began. `07_c6_mobile_sim_core_window.txt`, `07_mob_01/02_*.png`, `07_mob_sim_*.png` | PASS |
| 6c | HEARTBEAT mode with mock-core leaves no request line | `npm run dev:mock` (127.0.0.1:4400); `adb -s emulator-5558 reverse tcp:4400 tcp:4400` (README:126); deep link `demsdemo:///home?core=HEARTBEAT` (N-2); the same four tabs | 0 | prefs `{"coreLinkSource":"HEARTBEAT"}`. Device log: `Tablet link CONNECTED … heartbeat: 'LIVE'`. mock-core: `ws client connected` at 10:39:49.539. **Core log 10:39:45.425 to 10:40:21.591: `request lines: 0; socket lines: 0; other lines: 0`.** `07_c6_heartbeat_core_window.txt`, `07_c6_heartbeat_device.txt`, `07_mob_hb_*.png`, `07_c6_mock_core.log` | PASS |
| 6d | Positive control (the log does see this phone) | Relaunch `demsdemo:///login?core=LIVE&motion=off` | 0 | Within 3 s: `socket opened device:DEV-0005` and 3 request lines (`auth/session 401`, `auth/status 200`, `pairing/device 200`) at 10:41:10.6. So the silence in 6b and 6c is real, not a blind log. `07_c6_cleanup.txt` | control OK |
| KI-07 | Marker count stays 62 | `grep -rhoE "SIM-GAP-M[0-9]+-[0-9]+" apps/mobile/src \| sort \| uniq -c` (plan §17); `grep -rcE` form; `git grep` at `acaff20` | 0 | **13 IDs / 62 markers**, the same as `acaff20` (13 / 62). The `grep -rc` form gives 27 files / 61 lines because one line holds two markers. `07_ki07_count.txt` | PASS |

## 2. The 61 files — every change against `acaff20`

| File | Change | Covered by |
|---|---|---|
| `apps/core-web/src/test/sim-fetch.test.ts` | W01 fixed clock | D25; hash `9e8b97c8…` matches |
| `apps/core-web/src/features/storage/__tests__/storage-page.test.tsx` | W01 fixed clock | D25; hash `71f6f033…` matches |
| `apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx` | W01b calendar sweep | D25 (W01b slot), D165; hash `1ab07579…` matches |
| `apps/core-web/src/features/security-audit/__tests__/security-audit.test.tsx` | W01c: `getAllByRole` → `await findAllByRole` | D42; hash `5470ce3f…` matches |
| `apps/core-web/src/features/login/__tests__/login-model.test.tsx` | FXR-W W92-5: the log entry no longer carries the error message or stack | `gateway_check/15b_fxr_web.md:76` ("the old assertions pinned the defect"); gated by D247 |
| `apps/mobile/src/features/pairing/pairing-model.test.ts` | FX-M1: new eight-case `leaveTargetFor` table (additions only) | `gateway_check/11c_efix_mobile_link.md:73,285`; gated by D203 |
| `apps/mobile/src/features/pairing/pairing-screen.test.tsx` | FX-M1 E2E-S-1: the signed-out hand-off expects `dismissAll` + `replace('/')`; new signed-in case | `11c_efix_mobile_link.md:73,269`; D201 (partition), D203 |
| `apps/mobile/src/features/session-new/session-new-screen.test.tsx` | FX-M2 R2: the TECHNICIAN goes Home; the old case split in two | `11d_efix_mobile_screens.md:89`; D201 ruling R2, D205 |
| `apps/mobile/src/features/settings/settings-screen.test.tsx` | CF-M2 R-P-3: the System rows go through `useOpenTabRoot` | `12b_cf_mobile_screens.md:17,68`; D214 partition, D216 |
| `apps/mobile/src/features/storage/storage-screen.test.tsx` | FXR-M W93-17/R16: the one-toast count is pinned | `15c_fxr_mobile.md:47`; gated by D247 |

The other 51 files are byte-identical to `acaff20`.

## 3. `packages/shared/src/sim` — every changed file and its decision

| File | Diff | Content | Decision(s) | Committed? |
|---|---|---|---|---|
| `vocabulary.ts` | +27 | 3 permissions, 9 audit types, 9 categories (additive) | D37, D41 (W16); AC-B-62 | yes, `b90a3c6` |
| `auth.ts` | +5 | 3 SUPERVISOR grants `PAIRING_MANAGE`, `USER_ADMIN`, `DEMO_CONTROL` | D37, D41 (W16) | yes, `b90a3c6` |
| `text-cut.ts` | +42 (new) | `cutText()` helper that never splits a surrogate pair | D53 ruling F37, D56 (SIM-GAP-1), DR-07; D80 CPC1-17 widens W97's check to "W16 plus SIM-GAP-1" | yes, `b90a3c6` |
| `evidence-actions.ts` | +3 −2 | the two export-destination cuts use `cutText` | D56, DR-07 | yes, `b90a3c6` |
| `session-machine.ts` | +64 −9 against `acaff20` (numstat): SIM-GAP-1 +5 −2 (`acaff20..HEAD`); FX-C +59 −7 (`HEAD`..worktree) | SIM-GAP-1: marker and note cuts. FX-C: `recordingActor()` (the custody actor comes from the session's own audit row), `noteLabel()`, `authorRole` on the NOTE timeline item, audit message `${label} added` | D56 (cuts); D201 ruling R1 and partition "FX-C core+shared engine … note author role", D202 (FX-C gated; FXC-3 `authorRole`) | partly; the FX-C part is uncommitted (it goes in with W103) |
| `types.ts` | +5 −4 | doc comment only: NOTE params gain `authorRole?` | D202 (FXC-3) | uncommitted |
| `views.ts` | +23 −1 | new `TimelineTitleKey` type and `timelineTitleKey()` (additive) | D202 (FXC-3) | uncommitted |

**No changed file lacks a recorded decision.** The plan's words "additions only in `vocabulary.ts` and `auth.ts`" (row W97, AC-B-62, TS-1) were superseded by DR-07/D80 CPC1-17 for SIM-GAP-1, and by D201/D202 for FX-C.

## 4. Findings (reported, not fixed)

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| F-1 | Low (traceability) | L-5 says each by-design change to an existing test "is a recorded decision". For the six later edits in table 2, the gate logs record the change and its reason, but the accepting decision rows (D203, D205, D216, D247) do not name the test files. A regex search of those four rows for "existing", "expectation", "by design", "encoded" or "pinned" finds nothing. The changes are covered, but only by going through the gate log. | table 2; `decisions/decisions.md` rows D203, D205, D216, D247 |
| F-2 | Low (traceability) | FX-C is a second exception to the protocol "nothing under `packages/shared/src/sim/` is written" (P6/P21). It has no drift record like DR-07 (SIM-GAP-1); D201's partition and D202's gate are its only record. It also changes Simulated behaviour by design: a note's timeline label and audit message now follow the author's role instead of the fixed "Investigator note". | `git diff acaff20 -- packages/shared/src/sim/session-machine.ts`; D202 FXC-3; DR list in `decisions.md` (DR-01..DR-13, none for FX-C) |

## 5. Notes and deviations

- **N-1 (web, fresh profile).** A fresh browser profile starts in Live (`dems.core.mode.v1` = null, `data-core-mode="LIVE"`). Switching through the Login selector therefore loads the Live Login page first. That page sent the 3 pre-switch request lines and one socket, which closed at 10:37:03.658 during the switch. The Simulated walk is measured from the moment the switched page was ready. Nothing was blocked in the browser (brief: "block nothing"). The browser only ever navigated to `http://127.0.0.1:5173`; the only other network origin was mock-core's WebSocket on 4400.
- **N-2 (HEARTBEAT selection).** The README (`README.md:126`) puts the option under Settings → App Preferences, debug build, with the `tcp:4400` reverse rule. The reverse rule was set as written. The option itself was set with the documented device-check deep link `core=HEARTBEAT` (`apps/mobile/src/runtime/debug.ts:17-20`, MD-7: "sets the Core link source through `setCoreLinkSource` … stored like the Settings choice"). The stored value read back `{"coreLinkSource":"HEARTBEAT"}`. This avoided a uiautomator dump.
- **N-3 (mock-core).** I started it at 10:35:44 (root sh pid 17512 → npm 17530 → tsx watch 17553 → node 17554 on 127.0.0.1:4400). It ran during the web walk too, because the README (`README.md:111`) and D210 say Simulated sign-in on the web needs the heartbeat. My first stop command did nothing, because zsh does not split an unquoted pid list. I repeated it under `sh` at 10:40:56: `kill -TERM` exit 0, none of the four pids alive, no listener on 4400. The reverse rule `tcp:4400` was removed at 10:40:44; the list afterwards holds only 8081 and 4420.
- **N-4 (end state).** phone2 relaunched with `demsdemo:///login?core=LIVE&motion=off`. Prefs `{"coreLinkSource":"LIVE"}`, Login shows "Core online · paired as DEV-0005", keyguard not showing (`07_mob_99_back_live_login.png`). The Core (4420), Vite (5173) and Metro (8081) were never stopped. Only emulator-5558 was touched. No PIN, lock, fingerprint or settings change. No uiautomator dump at all. `/` was never launched with `motion=`.
- **N-5 (sandbox).** Each of these ran with a per-command sandbox bypass under plan §4.1/GR-4: the launcher self-test, the mock-core suite, starting mock-core, the browser driver and adb. The reason each time was port binding or the adb daemon socket.
- **N-6 (secrets).** The demo password was imported from the dataset module inside the two drivers (`07_driver_web_sim.mts.txt`, `07_driver_mob_signin.mts.txt`) and handed only to `Input.insertText` / `adb shell input text`. README and `dataset.ts` were never grepped for credential lines. `.data/pg.*` was not touched. Count-only scan of the 22 text assets: password 0, `ses_`/`dvc_`/`bio_` tokens 0 (`07_secret_scan.txt`).
- **N-7 (writes).** This row wrote only this file, `verification/assets/07_*`, `delegation_progress/w97_regression.md`, one row in `delegation_progress_report.md`, and working files under the git-ignored `.cache/w97/`. `release/` and `apps/mock-core/` were only read. No tracked source file was modified.

---
*Generated: 2026-10-07 10:42 WIB*
