---
task_id: 2026-09-30_dems_demo_stack_setup
step: 96
plan_row: blueprint row 96 (rev 6); masterplan/06_packaging_spec.md §5
date: 2026-10-01
agent: verifier
tier: 2
status: failed
overall: FAIL (1 High finding on the web packages; Android PASS; docs PASS with Low notes)
window: 10:50–11:28 WIB
decisions: D78, D94, D104, D112
inputs: release/android/*, release/web/*, release/RUN-ON-ANOTHER-PC.md, implementation/69_release_apk.md, 70_web_packager.md, 73_web_core_origin.md
---

# 12 Package verification (step 96)

Fast-track under D112: this step is the main gate before the final commit. Source was read-only. Every result below comes from a command or a screen capture taken in this session; raw evidence is in `verification/assets/96_*`.

## 1. Verdict

**FAIL.** One High finding blocks the web packages; everything else passed.

| Part | Result | Summary |
|---|---|---|
| A. Android release APK (dems_tablet) | **PASS** | Clean install by Method A, offline launch with no Metro, full walk Login → Home → Start Session (8/8) → Recording → End Session → Finalization → Summary → Evidence PASS/FAIL → Settings. 0 crashes. Debug app restored |
| B. Web packages | **FAIL** | Packages start, self-test, serve on 127.0.0.1 only, make zero external requests, and the session flow reaches SEALED. **Evidence Verify never reaches a verdict (F96-1)** |
| B. Static checks (Windows, Linux, Intel Mac) | **PASS** | File types, fuses, markers, hashes and official Node hashes all match |
| C. Docs | **PASS with Low notes** | Every literal step on the macOS arm64 path works; every referenced file exists; 4 Low wording/packaging notes |

**Gate decision:** do not commit the web packages as final until F96-1 is fixed, rebuilt and the two Verify checks are re-run. The APK and both guides can stand as they are.

## 2. Findings

| ID | Severity | Where | Finding | Owner |
|---|---|---|---|---|
| **F96-1** | **High** | all 6 web packages (same web build, manifest `9c89f80a…`) | Evidence **Verify never finishes**: check 8 "Audit chain extract" stays on "Checking", the banner stays "NOT VERIFIED" with a Retry button. EV-20260929-0001 should end PASS; EV-20260930-0005 should end FAIL (its AUDIO-02 row does show FAIL, but there is no verdict). Cause in §2.1 | **step 100** (packaged CSP / core-web build config), then rebuild by **step 95**, then re-verify here |
| F96-2 | Low | `README-FIRST.txt` in all 6 packages | Each says "Full guide: RUN-ON-ANOTHER-PC.md", but that guide is in no package (0 matches in 6 archives), and the guide itself says "Copy only the file for your computer" | step 95 |
| F96-3 | Low | `RUN-ON-ANOTHER-PC.md` §9 | "The Core link shows **LIVE** while it runs". The console shows "CORE LINK **Online**" on Login; "LIVE" appears only in the launcher banner. The Dashboard has no Core-link chip | step 95 |
| F96-4 | Low | `RUN-ON-ANOTHER-PC.md` §2/§10 | The any-OS fallback is listed, but the guide never says which file starts it (`Start (macOS).command`, `Start (Windows).cmd`, `start-linux.sh`). Only the README inside the zip does | step 95 |
| F96-5 | Low | `INSTALL-ANDROID.md` §5 | "Tap a demo operator in the list": the list is collapsed; the user must tap **Demo operators** first | step 94 |
| F96-6 | Known issue | web, every page load | 32 CSP reports `script-src` / `eval` from `clsx-*.js` = Zod's `Function('')` probe, exactly 2 per page load over 16 loads. No functional impact (step 95 §6) | known issue (step 100 / end pass; optional `z.config({ jitless: true })`) |
| F96-7 | Info | APK on the emulator | One `DecoderInitializationException: c2.goldfish.h264.decoder` at recording start; media3 fell back to `c2.android.avc.decoder` 8 ms later and the live feed played. Also 19 `ExpoVideo: Current activity does not support picture-in-picture` lines. Neither is a crash | known issue (check on real hardware) |
| F96-8 | Info | spec §5.2 V-W2 wording | `spctl -a -t exec` on the bare Intel `runtime/node` answers "rejected (the code is valid but does not seem to be an app)", not "accepted". Notarization is proven another way (§4.4). No package problem | spec note |
| F96-9 | Info | other lane | At 11:27 emulator-5554 (dems_phone) had reverse rules `tcp:8081` and `tcp:4400` while its lock was free. This step never touched that device | controller |

### 2.1 F96-1 in detail

| Item | Evidence |
|---|---|
| Symptom, EV-20260929-0001 | `assets/96_web_15_ev0001_verify.png`. Page text: "NOT VERIFIED … Retry … 7 of 8 checks"; rows 1–7 PASS (4 track hashes, manifest digest, Ed25519 signature VALID, device certificate); "Audit chain extract — Checking". Unchanged after a further 8 s |
| Symptom, EV-20260930-0005 | `assets/96_web_17_ev0005_verify.png`. "AUDIO-02 · MIC 2 - Subject SHA-256 — FAIL, FOUND 6fdd78d18e…a49e5e91c8, SEALED bb3af24347…4394cd0d0c"; the other tracks PASS; "Audit chain extract — Checking"; banner "NOT VERIFIED" |
| Browser error | `Connecting to 'data:application/octet-stream;base64,eyJzZXEiOjEs…' violates … connect-src` and `Fetch API cannot load data:application/octet-stream;base64,…`; CSP event `{"d":"connect-src","b":"data","s":".../assets/pending-actions-DMHwt9Wv.js","l":1,"c":165395,"p":"/evidence/EV-20260929-0001"}`. 2 reports per Verify, 4 in total (`assets/96_web_events.jsonl`) |
| Root cause 1 | `apps/core-web/src/features/evidence/demo-assets.ts:29-36` imports the demo files with `import.meta.glob(..., { query: '?url' })`, and `:77-84` loads them with `fetch(url)`. `apps/core-web/vite.config.ts` sets no `assetsInlineLimit`, so Vite inlines files under 4 KB as `data:` URIs. The shipped chunk `pending-actions-DMHwt9Wv.js` holds **57** such URIs, including the 14 `audit-session-extract.jsonl` files |
| Root cause 2 | The packaged CSP has `connect-src 'self' ws://127.0.0.1:4410 ws://localhost:4410` (header) and `connect-src 'self' ws://127.0.0.1:* ws://localhost:*` (meta). Neither allows `data:` |
| Direct proof | In the page: `fetch('data:application/octet-stream;base64,eyJhIjoxfQ==')` → `blocked: TypeError: Failed to fetch`; `fetch('/api/v1/health')` → 200 |
| Scope | Web only, packaged mode only. The tablet app is not affected (PASS/FAIL both correct, §3.2). "Download manifest" for EV-20260930-0004 works, because that manifest is a real file (`/assets/manifest-DnCo5m2I.json` → 200). **Hypothesis, not tested:** any other flow that fetches an inlined file (for example the export manifest inside the Export dialog) fails the same way |
| Why it was missed | Step 95 loaded the Evidence page but did not run Verify (DR-95-5 left the flow walks to this step); step 100 could not run a browser (sandbox EPERM) |
| Fix options | **(a) preferred:** `build.assetsInlineLimit: 0` (or a callback that returns `false` for `demo-evidence/**`) in `apps/core-web/vite.config.ts`. The CSP stays as tight as now. **(b)** add `data:` to `connect-src` in `packaged-csp.ts` **and** in the launcher's copy together (step 100 contract item 6). Either way add a test that runs Verify under the packaged CSP |
| Re-verification needed | Rebuild all 6 packages, then re-run: EV-20260929-0001 → verdict PASS with 8 of 8; EV-20260930-0005 → verdict FAIL on AUDIO-02; CSP reports = Zod probe only |

## 3. Part A: Android release APK

Device: **dems_tablet** / emulator-5556 (2560×1600, 320 dpi, landscape), held through `NO_METRO=1 DEVICE_SESSION_MAX_SECONDS=3300 apps/mobile/scripts/device-session.sh tablet '…'` from 10:51:56 to 11:03:43 (`session ended with status 0`). The phone was covered by step 94 (A9) and was not repeated. No emulator was booted, killed or rebooted (D78).

### 3.1 Install and offline state

| V | Check | Result | Evidence |
|---|---|---|---|
| V-S6 | APK SHA-256 | PASS | `shasum -a 256 -c SHA256SUMS.txt` → `DEMS-Demo-0.1.0.apk: OK`; `.sha256` → OK; value `0009f33d60e9038201b7aa54c9ef1af750db9b852401affba56fbb9d3c345ecd` |
| V-A1 | `adb uninstall com.dems.demo.tablet` | PASS | `Success` |
| V-A2 | Method A step 5, literally `adb install -r DEMS-Demo-0.1.0.apk` | PASS | `Performing Streamed Install` / `Success` (4.7 s). dumpsys: `versionCode=100`, `versionName=0.1.0`, `pkgFlags=[ HAS_CODE ALLOW_CLEAR_USER_DATA ]`, DEBUGGABLE count 0 |
| V-A3 | Offline | PASS | `adb reverse --list` empty; no listener on host 8081 or 4400; no Metro, expo or mock-core process; `airplane_mode_on` = 1 |
| V-A4 | Cold launch | PASS | `LaunchState: COLD`, `TotalTime: 2825`. Login from the embedded bundle; no "Unable to load script" (`96_tablet_01_login.png`) |
| guide §2 step 6 | Signature-mismatch message | PASS | Release over the debug app: `Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE: Existing package com.dems.demo.tablet signatures do not match newer version; ignoring!]`, as the guide says. (Debug over release gives `INSTALL_FAILED_VERSION_DOWNGRADE`; a developer-only case) |

### 3.2 Walk (screenshots `assets/96_tablet_*.png`, stored at 1280×800)

| Step | Result | Evidence |
|---|---|---|
| Sign in with the demo operator picker | PASS | `02_demo_operators` (3 operators), `03_filled` (budi.santoso), then Home. Biometric prompt answered "Not now" |
| Home | PASS | `04_home`: READY, chip "Core Simulated", cameras and mics READY, 7 sealed today |
| Start Session, step 1 | PASS | `06_info_filled`: LP/2026/1001-0096, Saksi, "Demo Witness Satu"; Next enabled |
| Start Session, 8 checks | PASS | `07_devices_check`: "8 of 8 checked", "All checks passed" |
| Ready → Start Recording | PASS | `08_ready`, `09_countdown` |
| Live Session (V-A6) | PASS | `10_live_a/b`: SES-20261001-0024, timer, dual meters, timeline. Two frames 2.5 s apart: video region **14.04 %** of pixels changed; tabs, header and action tiles **0.00 %** |
| End Session with reason | PASS | Hold-to-end → dialog "End Session?" with required Reason (`11_end_reason`, `11b_reason_filled`, 50/500) |
| Finalization | PASS | `12_finalization`: 6 steps, EV-20261001-0014 |
| Summary | PASS | `12b_finalization_later`: SEALED, "Sealed 7.5 s after the recording ended", duration 00:01:00, 137.5 MB, hashes listed. Home then shows 8 sealed today (`13_after_summary_back`) |
| Evidence EV-0001 verify (V-A7) | PASS | `18_ev0001_verify_pass`: EV-20260929-0001 "PASS: every hash matches the sealed manifest", 4 tracks green |
| Evidence EV-0005 verify (V-A7, D67) | PASS | `22_ev0005_verify_fail`: EV-20260930-0005 "FAIL: AUDIO-02 does not match the sealed manifest"; only MIC 2 is red |
| Evidence playback (V-A7, D93) | PASS | `19_ev0001_play_a/b`: video region 5.12 % changed in 2.5 s. `dumpsys audio`: two `AudioTrack` players of pid 17446 (the app), `state:started`, `USAGE_MEDIA`; one `mutedState:clientVolume` |
| Settings → Heartbeat disabled | PASS | `23_settings`, `24_settings_heartbeat_after_tap`: option dimmed with the release hint; UI tree node `content-desc="mock-core heartbeat" enabled="false"`; after a tap "Simulated" stays selected |
| V-A9 `demsdemo://dev-gallery` | PASS | Lands on Home (`25_dev_gallery_deeplink`); no dev UI |

### 3.3 Logcat (V-A8) and restore (V-A10)

| Check | Result | Evidence |
|---|---|---|
| Crash count | PASS | 150,528 lines. `FATAL EXCEPTION` 0; `ReactNativeJS: Error` 0 (only `I ReactNativeJS: Running "main"`); `ANR` 0; process death 0. The 10 `AndroidRuntime` lines belong to `uiautomator` (uid 2000), which this step ran |
| Metro / cleartext | PASS | `8081` 0; `Metro` 0; `Unable to load script` 0; `CLEARTEXT` 0; app lines with `4400`, `websocket` or `http://` 0 |
| App errors | Info (F96-7) | Filtered log: `assets/96_tablet_logcat_app_warn_error.txt` |
| Airplane mode off, app stopped | PASS | `airplane_mode_on=0`; no app pid |
| Debug APK hash | PASS | `cb6b1f513d525372b6e6c6ea35c134da29e9e8a0c79f2566a8fa4e7d217b0be5`, equal to step 94's log (69 §6 DR-94-1) |
| Release removed, debug reinstalled | PASS | `adb uninstall` → Success; `adb install -r app-debug.apk` → Success; `versionCode=1`, `pkgFlags=[ DEBUGGABLE … ]` |
| End state | PASS | Tablet lock free; reverse list empty; the three emulator PIDs (95964, 97196, 92922) alive |

## 4. Part B: web packages

### 4.1 Checksums (V-S6)

PASS. `shasum -a 256 -c SHA256SUMS.txt` in `release/web/` → 6 × `OK`. Each of the 6 `.sha256` files → `OK`. The values equal BUILD-INFO.txt.

### 4.2 macOS arm64 SEA, run from a copy outside the workspace

| V | Check | Result | Evidence |
|---|---|---|---|
| V-W1 | `ditto -x -k` into `$TMPDIR/dems-pkg-verify/` | PASS | Folder `DEMS-Web-Demo-0.1.0-macos-arm64/`; `-rwxr-xr-x … 187804000 … DEMS Web Demo` |
| V-W2 | Gatekeeper on a quarantined copy, no execution | PASS (as expected) | `spctl -a -t exec -vv` → `rejected`, exit 3. `codesign`: `Signature=adhoc`, `TeamIdentifier=not set`. This is the prompt the guide's §5 step 2 describes |
| V-W3 | `--version`, `--self-test` | PASS | `DEMS Web Demo 0.1.0 (node v26.8.2, sea, darwin-arm64)`. JSON `ok: true`, `mode: "sea"`, 432 files, 43,416,532 B, `hashMismatches: 0`, manifest `9c89f80a…f384` (= BUILD-INFO), health 200 `shapeOk`, index 200 with CSP, WS `acceptOk`. Exit 0 |
| V-W4 | Start with `--no-open` | PASS | Banner: `Open in Chrome or Edge:  http://127.0.0.1:4410/` … `Listening on 127.0.0.1 only` |
| V-W6 | `lsof -nP -a -p <pid> -i` | PASS | Only `TCP 127.0.0.1:4410 (LISTEN)` and one loopback `ESTABLISHED` |
| V-W7 | Hardening | PASS | `Host: evil.example` → 421; WS with `Origin: http://evil.example` → 403; `/../../etc/passwd` → 404 (also percent-encoded → 404); `POST /` → 405; other `/api/v1/*` → 404; `Range: bytes=0-99` → `206`, `Content-Range: bytes 0-99/851765`. Headers: nosniff, no-referrer, COOP and CORP same-origin, Permissions-Policy |
| V-W8 | Single instance; port fallback | PASS | Second copy: "DEMS Web Demo is already running: http://127.0.0.1:4410/", exit 0. With 4410 held by a dummy: banner `http://127.0.0.1:4411/`, health 200, CSP `ws://127.0.0.1:4411` |
| V-W9 | SIGINT | PASS | Exit 0 after 0.08 s; " Stopping... / Menghentikan..."; a Node WS client received `close code=1001`; no process or listener left |
| V-W10 | Browser cannot be opened | PASS | With `open` unavailable (`env PATH=/var/empty`): " Open this address in Chrome or Edge: http://127.0.0.1:4411/" and the server keeps serving |

### 4.3 Browser walk (V-W5)

Headless Chromium 153.0.8010.12 (Playwright `chrome-headless-shell`, already cached) at 1920×1080 over raw CDP; driver kept as `assets/96_web_cdp_driver.mjs`; all events in `assets/96_web_events.jsonl` (11:06:47–11:21:58 WIB). agent-browser is not installed on this host.

| Step | Result | Evidence |
|---|---|---|
| Login, demo operator | PASS | `96_web_01_login.png` (CORE LINK Online, Sign In enabled); picker fills `budi.santoso`; → `/dashboard` |
| Dashboard, Core link | PASS | `96_web_03_dashboard.png`. Heartbeat socket `ws://127.0.0.1:4410/ws` open. The Dashboard itself has no Core chip (F96-3) |
| Session Monitor | PASS | `96_web_04_session_monitor.png` (NO SESSION state) |
| Start Session → RECORDING | PASS | `05`–`09`: form, "8 of 8 checks complete / All checks passed", Ready, then "SESSION ACTIVE & SECURE", SES-20261001-0024, REC timer. The feed `<video>` advanced 22.55 → 25.05 s in 2.5 s |
| End Session → SEALED | PASS | Hold-to-end → Reason dialog (`10`, `10b`) → finalizing (`11`) → "Evidence EV-20261001-0014 sealed", 6/6 steps, "Sealed 7.5 s after the recording ended" (`12`) |
| Evidence verify PASS | **FAIL (F96-1)** | `96_web_15_ev0001_verify.png` |
| Evidence verify FAIL | **FAIL (F96-1)**: the track row is right, the verdict never arrives | `96_web_17_ev0005_verify.png` |
| Evidence player and seek | PASS | Video + AUDIO-01 + AUDIO-02 playing in sync after a seek (30.5 / 30.4 / 30.4 s); 31 responses with status 206 |
| API Reference Try-it health | PASS | `96_web_19_try_it_health.png`: `200 OK`, 9 ms, 195 B, `"status": "ok"`, `"clients": 2`; banner "MOCK-CORE ONLINE • v0.1.0 • WS 1 Hz" |
| All pages on full reload | PASS | `/devices`, `/storage`, `/network-time`, `/security-audit`, `/system`, `/stack-check`, `/dashboard`, `/session`, `/evidence`, `/evidence/<id>`: each renders its heading (SPA fallback) |
| External requests | PASS | 1,797 requests: `http://127.0.0.1:4410` 1,793, `data:` 3, `blob:` 1. **External: 0.** WebSockets: all `ws://127.0.0.1:4410`. Chromium had no non-loopback socket. Status codes: 200 × 1,766, 206 × 31, none ≥ 400 |
| CSP reports | **FAIL against "Zod probe only"** | 38 events (the Audits domain reports the same 38). **32** = `script-src` `eval` in `clsx-5EdaupDn.js`, 2 per load × 16 loads (expected). **4** = `connect-src` `data:` from `pending-actions-DMHwt9Wv.js` (F96-1). 2 = this verifier's own probe in §2.1 |
| Console | PASS apart from F96-1 | 0 exceptions; 0 console errors or warnings from the app. Log errors: the F96-1 `data:` lines, and 18 WebSocket reconnect errors after this step stopped the server |

### 4.4 Any-OS zip and static checks

| V | Target | Result | Evidence |
|---|---|---|---|
| V-W11 | any-OS zip, this Mac's Node v26.8.2, via `sh "Start (macOS).command"` | PASS | `DEMS Web Demo 0.1.0 (node v26.8.2, runtime, darwin-arm64)`; `--self-test` exit 0, `ok: true`, `mode: "runtime"`, 432 files, 0 mismatches, same manifest SHA. Real start: banner 4410; lsof only `127.0.0.1:4410 (LISTEN)`; health 200; `/evidence` 200; SIGINT stops it |
| V-S1 | windows-x64 SEA | PASS | `PE32+ executable (console) x86-64, for MS Windows`; 147,458,888 B; SHA `3da64e8c…0cfd` = BUILD-INFO; fuse `:1` × 1 (`:0` × 0); marker × 1. Security directory still points at Node's certificate (15,688 B) but no longer ends the file: Authenticode is invalid, as step 95 noted |
| V-S2 | linux-x64 SEA | PASS | `ELF 64-bit LSB executable, x86-64 … interpreter /lib64/ld-linux-x86-64.so.2`; 193,998,020 B; SHA `7f05cbfa…7fa1` = BUILD-INFO; fuse `:1` × 1; marker × 1; `tar -tvzf` shows `-rwxr-xr-x`. Highest glibc symbol version `GLIBC_2.28` (matches the guide's §7) |
| V-S3 | macos-x64 runtime bundle | PASS | `runtime/node`: `Mach-O 64-bit executable x86_64`; SHA `724b8ccb…265f` = BUILD-INFO = `bin/node` extracted from the official tarball. `codesign --verify --strict` → "valid on disk / satisfies its Designated Requirement"; Authority "Developer ID Application: Node.js Foundation (HX7739G8FX)"; `codesign -R="notarized" --check-notarization` → "explicit requirement satisfied". `.command`: mode 755, 0 CR, `cd "$(dirname "$0")"` |
| V-S4 | F1 signed runtime | PASS | `runtime/node.exe` SHA `23062343ad39fc79f12ae39cfb324e93a20ced5f1d342e7b850c148c022ddbca` = official `win-x64/node.exe`. Security directory 15,688 B at the end of the file (certificate table present). `.cmd`: 5 of 5 lines CRLF; `if errorlevel 1 pause` |
| nodejs.org | Official hashes | PASS | `https://nodejs.org/dist/v26.8.2/SHASUMS256.txt` fetched now: SHA `c31cbd53…7dad3`, equal to the builder's cached copy. The 4 cached archives → `OK` against it. **Gap:** the GPG signature of that file is not verified (no gpg on this host) |
| Payload identity | macos-x64 and F1 `app/` | PASS | `diff -rq` against the self-tested any-OS `app/`: identical (434 files). Launcher SHA `091a2001…4f16` in all three = source = BUILD-INFO |
| V-S5 | Archive hygiene | PASS | 6 web archives: 0 entries matching `.map`, `.DS_Store`, `._*`, `signing`, `.p12`, `.properties`, `.env`, `.docx`, `node_modules`; `licenses/` present in each. APK: one `.properties` entry, `META-INF/com/android/build/gradle/app-metadata.properties` (2 AGP version lines; not a signing file) |

## 5. Part C: docs

`release/RUN-ON-ANOTHER-PC.md` followed literally for the macOS arm64 path.

| Guide step | Result | Note |
|---|---|---|
| §2 file names and sizes | PASS | All 7 files exist. Real sizes 76.1 / 80.6 / 83.0 / 83.8 / 142.6 / 76.1 / 37.1 MB against 76 / 81 / 83 / 84 / 143 / 76 / 37 |
| §5 step 1 "Double-click the zip, open the folder, double-click DEMS Web Demo" | PASS with a limit | Extracted with `ditto` (the Archive Utility engine); folder and file names match; started from a shell. A real Finder double-click was **not** done: the sandbox blocks Launch Services |
| §5 step 2 "Open Anyway" | consistent | `spctl` rejects the quarantined copy; the GUI flow itself was not exercised |
| §5 step 3 `xattr -dr com.apple.quarantine <folder>` | PASS | 2 quarantine attributes before, 0 after, exit 0 |
| §5 step 4 Ctrl+C | PASS | SIGINT → exit 0 |
| §9 address, port range, operators | PASS | 4410, then 4411 when busy; `budi.santoso` works |
| §10 `--self-test` → `"ok": true` | PASS | §4.2 |
| §10 "Starting a second copy just opens the first one" | PASS | "already running", exit 0 |
| §11 `cd web && shasum -a 256 -c SHA256SUMS.txt` | PASS | 6 × OK |
| Names in §4, §6, §7 | PASS | `DEMS Web Demo.exe`, `Start DEMS Web Demo.cmd`, `DEMS Web Demo (Intel).command` in `DEMS-Web-Demo-0.1.0-macos-x64`, `dems-web-demo-0.1.0-linux-x64/dems-web-demo` all exist under exactly those names |
| `android/INSTALL-ANDROID.md` Method A | PASS | Steps 4–6 behave as written (§3.1) |
| Unclear or wrong | Low | F96-2, F96-3, F96-4, F96-5 |

## 6. Not run, and limits

| Item | Reason |
|---|---|
| Release APK walk on dems_phone | Step 94 (A9) ran Login → Home → Settings on the phone. The longer walk was done on the tablet only, as instructed |
| Windows, Linux and Intel-Mac execution | Cannot run on this host (F-12); static proof only |
| V-S7 Linux in Docker | Needs the user's explicit OK |
| V-R1 root typecheck, lint, test | Owned by the parallel step 61 under D112 |
| Finder double-click, Gatekeeper dialog, Safari and Firefox | Sandbox blocks `open`; other browsers are outside this step |
| Guide §10 row "Core offline, Sign In disabled" | Not exercised |
| Export dialog and export-manifest download | Not exercised (hypothesis in §2.1) |

Two sandbox artefacts, for later verifiers: inside the sandbox `spctl` answers "internal error in Code Signing subsystem" and `codesign --verify` answers "invalid signature" for a valid binary. Both commands give the true result only outside the sandbox.

## 7. Clean-up (V-R2)

| Check | Result |
|---|---|
| `$TMPDIR/dems-pkg-verify` | removed |
| `pgrep -fl "DEMS Web Demo|dems-web-launcher|chrome-headless-shell"` | empty |
| Listeners on 4410–4419 and 9333 | none |
| Emulators | 5554, 5556, 5558 all `device`; debug app `versionCode=1` on each; airplane mode 0; none booted or stopped by this step |
| Files written | only under `docs/2026-09-30_dems_demo_stack_setup/verification/` and `delegation_progress/verifier_step_96.md` |

`masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md` and `implementation/99_implementation_report.md` were not edited (parallel run; the controller synthesises).

---
*Generated: 2026-10-01 11:30 WIB*
