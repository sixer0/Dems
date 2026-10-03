---
task_id: 2026-09-30_dems_demo_stack_setup
step: 60
plan_row: blueprint row 60 (rev 6); 02_plan §3 row 21, §4 W-22; fast-track D112
agent: coder-execution
tier: 3
status: complete
date: 2026-10-01
---

# 76: Workspace run guide README.md (step 60, fast-track)

## Result

- `/Users/gsp-budi/Documents/DEMS/README.md` was **created**: 297 lines, 2,984 words. No root README existed before (`ls -la` of the root at 10:5x WIB showed none), so nothing was overwritten (E13).
- It has 15 `##` sections: an Indonesian summary first, then What this is, Quick start for presenters, Prerequisites, Install, Start, Emulator networking, Stop, Demo scenarios, Tests, Release packages, Demo data, Troubleshooting, Rollback, and Licences and known issues.
- **AC-44:** `grep -cE '^## (Prerequisites|Install|Start|Emulator networking|Tests|Stop|Troubleshooting|Rollback)' README.md` → `8`.
- **Emoji scan:** `perl -CSD -ne 'print if /[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]/' README.md` → no output.
- **Versions:** match `initialization/01_env_check.md` rows 1-2, `03_jdk_install.md`, `04_android_sdk_install.md`, `05_avds.md` and `implementation/72_second_phone_avd.md`.
- No builds, servers or emulators were started. The only other files written are this log and `delegation_progress/coder_execution_step_60.md`.

## Command-to-log mapping

Paths are relative to the task folder `docs/2026-09-30_dems_demo_stack_setup/`, except `release/…` and the repository scripts.

