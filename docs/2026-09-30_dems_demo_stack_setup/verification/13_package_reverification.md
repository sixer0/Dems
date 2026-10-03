---
task_id: 2026-09-30_dems_demo_stack_setup
step: 96b
plan_row: controller step 96b (D112 fast-track); re-verification of step 96 finding F96-1 after rebuild step 95b
date: 2026-10-01
agent: verifier
tier: 3
status: passed
overall: PASS (7 of 7 required checks; F96-1 closed)
window: 11:52-12:03 WIB
inputs: release/web/* (build 2026-10-01 11:45:10-11:45:58 WIB), release/RUN-ON-ANOTHER-PC.md, verification/12_package_verification.md, implementation/78_web_packager_rebuild.md
---

# 13 Package re-verification (step 96b)

VERDICT: PASS

All 7 required checks passed on the packages built at 11:45 WIB. F96-1 is closed: Evidence Verify now reaches a verdict in about 1.3 s, PASS for EV-20260929-0001 and FAIL on AUDIO-02 only for EV-20260930-0005, in two separate runs.

Limit, stated plainly: only the macOS arm64 package and the any-OS zip were executed. The Windows, Linux and Intel-Mac packages and the Windows signed-runtime fallback **were not run** (this host cannot run them); they have static proof only (§3, check 6).

Source and `release/` were read-only. Every result below comes from a command run in this session. Raw evidence: `verification/assets/13_*`.

## 1. Checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | `shasum -a 256 -c SHA256SUMS.txt` in `release/web/`; hashes equal BUILD-INFO.txt | PASS | 11:52:47: 6 x `OK`, exit 0. Each of the 6 `.sha256` files: `OK`. All 6 hashes found on the matching `packages:` line of BUILD-INFO.txt (`5ba6368f…`, `4f0f9e83…`, `78ae50d8…`, `a24dcbd3…`, `0859baa4…`, `a5c50d05…`) |
| 2 | `node --import tsx scripts/release/build-web-packages.ts --verify-inputs` (the invocation BUILD-INFO.txt documents) | PASS | 11:53:00, exit 0: `build inputs at build time: 748 files, digest 0e324957…f1a3` / `build inputs now: 748 files, digest 0e324957…f1a3` / `OK: no build input changed since the packages were built`. Cross-check `shasum -a 256 -c release/web/BUILD-INPUTS.txt`: 748 `OK`, 0 other lines. The flag exits before any build code (script line 876); nothing was rebuilt |
| 3 | macOS arm64 zip extracted with `ditto -x -k` into `$TMPDIR/dems-reverify-96b/arm64`; `--self-test`; contents | PASS | `ditto` exit 0. `--version`: `DEMS Web Demo 0.1.0 (node v26.8.2, sea, darwin-arm64)`. `--self-test` (11:53:25): exit 0, `"ok": true`, `"mode": "sea"`, 511 files, 43,392,327 B, `hashMismatches: 0`, manifest `823581db…d8a8`, health 200, index 200 with CSP, WS `acceptOk`. Package: `DEMS Web Demo` (mode `-rwxr-xr-x`), `README-FIRST.txt`, `RUN-ON-ANOTHER-PC.md`, `licenses/` with `THIRD_PARTY_NOTICES.md`, `THIRD-PARTY-LICENSES.txt`, `OFL-Inter.txt`, `OFL-JetBrains-Mono.txt`, `OFL-Orbitron.txt`, `NODE-LICENSE.txt`. `find` for `.map`, `.env*`, `.docx`, `.jks`, `.keystore`, `.p12`, `.properties`, `node_modules`, `.DS_Store`, `._*`: 0 hits. The 511 embedded web paths (read from the manifest): 0 forbidden names |
| 4 | Real start `--no-open --port 4421`, loopback only | PASS | Banner: `Open in Chrome or Edge:  http://127.0.0.1:4421/` … `Listening on 127.0.0.1 only`. `lsof -nP -a -p <pid> -i`: one line, `TCP 127.0.0.1:4421 (LISTEN)`. `lsof -nP -iTCP:4421 -sTCP:LISTEN`: the same single line. Health 200. Same result in both runs (pids 57264, 57450) |
| 4a | Login shows "SECURE BY DESIGN." and "TRUSTED BY LAW."; old tagline absent on Login and Dashboard | PASS | Tagline element text `SECURE BY DESIGN. TRUSTED BY LAW.`; Dashboard hero starts with the same two lines. "TRUSTED RECORDING" searched in `innerText`, full `textContent`, `aria-label`/`title`/`alt`/`placeholder` and `document.title` of both pages: absent. Static: 0 of the 511 shipped web files contain "TRUSTED RECORDING" or "SAFER TOMORROW"; 1 contains "TRUSTED BY LAW.". `assets/13_login.png` |
| 4b | Sign in as `andi.pratama` (Supervisor); Dashboard renders; Core link Online | PASS | Fields filled by keyboard input, Sign In clicked by pointer, path `/dashboard`, h1 "Dashboard", 2,198 characters of text, header "Logged in as AKP Andi Pratama". Login status bar: `CORE LINK Online`; heartbeat socket `ws://127.0.0.1:4421/ws` open with frames arriving; `/stack-check` chip "Live". Role SUPERVISOR confirmed in `packages/shared/src/sim/dataset.ts:129-136` (the Dashboard itself does not print the role; see §4 N1, N2) |
| 4c | **F96-1 regression.** EV-20260929-0001 Verify → PASS, 8 of 8 | PASS | Before the click: verdict `NOT_RUN` ("NOT VERIFIED"), 8 rows `pending`. After: verdict `PASS`, "8 of 8 checks", 8 rows `pass`, all `source=computed`, label "DEMO - recomputed", button "Verify again", toast "Integrity verified: EV-20260929-0001 PASS". **Time to verdict 1,345 ms (run 1), 1,342 ms (run 2).** 0 CSP events, 0 `data:` fetches during Verify. `assets/13_verify_ev0001_pass.png` |
| 4c | **F96-1 regression.** EV-20260930-0005 Verify → FAIL on AUDIO-02 only | PASS | After: verdict `FAIL`, "8 of 8 checks", failed = [`track:AUDIO-02`], 7 rows `pass`, 0 unfinished. Row text: "AUDIO-02 · MIC 2 - Subject SHA-256 FAIL FOUND 6fdd78d18e…a49e5e91c8 SEALED bb3af24347…4394cd0d0c" (the same two values step 96 recorded). "Audit chain extract PASS" (the row that was stuck on "Checking" in step 96). **Time to verdict 1,337 ms (run 1), 1,329 ms (run 2).** 0 CSP events. `assets/13_verify_ev0005_fail.png` |
| 4d | 11 routes visited once; `securitypolicyviolation` events; requests to other hosts | PASS | `/dashboard`, `/session`, `/session/new`, `/evidence`, `/devices`, `/storage`, `/network-time`, `/security-audit`, `/system`, `/stack-check`, `/developer/api`: each lands on its own path with an h1, 0 CSP events, 0 exceptions. **CSP events, whole run: 0** (page events 0; CDP Audits CSP issues 0). **Requests to any host other than 127.0.0.1:4421: 0.** Run 1: 1,914 requests = `http://127.0.0.1:4421` 1,893 + `ws://127.0.0.1:4421` 17 + `data:` 3 + `blob:` 1. Run 2: 1,704 = 1,685 + 15 + 3 + 1. The 4 `data:`/`blob:` entries are images with no host (3 x `data:image/svg+xml` on `/evidence`, 1 `blob:http://127.0.0.1:4421/…` on Login), allowed by `img-src 'self' data: blob:`. HTTP status: 200 and 206 only; 0 failed loads; 0 console errors or warnings. `lsof` on the browser processes: every TCP socket goes to `127.0.0.1:4421` |
| 4e | Screenshots with prefix `13_` | PASS | `assets/13_login.png`, `assets/13_verify_ev0001_pass.png`, `assets/13_verify_ev0005_fail.png` (1600x1000, viewed in this session) |
| 5 | Any-OS zip: `Start (macOS).command --self-test` | PASS | 12:02:06 on node v26.8.2: exit 0, `"ok": true`, `"mode": "runtime"`, 511 files, `hashMismatches: 0`, manifest `823581db…d8a8`, health 200, index 200 with CSP, WS `acceptOk`. `--version`: `DEMS Web Demo 0.1.0 (node v26.8.2, runtime, darwin-arm64)` |
| 6 | Static check of windows-x64, linux-x64, macos-x64 and the signed-runtime fallback. **Not executed** | PASS (static only) | §3 |
| 7 | Clean-up | PASS | §5 |

Browser: HeadlessChrome/153.0.8010.12 (Playwright `chrome-headless-shell`, already cached; nothing installed), 1600x1000, raw CDP, DevTools on 127.0.0.1:9396. Started with `--host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost"`, so an external request could not leave the machine but would still be counted.

## 2. The two browser runs

| | Run 1 | Run 2 |
|---|---|---|
| Time (WIB) | 11:56:48-11:57:58 | 11:59:22-12:00:37 |
| Result | 23 of 23 driver checks pass | 23 of 23 driver checks pass |
| How the evidence page was reached | Deep link `/evidence/<id>?tab=integrity` | The presenter's path, by pointer: Evidence → search → row → preview "open" → "Hash & Integrity" tab → Verify |
| Evidence kept | `assets/13_browser_reverify.json` and the three screenshots | `assets/13_browser_reverify_run2.json` (adds the list of `data:`/`blob:` requests) |
| Launcher after SIGINT | exit 0, "Stopping... / Menghentikan..." | exit 0, same line |

Run 2 was added because run 1 opened the detail page by deep link and stored only the count of `data:`/`blob:` requests. Driver: `assets/13_cdp_driver.mjs` (the run-2 version; run 1 differed only in those two points). Runner: `assets/13_run.sh`. The driver reads the demo password from `dataset.ts` at run time; it is not in any evidence file (`grep -c` = 0 in all four).

## 3. Check 6: static proof for the packages that were not run

These four packages were **not executed**. No claim is made that they start.

| Item | windows-x64 (SEA) | linux-x64 (SEA) | macos-x64 (runtime) | windows-x64-signed-runtime (F1) |
|---|---|---|---|---|
| Archive lists cleanly | `unzip -tq`: no errors; 11 entries | `gzip -t` exit 0, `tar -xzf` exit 0; 11 entries | `unzip -tq`: no errors; 529 entries | `unzip -tq`: no errors; 529 entries |
| Start file, mode in the archive | `DEMS Web Demo.exe` `-rwxr-xr-x` | `dems-web-demo` `-rwxr-xr-x` | `DEMS Web Demo (Intel).command` `-rwxr-xr-x`, 0 CR; `runtime/node` `-rwxr-xr-x` | `Start DEMS Web Demo.cmd` `-rw-r--r--` (5 of 5 lines CRLF); `runtime/node.exe` present |
| `file` type | PE32+ executable (console) x86-64 | ELF 64-bit LSB executable, x86-64 | `runtime/node`: Mach-O 64-bit executable x86_64 | `runtime/node.exe`: PE32+ executable (console) x86-64 |
| Binary sha256 = BUILD-INFO | `017a474b…b6cc` yes | `09c8f463…f2ee` yes | `724b8ccb…265f` yes | `23062343…dbca` yes |
| SEA fuse | `:1` present, `:0` absent | `:1` present, `:0` absent | n/a | n/a |
| `licenses/` | 6 files | 6 files | 6 files | 6 files |
| Guide inside | byte-equal to `release/RUN-ON-ANOTHER-PC.md` (`e2a39f0a…c69a`) | byte-equal | byte-equal | byte-equal |
| Forbidden names (`.map`, `.env*`, `.docx`, keystore, `.properties`, `node_modules`, `.DS_Store`, `._*`, `__MACOSX`, `signing`) | 0 | 0 | 0 | 0 |

`web-manifest.json` across all six packages: **identical, sha256 `823581dbfc538539e739373a4f19f2cf9e5f44588da21f3debeaa977afc3d8a8`** (93,013 B).

| Package | How it was read | Result |
|---|---|---|
| macos-x64, windows-x64-signed-runtime, any-os-node | `shasum` of `app/web-manifest.json` | `823581db…d8a8` x 3 |
| macos-arm64, windows-x64, linux-x64 (SEA) | Byte search of the binary for the exact 93,013 bytes of that file | Found once in each binary; sha256 of the embedded bytes = `823581db…d8a8` |
| macos-arm64, any-os-node | Reported by `--self-test` | `823581db…d8a8` x 2 |

Also the same in all six: `THIRD_PARTY_NOTICES.md` `4cbdec5c…` (= the repo file), `THIRD-PARTY-LICENSES.txt` `ca1def1c…`, `OFL-Inter.txt` `3b0a5fca…`, `OFL-JetBrains-Mono.txt` `403581b6…`, `OFL-Orbitron.txt` `075b0137…` (all equal to BUILD-INFO). `app/web/` holds 511 files in each of the three runtime packages. `dems-web-launcher.cjs` is `091a2001…4f16` in all three (= source = BUILD-INFO).

F96-1 root cause, checked statically: 0 `data:application/` strings in the shipped JS (step 96 counted 57 inlined files); the 14 `audit-session-extract` files ship as real files.

## 4. Notes (none changes the verdict)

| ID | Note |
|---|---|
| N1 | The Dashboard has no Core-link chip (step 96 said the same). "Core link Online" is shown on Login; on the Dashboard side it is proven by the open heartbeat socket and the `/stack-check` chip "Live" |
| N2 | The Dashboard header shows "AKP Andi Pratama" but not the word "Supervisor". The role comes from `dataset.ts` |
| N3 | The footer line "SECURE RECORDING / TRUSTED EVIDENCE / SAFER COMMUNITIES" is still on Login and in the side rail. It is a different string from the old tagline and was left out of scope by D128 (`implementation/80_tagline.md:36`) |
| N4 | Login shows "v2.4.1" under the sign-in card while the package version is 0.1.0. Not investigated; whether this is the intended simulated device version is for the controller |
| N5 | `NODE-LICENSE.txt` has one hash in the three Unix packages (`5888dbb9…`) and another in the two Windows packages (`ed34dd8e…`); the any-OS zip has none. Hypothesis, not verified: each comes from its own Node.js archive |
| N6 | Sandbox: local port binding is off, and `ps`/`pgrep` cannot read the process list inside it. Five commands ran outside the sandbox: the two `--self-test` runs, the two browser runs, and one read-only `pgrep`/`lsof`. Each `--self-test` was first tried inside the sandbox and failed only at `listen EPERM: operation not permitted 127.0.0.1` (assets already at 511 files, 0 mismatches). `sandbox.network.allowLocalBinding: true` would remove most of this |

## 5. Not run, and why

| Item | Reason |
|---|---|
| Execution of windows-x64, linux-x64, macos-x64, windows-x64-signed-runtime | This host is macOS arm64. Static proof only (§3) |
| Export wizard and zip download | Not in this step's check list. Step 95b ran it (`implementation/78_web_packager_rebuild.md` §5); it is not independently confirmed here |
| Session flow (Start → Recording → Sealed), player, API Reference Try-it | Not in this step's check list; passed in step 96 on the previous build |
| Gatekeeper prompt, Finder double-click, Safari, Firefox | Sandbox blocks Launch Services; other browsers are outside this step |
| Windows SEA Authenticode (F-62-06), GPG signature of Node's SHASUMS256.txt | Known issues from earlier steps; not re-checked |
| Typecheck, lint, unit tests | Not in this step; step 95b ran the gate at 11:42-11:44 |
| Android | This step does not touch Android; no `adb` command was run |
| `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md`, `implementation/99_implementation_report.md` | Not edited: parallel run, the controller synthesises |

## 6. Clean-up

| Check | Result | Evidence |
|---|---|---|
| Launcher stopped with SIGINT | exit 0 in both runs | `launcher exit after SIGINT: 0`; log tail " Stopping... / Menghentikan..." |
| Listener on 4421 or 9396 | none | `lsof -nP -iTCP -sTCP:LISTEN \| grep -E ":(4421\|9396) "` → no line (11:57:58, 12:00:37, 12:02:29) |
| Stray processes | none | 12:02:29, outside the sandbox: `pgrep -fl "chrome-headless-shell\|DEMS Web Demo\|dems-web-launcher"` → no output, exit 1 |
| `$TMPDIR/dems-reverify-96b` | removed | `ls -d` → "No such file or directory" |
| User's servers | untouched | Same PIDs before and after: 42967 `127.0.0.1:4400`, 42998 `127.0.0.1:5173`, 43101 `127.0.0.1:8081`; also 3489 `[::1]:5173`, 3521 `[::1]:5175`, 3550 `127.0.0.1:5174`. Ports used by this step: 4421, 9396 and two ephemeral self-test ports (56422, 57141), all on 127.0.0.1 |
| `release/` | unchanged | mtimes still 11:45 (BUILD-INFO.txt 11:48, guide 11:38); `shasum -c` again at 12:02: 6 x `OK` |
| Files written | only under `docs/2026-09-30_dems_demo_stack_setup/verification/` and `delegation_progress/verifier_step_96b.md` | No source, `release/`, `package.json` or lockfile change; no install; no git write; no Docker; no external network call |

---
*Generated: 2026-10-01 12:04 WIB*
