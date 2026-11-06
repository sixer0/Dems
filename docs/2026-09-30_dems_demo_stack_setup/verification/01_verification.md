---
task_id: 2026-09-30_dems_demo_stack_setup
task_slug: dems_demo_stack_setup
date: 2026-10-01
agent: verifier
step: 61 (fast-track form, D112; absorbs row 22 and the root-suite essentials of steps 56/57)
narrative_tier: 2
source_plan: identification/02_structured.md (step 61 row, line 383) and decisions/decisions.md D112, D119
status: complete
verdict: PASS-WITH-CAUTIONS
started: 2026-10-01 10:51 WIB
finished: 2026-10-01 11:05 WIB
---

# Step 61: Combined Verification (fast-track)

## 1. Verdict

**PASS-WITH-CAUTIONS.**

- All root gates are green on the final tree:
  - typecheck exit 0, lint exit 0;
  - root `npm test` exit 0: shared 508, core-web 438, mobile 833 (72 suites), mock-core 19.
- The dependency invariants hold: one React and React DOM at 19.2.3, one react-native at 0.86.3, no `workspace:` versions, no eas.json, no projectId.
- Six of the seven success criteria pass (SC1–SC5, SC7). SC6 passes on content: README.md landed at 10:59:01 while step 60 was still running, so step 60 owns its final wording.
- All later scope items are built and backed by logs. The device-level end-pass verification for mobile tablet layouts, Maestro flows and the web 4-resolution pass is DEFERRED under D112.

The cautions:

- **C-1.** One core-web test failed once and then passed 3 of 3 isolated runs and 2 of 2 full runs: `security-audit.test.tsx:409`. It is a test race, not a product defect (§7, NF-1).
- **C-2.** `npm ls --all` exits 1 on a known optional-peer mismatch, `ajv-formats` (F74-14). The spec's AC-12 form exits 0.
- **C-3.** Device end passes 57, 58 and 59 and code reviews 64 and 65 are deferred (D112). The full list is in §8.

## 2. Scope of this pass and deviations from the full step-61 row

| Full step-61 row (02_structured.md:383) | Fast-track handling (D112, controller brief) | Why |
|---|---|---|
| Stop session emulators, cold-boot with `-no-snapshot-load`, AC-07 cold boots, cold start median ≥3, `-no-window` priority test, gfxinfo jank baseline, leave no emulator running | **Not done.** No emulator was started, stopped or touched | Step 96 is using the emulators for package verification at the same time. The controller brief says: do not start emulators or long device sessions |
| AC-01..AC-47 walk following README literally from `zsh -l` | Replaced by a read-only toolchain re-check (§5), artifact checks, and log-evidence mapping (§6) | Fast-track. The README landed only at 10:59 (step 60 in parallel) |
| Root typecheck, lint, test (AC-43, AC-47) | **Done** (§3) | Core of the fast-track pass |
| D42 anchored greps | **Done** (§4) | Brief item 2 |
| SC1–SC7 PASS | Mapped to evidence (§6) | Brief item 3 |
| Each FAIL routed to its owning step | Known-issues list with owner and next action (§8) | Brief item 4 |

`masterplan/02_plan.md` was not edited. It has no step-61 tracking row (that row lives in `identification/02_structured.md`, owned by task-architect), and parallel runs must not write shared files (CLAUDE.md §3.4). Status goes to `delegation_progress/verifier_step_61.md` for the controller to merge.

## 3. Root gates (fresh, 2026-10-01)