| README command | Proving log (passing output) |
|---|---|
| `npm_config_cache="$PWD/.cache/npm" npm install` | `implementation/01_workspace_root.md:52-58` (exit 0); `implementation/08_web_dependencies.md:207` |
| `npm run build:android` (root alias of `npm run build -w @dems/mobile`) | `implementation/05_mobile_app.md:233-242` (APK built); script in `apps/mobile/package.json` |
| `graft build .` | `masterplan/02_plan.md:252` (row 21 wording); `initialization/02_git_init.md:48` (`graft build` wrote `.gitignore`); `initialization/01_env_check.md:76` (`graft check` OK) |
| `npm run dev:mock` / `dev:web` / `dev:mobile`; `127.0.0.1:4400`, `127.0.0.1:5173`, Metro `127.0.0.1:8081` | `implementation/06_integration_smoke.md:37-50, 73-79, 122-130`; `implementation/04_core_web_app.md:147-156` ([::1]:5173 foreign owner) |
| `ANDROID_SERIAL=<serial> npm run mobile:reverse` | `implementation/06_integration_smoke.md:45, 89-109, 204` (S19-2); D43 |
| `adb -s <serial> install -r …/app-debug.apk` | `implementation/05_mobile_app.md:274`; `implementation/45_mobile_brand_media.md:149, 198`; `implementation/47_mobile_login.md` §6 F-75-1 |
| `adb -s <serial> shell am force-stop com.dems.demo.tablet` | `implementation/06_integration_smoke.md:53` |
| `adb -s <serial> shell 'am start -W -a android.intent.action.VIEW -d "demsdemo:///login?motion=off" com.dems.demo.tablet'` | form: `implementation/48_mobile_pairing.md:46`; URL: `implementation/47_mobile_login.md:184`; quoting rule: `implementation/45_mobile_brand_media.md:277` (F-72-2), D68 |
| `device-session.sh` `any-phone` / `tablet` / `any` with `METRO_PORT` or `NO_METRO=1` | `implementation/72_second_phone_avd.md:47, 55, 63, 69`; `implementation/40_mobile_deps_native.md:283`; `implementation/69_release_apk.md` §4 A9 (`any` + `NO_METRO=1`); cap: `implementation/68_device_session_cap.md`; port range: `implementation/59_mobile_audit.md:55, 84` |
| Bundle location `debug_http_host=localhost:8081` | `implementation/40_mobile_deps_native.md:190-204` |
| `__DEMS_DEBUG__.sim.actions.signInWithBiometric('OPR-001')` | `implementation/51_mobile_session_live.md:168`; `implementation/53_mobile_recovery.md:68`; handle shape `implementation/46_mobile_runtime_sim.md:284`; unreliable via inspector: `implementation/59_mobile_audit.md:85`, `implementation/61_mobile_more.md:74, 91` |
| `&scenario=` debug deep links | `implementation/46_mobile_runtime_sim.md:105, 192` |
| `~/Library/Android/sdk/emulator/emulator -avd <avd> -port <port> -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save &`; `echo $! > .locks/dems_<avd>.pid`; `ps -o pri,nice -p …` | `implementation/67_emulator_priority.md:83-99` (§6.1, plus `-no-snapshot-load` from :99); the full flag set booted `dems_phone2`: `implementation/72_second_phone_avd.md:19`; D78, D87, D98 |
| Keyguard unlock `KEYCODE_WAKEUP` + `input text 1234` + `keyevent 66` | `implementation/47_mobile_login.md:272` |
| Fingerprint enrolment block (`locksettings set-pin 1234`, `BIOMETRIC_ENROLL`, `emu finger touch 1`, `get-disabled`, `dumpsys fingerprint`) | `implementation/47_mobile_login.md:250-273` (verified on both AVDs); phone2: D105 |
| Cold start = 1 warm-up + median of 5 | `implementation/67_emulator_priority.md:92`; D73, D87 |
| `kill -TERM <pid>` (mock Core graceful) | `implementation/03_mock_core_service.md:134-168`; `implementation/06_integration_smoke.md:73-79` |
| `adb -s <serial> reverse --remove-all`; `adb kill-server` | `implementation/06_integration_smoke.md:17, 77`; `implementation/69_release_apk.md` §5 |
| `adb -s <serial> emu kill` | `implementation/72_second_phone_avd.md:73`; `initialization/05_avds.md:275-276, 294` |
| `npm run typecheck`, `npm run lint`, `npm test` (root) | `delegation_progress/coder_execution_scaffold.md:16` (all exit 0); `implementation/02_shared_package.md:197` |
| `npm test -w @dems/shared -- --maxWorkers=2` | `implementation/13_sim_engine.md:252` (exit 0) |
| `cd apps/core-web && npx vitest run --maxWorkers=2` | `implementation/33_sim_gap_closure_web.md:27, 167` (438 passed); shared 508: `:24` |
| `cd apps/mobile && npx jest --maxWorkers=2`; `npx tsc --noEmit`; `npx eslint .` | `implementation/75_mobile_tests_after_sim.md` §1 (833/833, exit 0) |
| Mock-core tests outside the sandbox (19 tests) | `implementation/70_web_packager.md` §4 |
| `MAESTRO_CLI_NO_ANALYTICS=true MAESTRO_DISABLE_UPDATE_CHECK=true ~/.maestro/bin/maestro --version` | `implementation/62_maestro_install.md:131-132` (2.11.0) |
| `… maestro --no-ansi --device emulator-5554 test <flow>.yaml --test-output-dir … --debug-output …` | `implementation/62_maestro_install.md:158-165` (exit 0); D47; `?motion=off` rule D43; Session Monitor idle note `implementation/51_mobile_session_live.md:258` |
| `apps/mobile/scripts/create-demo-keystore.sh` | `delegation_progress/coder_execution_step_94.md:14`; `implementation/69_release_apk.md` §2 |
| `apps/mobile/scripts/build-release-apk.sh` (+ back up `app-debug.apk` first) | `delegation_progress/coder_execution_step_94.md:18-21`; `implementation/69_release_apk.md` §1, §6 DR-94-1; D117 |
| `node --import tsx scripts/release/build-web-packages.ts [--skip-gate] [--skip-web-build] [--skip-smoke]`; `VITE_DEMS_CORE_ORIGIN=same-origin` set inside | `implementation/70_web_packager.md:42`; `scripts/release/build-web-packages.ts:139-142`; `implementation/73_web_core_origin.md:61` |
| `shasum -a 256 -c SHA256SUMS.txt` | `implementation/70_web_packager.md` §3 W3 (6× OK) |
| `cd packages/shared && node --import tsx scripts/gen-demo-media.ts […]` | `implementation/64_demo_media.md:153`, runs §8 (run 4, 13 min, exit 0) |
| `cd packages/shared && node --import tsx scripts/gen-demo-evidence.ts […]` | `implementation/65_demo_evidence.md:106`, runs §6 (exit 0, 0.2-0.3 s) |
| `cp packages/shared/assets/demo-media/mobile/* apps/mobile/assets/media/` | `implementation/45_mobile_brand_media.md:295` (R-6) |
| `--as-of` not needed on another demo day | `implementation/33_sim_gap_closure_web.md:57-61` (case-sequence join, test "joins on another calendar day"); D115 |
| `npx vite --port 5176 --strictPort --host 127.0.0.1` (spare web port) | `implementation/21_shell_motion.md:206`; 5174/5175 owners: `implementation/17_motion_library.md:157, 202` |
| `sandbox.network.allowLocalBinding: true` | `implementation/06_integration_smoke.md:216`; `implementation/73_web_core_origin.md:103`; EPERM text `implementation/03_mock_core_service.md:70` |
| Metro inspector `Origin` header | `implementation/60_mobile_settings.md:100` (F-S88-1) |
| Gboard stylus sheet | `implementation/50_mobile_start_session.md:235`; `implementation/58_mobile_network_time.md:77`; D103 |
| Snapshot restore brings an old APK | `implementation/47_mobile_login.md` §6 F-75-1; D78 |
| Rollback `sed -i '' '/^# >>> dems-demo:/,…/d' ~/.zprofile`; `cp -p ~/.zprofile.bak.dems-2026-09-30-235451 ~/.zprofile` | `initialization/03_jdk_install.md:175-177`; `initialization/04_android_sdk_install.md:267-269` |
| `brew uninstall openjdk@17` + the 23 formulae | `initialization/03_jdk_install.md:180-181` (the brief's "implementation/03" is this initialization log) |
| `brew uninstall ffmpeg espeak-ng …` (14 formulae) | `implementation/64_demo_media.md:99-107` |
| `avdmanager delete avd -n dems_tablet / dems_phone / dems_phone2` | `initialization/05_avds.md:298-299`; `implementation/72_second_phone_avd.md:74` |
| `adb kill-server`; `rm -rf ~/Library/Android ~/.android` | `initialization/04_android_sdk_install.md` Rollback; `initialization/05_avds.md:302` |
| `rm -rf ~/.maestro ~/Library/Logs/maestro` | `implementation/62_maestro_install.md:241` (§7) |
| Presenter install `adb install -r DEMS-Demo-0.1.0.apk`; `--self-test` | `release/android/INSTALL-ANDROID.md:29`; `release/RUN-ON-ANOTHER-PC.md:69, 93`; `implementation/70_web_packager.md` W6 |

**Facts without a command:**

| Fact | Source |
|---|---|
| Credentials, Supervisor security key, pairing code `482913` | `packages/shared/src/sim/dataset.ts:119-157` |
| PIN `1234` | `implementation/47_mobile_login.md:255`; D105 |
| Presentation mode hides the Login disclosure | `apps/core-web/src/features/login/auth-card.tsx:35, 286` |
| Presentation mode hides the mobile demo controls | `implementation/60_mobile_settings.md:56, 72` |
| Demo Control Panel contents | `implementation/31_page_system.md:61-75` |
| `?motion=slow|off`, `?debug=1` (web) | `implementation/17_motion_library.md:26, 92, 103`; `implementation/21_shell_motion.md:145-146` |
| `?motion=` and `?debug=` stickiness (mobile) | `implementation/42_mobile_motion_kit.md:173` |
| EV 0005 FAIL; EXP-000031.zip as Supervisor | `implementation/26_page_evidence.md:20-23, 94-96` |
| Separate simulators per client | `identification/02_structured.md:183` (Q-M4, D38) |
| Mobile Core link defaults to Simulated | `apps/mobile/src/runtime/core-link.ts:24` |
| Voices and video provenance | `implementation/64_demo_media.md:114-121, 147` |
| Keep the Mac awake | D98 |
| Do not use `expo run:android` | D41 (c) |

## Issues and hand-overs

| ID | Note |
|---|---|
| H-60-1 | **THIRD_PARTY_NOTICES.md not corrected.** Row 60 also asks for the D74 corrections (videos derived from the Pexels photo, the eSpeak NG voice, no macOS voices). This delegation said "Do not edit any other file", so the file is unchanged. `grep -i 'espeak\|voice'` on it finds nothing. The README states these facts with their sources. Owner: controller (step 62 checks it per D74) |
| H-60-2 | `verification/01_verification.md` does not exist yet. The README points to it as the known-issues list, labelled "written by the final verification pass" |
| H-60-3 | The Maestro app-flow folder `apps/mobile/e2e/maestro` does not exist (deferred under D112). The README says so instead of documenting a flow command that cannot run |
| H-60-4 | `02_plan.md`, `status_tasks.md`, `delegation_progress_report.md` and `99_implementation_report.md` were not edited (parallel-run rule). The controller sets row 60 to done |
| H-60-5 | The root scripts `npm run emulator` and `emulator:phone` boot from the quick-boot snapshot, without `-port` or `-no-snapshot-load`. The README documents them as not recommended (D78). Aligning the scripts is a post-demo item |

## Rollback

`rm /Users/gsp-budi/Documents/DEMS/README.md` (the file did not exist before this step).

---
*Generated: 2026-10-01 11:05 WIB*