| Gate | Command | Result | Evidence |
|---|---|---|---|
| Typecheck | `npm run typecheck` (in sandbox, 10:51:39–10:51:53) | **PASS**: `TYPECHECK_EXIT=0`. Workspaces: shared `tsc --noEmit`, core-web `tsc -b`, mobile `tsc --noEmit`, mock-core `tsc --noEmit`; no diagnostics printed | scratchpad `s61/typecheck.log` |
| Lint | `npm run lint` (in sandbox, 10:51:53–10:52:03) | **PASS**: `LINT_EXIT=0`. shared/core-web/mock-core `oxlint`, mobile `eslint .`; no findings printed | scratchpad `s61/lint.log` |
| Tests, run 1 | `npm test -- --maxWorkers=2` (in sandbox, 10:52:19–10:53:08) | `TEST_EXIT=1`. shared `28 passed (28)` / `508 passed (508)`. core-web `1 failed \| 437 passed (438)`. mobile `72 passed` / `833 passed`. mock-core `4 failed \| 5 passed \| 10 skipped (19)`, all `listen EPERM: operation not permitted 127.0.0.1` (the sandbox blocks local port binding) | scratchpad `s61/test.log` |
| mock-core re-run | `npm test -w @dems/mock-core -- --maxWorkers=2` (**sandbox bypass**, port binding, 10:53:24) | **PASS**: `Test Files 4 passed (4)` / `Tests 19 passed (19)` | command output |
| core-web flake check | `npx vitest run src/features/security-audit/__tests__/security-audit.test.tsx --maxWorkers=2` ×3, then the full `npx vitest run --maxWorkers=2` (in sandbox) | **PASS**: `18 passed (18)` ×3; full `39 passed (39)` / `438 passed (438)` | command output |
| **Tests, run 2 (evidence run)** | `npm test -- --maxWorkers=2` from the root (**sandbox bypass**, 10:54:38–10:56:09) | **PASS**: `ROOT_TEST_EXIT=0`. shared `508 passed (508)`; core-web `39 passed (39)` / `438 passed (438)`; mobile `Test Suites: 72 passed, 72 total` / `Tests: 833 passed, 833 total`; mock-core `4 passed (4)` / `18 passed \| 1 skipped (19)` | scratchpad `s61/test2.log` lines 14–15, 158–159, 86640–86641, 86653–86654 |

The counts match the latest known values (shared 508, core-web 438, mock-core 19, mobile 833).

Two notes on the test runs:

- The mock-core skip in run 2 is conditional: `standalone-launcher.test.ts:351` runs `if (!(await free(4410)) || !(await free(4411))) ctx.skip();`. The 10:53 bypass run executed all 19. A follow-up `lsof -iTCP:4400-4419 -sTCP:LISTEN` returned no listener (exit 1). This fits a short-lived step-96 launcher on 4410 during run 2, but that is a hypothesis; the run was not observed.
- The stderr line `ERROR: failed to copy trust settings of system certificate` appears 330 times in the sandboxed run and 0 times in the bypass run, so it comes from the sandbox.

## 4. Dependency invariants

| Check | Command | Result |
|---|---|---|
| D42 react / react-dom | `npm ls react react-dom --all \| grep -oE '(^\| )react(-dom)?@[0-9.]+' \| sed 's/^ //' \| sort -u` | **PASS**: exactly `react-dom@19.2.3`, `react@19.2.3` |
| D42 react-native | `npm ls react-native --all \| grep -oE '(^\| )react-native@[0-9.]+' \| sed 's/^ //' \| sort -u` | **PASS**: exactly `react-native@0.86.3` |
| AC-12 form | `npm ls --workspaces --depth=0` | **PASS**: exit 0 |
| `npm ls` top level | `npm ls` | **PASS**: exit 0 |
| `npm ls --all` | `npm ls --all` | **CAUTION**: exit 1, `ELSPROBLEMS`, `invalid: ajv-formats@3.0.1 … "^2.1.1" from apps/core-web/node_modules/@hookform/resolvers, … apps/mobile/node_modules/@hookform/resolvers`. This is pre-existing and known: step-27 log `08_web_dependencies.md:178` (O-5) and review F74-14 (`11_mobile_foundation_review.md:146`). It is an *optional* peer of the ajv resolver, and only the zod resolver is imported. Owner: deferred code review 64/65 |
| No `workspace:` versions | `/usr/bin/grep -n '"workspace:' package.json apps/*/package.json packages/*/package.json`; `grep -c '"workspace:' package-lock.json` | **PASS**: grep exit 1 (none); lockfile count 0 |
| No eas.json | `find . -name eas.json -not -path '*/node_modules/*'`; `git ls-files \| grep -E '(^\|/)eas\.json$'` | **PASS**: none on disk, none tracked |
| No projectId | `/usr/bin/grep -n "projectId\|\"eas\"" apps/mobile/app.json` (exit 1); recursive scan of apps/mobile (*.json, *.js, *.ts, *.tsx, excluding node_modules, android, .expo) (exit 1) | **PASS**: none. Positive control: grep found `projectId` in a planted file (count 1) |
| Release secrets not tracked | `git check-ignore -v release/x apps/mobile/signing/x .locks/x`; `git ls-files apps/mobile/signing release \| wc -l` | **PASS**: `.gitignore:61:/release/`, `.gitignore:62:apps/mobile/signing/`, `.gitignore:56:.locks/`; 0 tracked files |

## 5. Toolchain and package artifact re-check (read-only)

The toolchain was re-checked from a login shell: `zsh -l -c '…'` in the sandbox. No adb server was started and no emulator was launched.

- `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`
- `openjdk version "17.0.20.1" 2026-08-18`
- `ANDROID_HOME=/Users/gsp-budi/Library/Android/sdk`
- `Android Debug Bridge version 1.0.41` / `Version 37.0.1-15733141`
- `emulator -list-avds` → `dems_phone`, `dems_phone2`, `dems_tablet`
- build-tools `35.0.0 36.0.0`, NDK `27.1.12297006`, platforms `android-36`
- `v26.8.2`, npm `11.19.1`, `git version 2.55.0`
- `ffmpeg version 9.0.2`, `eSpeak NG text-to-speech: 1.52.0`

Maestro was not re-run: it needs a sandbox bypass (D47). Its evidence stays in `implementation/62_maestro_install.md` (2.11.0, SHA-256 verified).

The package artifacts were checked for integrity only. Functional package verification is step 96, which is still running.

- **APK:** `shasum -a 256 release/android/DEMS-Demo-0.1.0.apk` gives `0009f33d60e9038201b7aa54c9ef1af750db9b852401affba56fbb9d3c345ecd`. This is identical to `DEMS-Demo-0.1.0.apk.sha256` and to D117 (142,592,154 B).
- **Web packages:** `cd release/web && shasum -a 256 -c SHA256SUMS.txt` gives `OK` for all 6: windows-x64, macos-arm64, linux-x64.tar.gz, macos-x64, windows-x64-signed-runtime, any-os-node.
- **Guides:** `release/RUN-ON-ANOTHER-PC.md` (8,578 B) and `release/android/INSTALL-ANDROID.md` (6,124 B) are present.

## 6. Requirement trace

### 6.1 Success criteria SC1–SC7 (identification/01_translated.md:149–157)

| SC | Requirement | Result | Evidence |
|---|---|---|---|
| SC1 | Every tool installed with version output; `adb devices` lists the tablet emulator | **PASS** | `initialization/01_env_check.md:9` verdict `PASS (25/25 blocking items …)`; `initialization/03_jdk_install.md`, `04_android_sdk_install.md`, `05_avds.md:127-129,263` (`emulator-5554	device`, AC-07 PASS), `07_js_runtime.md`, `implementation/62_maestro_install.md`; fresh version re-check in §5. `adb devices` was not re-run today because step 96 holds the devices |
| SC2 | Frameworks and libraries recorded with versions and a reason each | **PASS** | `research/03_analysis.md` Decision Record (line 258, SD-01..SD-54, each with rationale and alternatives); `masterplan/01_specs.md` §1.4 pins (line 188); D10; `verification/05_pre_baseline_gate.md:31` (AC-12, 112/112 pins) |
| SC3 | Core web dev server runs; placeholder with a visible animated transition | **PASS** (exceeded: 10 pages + flow) | `implementation/04_core_web_app.md:151` (`VITE v8.3.1 ready in 227 ms ➜ Local: http://127.0.0.1:5173/`), `:163-164` (AC-22 HeroUI, AC-23 motion/react), `:168` (timed animation capture) |
| SC4 | Mobile builds, installs and launches on the tablet emulator, with a visible animated transition | **PASS** | `implementation/05_mobile_app.md:239` (`BUILD SUCCESSFUL in 8m 34s`), `:302` (AC-29 PIDs on both AVDs), `:303` (AC-30 phone, tablet, rotation), `:304` (AC-31 animated entering + Skia pulse); the release APK was later run on dems_phone without Metro (`implementation/69_release_apk.md`, D117) |
| SC5 | Mock Core answers health, emits WS heartbeat; both apps receive it, incl. the emulator | **PASS** | `implementation/06_integration_smoke.md:13-16` (AC-40 both serials, AC-41 three clients web + phone + tablet, AC-45 Metro on 127.0.0.1:8081); `implementation/03_mock_core_service.md`; fresh mock-core suite 19/19, including `heartbeat.test.ts` "binds 127.0.0.1, streams increasing heartbeats and closes clients with 1001" (§3) |
| SC6 | Run guide with exact install, start and emulator commands | **PASS** (on content; step 60 still owns the file) | `README.md` (21,421 B, written 10:59:01 by step 60, in flight). It has Install `npm_config_cache="$PWD/.cache/npm" npm install` (line 82); Start `npm run dev:mock` / `dev:web` / `dev:mobile` (lines 94–96); emulator command with `-no-snapshot-load -no-snapshot-save` (line 133); Stop, Tests, Release packages and Rollback sections; plus `release/RUN-ON-ANOTHER-PC.md` and `release/android/INSTALL-ANDROID.md` |
| SC7 | Feature phase can begin without more environment work | **PASS** (by demonstration) | The feature phase ran inside this task (DR-01) with no environment rework beyond user scope additions: all web pages (logs 22–32) and all mobile screens (logs 47–61) were built on this toolchain |

### 6.2 Later user scope

| Scope item | Result | Evidence (logs) | Reason if not PASS |
|---|---|---|---|
| D15/D16: web built from `ui_design/` with creative improvement; designer tokens and fonts | **PASS** | `implementation/11_token_pipeline.md` (AC-18 no drift, AC-69 contrast, D49); `19_app_shell.md` (controller viewed 1920 shell, D60); `22_page_dashboard.md`; `24_page_session_monitor.md` ("near pixel-faithful", D80); `verification/07_visual_checkpoint.md` (all row-45 checks passed; F45-01..08 fixed in `implementation/71_visual_audit_fixes.md`, D109) | — |
| D17: responsive phone portrait + tablet multi-pane, orientation unlocked | **PARTIAL** | `implementation/43_mobile_navigation_shell.md` (rail 232/88/72 dp, rotation keeps state, D69); tablet panes in `49_mobile_home.md` (MA-12), `51_mobile_session_live.md` (3 panes), `54_mobile_sessions_hub.md`, `60_mobile_settings.md`; 3 AVDs (`72_second_phone_avd.md`) | Tablet re-checks for several screens were deferred to step 59, which D112 deferred (KI-01) |
| D18: all 8 sidebar menus | **PASS** | Logs 22 (Dashboard), 24 (Session Monitor), 26 (Evidence), 27 (Devices & Inputs), 28 (Storage), 29 (Network & Time), 30 (Security & Audit), 31 (System & Maintenance); route files under `apps/core-web/src/routes/_app/` (dashboard, session/index, evidence/index + $evidenceId, devices, storage, network-time, security-audit, system) | — |
| D19: in-browser simulator in packages/shared | **PASS** | `12_sim_contract.md`, `13_sim_engine.md`, `33_sim_gap_closure_web.md` (D115; `grep -rn "SIM-GAP-" apps/core-web/src \| wc -l` gives 0 today) | — |
| D25: Login page | **PASS** | `23_page_login.md` (D76: AC-49/AC-50, no password in storage, URL, events or audit); route `routes/login.tsx` | — |
| D26: API / Swagger page | **PASS** | `32_page_api_reference.md` (D101: Scalar lazy chunk, AC-57 only 127.0.0.1 hosts, Try-it LIVE health); route `_app/developer/api.tsx` | — |
| D25/D26 "10 + 1": 10 pages + Start Session flow | **PASS** | 10 pages above + `25_flow_start_session.md` (D91: gate with WARN/BLOCK, 3-2-1, RECORDING); route `_app/session/new.tsx`; D101 "All 11 web pages and flows are now built" | — |
| D30: complete mobile dependency set | **PASS** | `05_mobile_app.md:92` (60 rows, 0 differ); `40_mobile_deps_native.md` | — |
| D33/D38: mobile app, 22 routes | **PASS** (build, jest, phone-level device checks) | Logs 41–46 (foundation, motion kit, navigation, compositions, brand media, runtime sim), 47–61 (Login, Pairing, Home, Start Session, Session Live, Finalize/Summary, Recovery, Sessions hub, Evidence, Devices, Storage, Network & Time, Audit, Settings, More); D69 "22 routes through the real src/app tree"; D116 "All 22 mobile screen steps are done"; `75_mobile_tests_after_sim.md` (833/833) | — |
| D33: mobile end-pass device verification (MA-01..MA-30 both AVDs, Maestro flows) | **DEFERRED** | Steps 57/59 not run (D112) | KI-01, KI-02 |
| Web end-pass browser verification (step 58, AC-48..AC-75 at 4 sizes, MS-01..MS-10) | **PARTIAL / DEFERRED** | Partly covered by `verification/07_visual_checkpoint.md` (AC-59/60/61/70/71/75 at 1920/1440), `71_visual_audit_fixes.md` (60 fps Dashboard, Devices, Session Monitor in windowed GPU Chrome) and the step-95 headless walk of 11 pages (D118) | Production-build AC-71 re-measure, 1200/900 sizes and MS-07 capture not done (KI-03) |
| D50: demo media + dummy evidence data | **PASS** | `64_demo_media.md` (D64: 42 MB ≤ 60 MB, H.264, separate MIC tracks, eSpeak NG); `65_demo_evidence.md` (D67: 14 packages, Ed25519 DEMO, exactly one tampered EV-0005/AUDIO-02); `66_demo_data_export.md`; web consumer `26_page_evidence.md` (EV-0001 PASS 8/8, EV-0005 FAIL AUDIO-02 only); mobile `45_mobile_brand_media.md` (84 files hash-matched), `55_mobile_evidence.md` (separate MIC tracks play, D93); sim alignment `33_sim_gap_closure_web.md` (D115) | — |
| D94/D104: Android release APK + portable web launchers | **PASS** (build + integrity); functional verification owned by step 96 (in progress) | `69_release_apk.md` (D117: signed DEMO, versionCode 100, 3 ABIs, not debuggable, run on dems_phone without Metro); `70_web_packager.md` (D118: 6 packages, 127.0.0.1:4410 only, 11 pages, Try-it 200); `73_web_core_origin.md` (D113: same-origin + CSP); §5 checksums 1 + 6 OK; §4 release/signing ignored | Step 96 has not yet reported (`delegation_progress/verifier_step_96.md`: `status: in-progress`) |

### 6.3 Log coverage

| Set | Present | Not present (and why) |
|---|---|---|
| `implementation/` | 68 logs: 01–33, 40–62, 64–75. All `status: complete` / `completed` / `complete-with-notes`, except `67_emulator_priority.md`, which is `blocked` (D87, environment) | `34_git_final_commit.md`: step 66, after this pass. `63_sim_gap_closure_mobile.md`: step 91 was reduced to the release-critical item by D112 and that item was done in step 94. The rest of 91 is in KI-04..KI-11 |
| `verification/` | 05 (step 26), 06 (step 40), 07 (step 45), 11 (step 74), 01 (this file) | 02 (step 62) and 09 (step 63) are running in parallel. 12 (step 96) is running. 03/10 (reviews 64/65) and 04/08 (steps 58/59) are deferred (D112) |
| `test/` | none | `01_test_report.md` / `02_mobile_test_report.md` (steps 56/57) were condensed into the root suites of this pass (D112). No test authoring was done here |
| `initialization/` | 01, 02, 03, 04, 05, 07 | Rollback sections confirmed: `03_jdk_install.md:71` (formula diff for rollback), `04_android_sdk_install.md:263`, `05_avds.md:290`; also `implementation/62_maestro_install.md:237`, `64_demo_media.md` (7 rollback references); README `## Rollback` (line 259) |

## 7. New findings from this pass

| ID | Severity | Finding | Evidence | Owner / next action |
|---|---|---|---|---|
| NF-1 | Low | **Flaky core-web test.** `security-audit.test.tsx:409` calls `within(screen.getByTestId('rbac-matrix')).getAllByRole('row')` synchronously. `mountPage()` (lines 75–87) waits only for `panel-rbac`, and the comment on line 84 says the page mounts in stages. In run 1 the table rendered with no rows yet (DOM dump: an empty `<table role="grid" data-testid="rbac-matrix">`). Re-runs passed 3/3 isolated and 2/2 full. Hypothesis: the React Aria collection had not committed its second pass while the host was loaded by parallel steps 60, 62, 63 and 96 | §3 run 1 failure output | Post-demo test hygiene (core-web owner): use `await within(…).findAllByRole('row')`. Not a product defect; no demo impact |
| NF-2 | Low | **The `npm run e2e` script points at a missing folder.** `apps/mobile/package.json:13` runs `maestro … test e2e/maestro`, but `apps/mobile/e2e` does not exist (`ls`: No such file or directory). README line 211 already says the suite "was deferred … and does not exist yet" | `ls apps/mobile/e2e` | Step 57 (deferred): author flows 01..04 or remove the script (KI-02) |
| NF-3 | Info | `npm test` inside the agent sandbox fails mock-core (`listen EPERM`) and prints sandbox-only TLS-trust noise. The README Tests section already says to run mock-core tests outside the sandbox | §3 run 1 vs run 2 | None. The user can enable `sandbox.network.allowLocalBinding: true` if agents should run it in-sandbox |
| NF-4 | Info | The mock-core port-fallback test skips silently when 4410/4411 are busy (`standalone-launcher.test.ts:351`) | §3 | Note only. On a demo PC with the launcher running, expect `18 passed \| 1 skipped` |

## 8. Known issues (compiled from decisions D69–D119 plus this pass)

The owner column names the blueprint step that would close the item. Most of these steps are deferred past the demo by D112. "User" means a host or account decision that the controller may not take (D39 limits).

### 8.1 Deferred device and browser checks

| ID | Item | Source | Owner / next action |
|---|---|---|---|
| KI-01 | **Tablet captures and tablet re-checks.** Several checks never ran on a device: <br>• MA-07/MA-15 on the tablet, enrolment state and tablet portrait (D88) <br>• Start Session tablet device check and stepper/step-param confirmation (D90) <br>• Pairing tablet layout (D95) <br>• Evidence tablet list/detail and playback (log 55 status) <br>• Network & Time: confirm the 4 phone labels after the 10:19 fix (D111) <br>• More phone-portrait capture (D116) <br>• Audit AUDIT_TAMPER device frames (D114; jest covers it) <br>Jest suites cover these screens | D88, D90, D95, D111, D114, D116; logs 47, 50, 55, 58, 59, 61 | Step 59 (deferred). Next action: one tablet + phone pass via `device-session.sh any` with the debug-handle sign-in (D103) before the demo if time allows |
| KI-02 | **Maestro flows** `apps/mobile/e2e/maestro/01..04` on both AVDs were never authored or run. Also open: F74-06/F74-21 (D73) and S76-8, which needs codes typed digit by digit (D95) | D43, D47, D73, D95, NF-2 | Step 57 (deferred) |
| KI-03 | **MA-30 toast.** The toast and the step-2 block device capture are not done (jest covers the logic) | D106 | Step 59 (deferred) |
| KI-04 | **Web end pass (step 58).** Not done: <br>• AC-71 re-measure for Dashboard + Devices on the production build in GPU Chrome (D96) <br>• Login hand-off pause of 264–349 ms in the dev build, to confirm on the production build (D76) <br>• AC-73 build half (D101) <br>• 1200×800 and 900×800 sizes, MS-07 capture <br>• MIC 2 peak marker overflow at 1440 (D109; clipped, invisible) | D76, D96, D101, D109 | Step 58 (deferred); dbfs-meter.tsx fix only if 58 flags it |
| KI-05 | **Emulator-specific risks to check on real hardware.** F-79-4: a Skia canvas went blank under load (one-time remount in place). Emulator jank (13.6 %, tablet ~40 %) is informational | D58, D78 | Physical device check (R3) |
| KI-06 | **Step-61 device items not done in this fast-track pass.** Cold boots with `-no-snapshot-load`, cold-start median ≥3, the `-no-window` priority test, the gfxinfo baseline, and stopping the emulators at the end (step 96 is using them) | 02_structured.md:383; §2 | Controller: stop the emulators after step 96 finishes. The rest is deferred |

### 8.2 Step 91 remainder (mobile gap closure, reduced by D112)

| ID | Item | Source | Owner / next action |
|---|---|---|---|
| KI-07 | **Mobile SIM-GAP adoption.** Mobile still carries 13 SIM-GAP IDs (68 markers): M80-1, M81-1..4, M83-1/2, M84-1..3, M85-1/2, M88-1. M78-1 (next case number) is closed in the sim by step 54, but mobile has not adopted the new API. M84-1/M84-3 and M85-1/M85-2 are closed in the sim and only need the import switch and adapter deletion (D102, D107). Open sim work: M81-1..4 (RECOVERED outcome, recover role check, per-track detail, FAULT scenario, D99), M84-2 (per-device health history), M88-1 (selectable idle timeout) | `grep -rhoE "SIM-GAP-M[0-9]+-[0-9]+" apps/mobile/src \| sort \| uniq -c`; D90, D92, D93, D99, D102, D106, D107, D115 | Step 91 (post-demo) |
| KI-08 | **Sheet-hook consolidation.** 8 copies of `use-sheet-presence.tsx` in `apps/mobile/src/features/{session-live,settings,session-summary,session-new,storage,audit,network-time,devices}/` should move into the kit | `find apps/mobile/src -iname '*sheet-presence*'`; D78 F-79-2, D106 H-S88-4 | Step 91 |
| KI-09 | **Stepper fixes.** <br>• The badge loses its tick/number after a status change (D90) <br>• Reanimated `synchronouslyUpdateUIProps` warnings (D95 S76-4) <br>• The 'needs attention' connector stays unfilled (D99 F-81-1) | D90, D95, D99 | Step 91 |
| KI-10 | **Pane-layout freeze.** <br>• S77-9: a pane keeps a stale size after a fixed→flex switch on rotation (D83) <br>• F-83-4: pane sizes freeze on rotation under reduced motion (D93) | D83, D93 | Step 91 |
| KI-11 | **LogBox banner.** F77-3: a reduced-motion warning banner appears (D83). The step-69 leftover second Reanimated warning is still open: the ignore list has one entry, `motion-policy-provider.tsx:40` | D69, D83 | Step 91 |
| KI-12 | **RollingNumber `count` mode** leaves higher digits half-rolled: 99 % renders as "09%" | D83 F77-1 | Step 91 |
| KI-13 | **Other routed step-91 items.** <br>• F74-02 escalation pulse `totalMs` (D73) <br>• S80-3 GlowLayer pulse `totalMs` (D92) <br>• F-83-1 BottomSheet hidden under reduced motion; use the Dialog fallback (D93) <br>• F-79-1: keep the tabs underneath on deep jumps (D78) <br>• Login→Home guard wait of ~600 ms (D88) <br>• Haptic events `caseScan` / `pairingFailure` (D90, D95) <br>• H-S88-2 monitor reads meterSize; H-S88-3 toasts read notification prefs; O-S88-1 rail highlight after a deep link (D106) <br>• Optional 1.2 s SEALED sync delay (D92 F-80-1) <br>• Minor F74-04/05/07/10/11/12/14 (D73) <br>• The vacuous PENDING_OWNER_CHANGE entry (D69) | D69, D73, D78, D88, D90, D92, D93, D95, D106 | Step 91 |

### 8.3 Step-54 deferrals (simulator and web)

| ID | Item | Source | Owner / next action |
|---|---|---|---|
| KI-14 | **HDD SMART fault kind** is not in the sim. A per-drive SMART *summary* exists (`packages/shared/src/sim/views.ts:202`, `vocabulary.ts:596`), but there is no injectable HDD SMART fault | D77 W49-1, D115 | Sim owner (post-demo) |
| KI-15 | **Markers/notes UI** on stored evidence (W47-3) is not built | D84, D115 | Web Evidence owner (post-demo) |
| KI-16 | Shared flag-label i18n map not done | D115 | Sim/i18n owner (post-demo) |

### 8.4 Code, docs and packaging leftovers

| ID | Item | Evidence | Owner / next action |
|---|---|---|---|
| KI-17 | **Zod CSP probe.** 28 CSP reports come from Zod v4's `Function('')` capability probe (caught and harmless). `z.config({ jitless: true })` is absent from `apps/core-web/src/main.tsx` (grep exit 1) | D118 | Post-demo: add one line to main.tsx, then rebuild via step 95 and re-verify via step 96 |
| KI-18 | **core-api.ts description is stale for packages.** `packages/shared/src/api/core-api.ts:427` reads "**Live**: served by mock-core on 127.0.0.1:4400 (CORS allows the web dev origins)". In the packaged launcher the origin is 127.0.0.1:4410, same-origin | D113; quoted line | Post-demo doc fix and OpenAPI regeneration |
| KI-19 | **device-session.sh Metro port range.** The script accepts 8081–8089 only (8090+ is rejected, F-87-1), and the usage text at line 80 says `METRO_PORT=8081..8086`, which is inconsistent. F-87-2: reaching the debug handle via the Metro debugger is unreliable, and how to reach `__DEMS_DEBUG__` on a device is undocumented | D114, D116; `apps/mobile/scripts/device-session.sh:80` | Post-demo script fix; README addition (step 60 may cover it) |
| KI-20 | **Motion spec §9.4 lacks the loop priority levels.** `masterplan/03_motion_spec.md:644` documents only "cap 4". The priority levels added by step 45b (shell escalation outranks page decoration) are not described | D109 | Spec update (post-demo) |
| KI-21 | **Expo prebuild wipes `android/`** even without `--clean`. Back up `app-debug.apk` before any future prebuild | D117 | README / operator practice |
| KI-22 | Windows x64, Linux x64 and Intel-Mac web packages were checked statically only. The presenter should run `--self-test` on the target PC the day before | D104, D118 | Presenter |
| KI-23 | `npm ls --all` exits 1 with `ajv-formats` invalid (optional peer; no runtime effect) | §4; F74-14 | Code review 64/65 (deferred) |
| KI-24 | Flaky `security-audit.test.tsx:409` (NF-1); also F-49-3, where 1 s waits in shell/route tests flake under load (D77) | §3, D77 | Step 56 (condensed) / post-demo test hygiene |

### 8.5 Environment and user decisions

| ID | Item | Source | Owner / next action |
|---|---|---|---|
| KI-25 | **Emulator background priority** (blocked step 74b). macOS re-applies the `4T` band within 6–32 s of `taskpolicy -B`, and the cold-start median is 12.5–14.3 s. The global App Nap opt-out (a persistent system setting) was not applied | D87; `implementation/67_emulator_priority.md:19` | **User decision.** Boot demo emulators from the user's own Terminal with windows visible (README) |
| KI-26 | Keep the Mac awake while agents run. Clamshell sleep 07:08–09:12 stalled every agent | D98 | User |
| KI-27 | A free Google developer account would remove the 24-hour advanced flow for tap-installing in Indonesia, but needs an account. adb-first install is documented | D104, D110 | **User decision** |
| KI-28 | `docs/` (with design-book extracts) is tracked in local commits. Review it before any future remote | D8, D44 | User (only if a remote is ever added) |

### 8.6 Deferred reviews

| ID | Item | Source | Owner / next action |
|---|---|---|---|
| KI-29 | **Deep code reviews 64 (web/stack) and 65 (mobile) are deferred.** Items waiting for them: D66(d) `expo-router/build/hooks` import, F74-14, the D45 Scalar advisories, and the `__DEMS_DEBUG__` / `&scenario=` debug-only surfaces (D66(c)). The security reviews 62/63 are *not* deferred; they run in parallel | D112 | Steps 64/65 (post-demo) |

## 9. Processes and files

- **Processes:** only short-lived `tsc`, `oxlint`, `eslint`, `vitest`, `jest`, `npm ls`, `shasum`, `lsof` and `zsh -l` runs, all of which exited. No dev server, Metro, emulator or adb server was started or stopped. After the runs, `lsof -iTCP:4400-4419 -sTCP:LISTEN` returned nothing.
- **Sandbox bypass** was used 3 times: the mock-core test re-run, the root `npm test` evidence run (both need local port binding), and the `lsof` listener check.
- **Source:** read-only. No source, config or lockfile was modified.
- **Files written:** this file; `delegation_progress/verifier_step_61.md`. Scratch logs are in the session scratchpad (`s61/`), outside the repo.

---
*Generated: 2026-10-01 11:05 WIB*
*Last Updated: 2026-10-01 11:05 WIB*
