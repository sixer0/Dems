---
task_id: 2026-09-30_dems_demo_stack_setup
step: 95b
plan_row: controller step 95b (D124), extended by D127 and D128
date: 2026-10-01
agent: coder-execution
tier: 3
status: complete
decisions: D123, D124, D126, D127, D128
---

# Step 95b: web packager rebuild

**Outcome: COMPLETE.** Six web packages were rebuilt at 11:45 WIB from the current tree, after `80_tagline.md` (11:33:47). Browser smoke on port 4420: **27 of 27 checks pass**, **0 CSP reports**, 0 external requests. One deviation needs a controller ruling: DR-95b-1 (the Zod fix is more than one line).

## 1. Packages (`release/web/`, built 11:45:10–11:45:58 WIB)

| Package | Bytes | SHA-256 |
|---|---|---|
| `DEMS-Web-Demo-0.1.0-windows-x64.zip` (SEA) | 76,213,194 | `5ba6368f7785fe8acaa1484d7c31528b39ffb0bd3b1caed12845b9eac7d87e65` |
| `DEMS-Web-Demo-0.1.0-macos-arm64.zip` (SEA, ad-hoc signed) | 80,746,025 | `4f0f9e83c5ff9cfb49d918022155e0bd029b17514c626f396df71933dae97c59` |
| `DEMS-Web-Demo-0.1.0-linux-x64.tar.gz` (SEA) | 83,886,762 | `78ae50d8dd3cf67ce4e7972af4e7d511a8672859624d49f7cc8dd3f4824b05eb` |
| `DEMS-Web-Demo-0.1.0-macos-x64.zip` (official node + `.command`) | 83,136,920 | `a24dcbd37291b0d70b62c2864d4e8ab75782f70000e4c32a06322de67a0b8583` |
| `DEMS-Web-Demo-0.1.0-windows-x64-signed-runtime.zip` (F1) | 76,256,035 | `0859baa495125c8f5bdb054099105bf04accbeb1a61935d593b75dbdbf1ca6ae` |
| `DEMS-Web-Demo-0.1.0-any-os-node.zip` (F2) | 37,196,089 | `a5c50d058cc3479ce82e3350dac354fb240e4f06e1682b63579ddf93596e0226` |

- File names are unchanged. Every hash changed. `SHA256SUMS.txt`, the six `.sha256` files and `BUILD-INFO.txt` are refreshed; `BUILD-INPUTS.txt` is new.
- `shasum -a 256 -c SHA256SUMS.txt` gives 6× `OK`; each `.sha256` gives `OK`.
- Dist: 511 files, 43,392,327 B (was 432 files: no asset is inlined now). `web-manifest.json` sha256 `823581db…d8a8`.
- Launcher unchanged: sha256 `091a2001…4f16`, the same as the step 95 build.
- Node downloads reused from `.cache/release/node-v26.8.2/`. All four archives and `win-x64/node.exe` equal the cached `SHASUMS256.txt` (`c31cbd53…7dad3`); lines in `BUILD-INFO.txt`.
- Command: `node --import tsx scripts/release/build-web-packages.ts --skip-gate --skip-smoke` (gate and smoke ran separately: the sandbox refuses a local listen).

## 2. Findings

| Finding | Result | Evidence |
|---|---|---|
| F-62-01 current notices | **Closed** | `licenses/THIRD_PARTY_NOTICES.md` in all 6 packages = `4cbdec5c…920f` = the repo file (read back from the archives by the packager and by hand) |
| F-62-02 licence texts | **Closed** (best effort) | Every package has `licenses/OFL-Inter.txt`, `OFL-JetBrains-Mono.txt`, `OFL-Orbitron.txt` (byte-equal to `@fontsource-variable/*/LICENSE`) and `THIRD-PARTY-LICENSES.txt` (871,171 B, `ca1def1c…ee0a`): 389 npm packages, 381 with licence text, 8 with the licence name only. `NODE-LICENSE.txt` as before (5 packages). New script `scripts/release/collect-web-licenses.ts`, Node built-ins only. The list is the production tree of `@dems/core-web`, so it is a superset of the bundle |
| F-62-03 Zod probe | **Closed**, with deviation DR-95b-1 | CSP reports 0 over the whole walk (was 28). See §4 |
| F-62-05 `NODE_OPTIONS` | **Closed** | `unset NODE_OPTIONS` now comes before the `node -e` check in `Start (macOS).command` and `start-linux.sh`. With `NODE_OPTIONS="--require inject.cjs"`: plain `node -e 0` prints the injection (control); both scripts and the SEA print none |
| F-62-08 provenance | **Closed** | `BUILD-INFO.txt` has the git status (989 paths, by code and by area, plus the 111 entries that touch a build input), the SHA-256 and mtime of both packager scripts, and a fingerprint of 748 input files (digest `0e324957…f1a3`, newest mtime per root). `BUILD-INPUTS.txt` lists every input hash. `--verify-inputs` after the build: "no build input changed" |
| F-62-06 Windows SEA Authenticode | **Open, known issue** | No `signtool` or `osslsigncode` on the host, and `--build-sea` has no option for it. The exe still has the directory entry (offset 103,746,048, 15,688 B, now zeros). A hand-written PE header edit is possible, but it cannot be run-tested here, so it was not done |
| F96-1 Verify never finishes (D127) | **Closed** | `build: { assetsInlineLimit: 0 }` in `apps/core-web/vite.config.ts`. 0 `data:application/` URIs in the dist JS. EV-20260929-0001 → PASS, 8 of 8; EV-20260930-0005 → FAIL on `track:AUDIO-02` only. CSP not changed |
| F96-2 guide inside packages | **Closed** | `RUN-ON-ANOTHER-PC.md` is in the top folder of all 6 packages, byte-equal to `release/RUN-ON-ANOTHER-PC.md` (`e2a39f0a…c69a`). `README-FIRST.txt` says "(in this folder)" |
| F96-3 "LIVE" wording | **Closed** | Guide §9 and §10 now say "Core link: Online" / "Core link: Offline", as the Login page does |
| F96-4 any-OS start file | **Closed** | Guide §2 names `Start (Windows).cmd`, `Start (macOS).command` and `./start-linux.sh`; ID summary too |
| D126 USB debugging line | **Closed** | Guide §8 Method A step 5 and the ID summary |
| D128 tagline | **In the build** | Login and Dashboard show "SECURE BY DESIGN. / TRUSTED BY LAW." (`assets/78_login.png`) |
| F-62-04, F-62-07 | Not in scope here | Known issue / step 66 (D124) |

## 3. Files changed

| File | Change |
|---|---|
| `scripts/release/collect-web-licenses.ts` | new (248 lines) |
| `scripts/release/build-web-packages.ts` | licences in every package; `unset NODE_OPTIONS`; provenance block, `BUILD-INPUTS.txt`, `--verify-inputs`; guide inside every package (archives are written twice so the sizes in the guide match); guide wording; the guide file is rewritten only when its text changes |
| `apps/core-web/vite.config.ts` | `build: { assetsInlineLimit: 0 }` plus a comment (D127) |
| `apps/core-web/src/main.tsx` | Zod jitless and boot order (DR-95b-1) |
| `release/web/*`, `release/RUN-ON-ANOTHER-PC.md` | output. The guide text changed (F96-3, F96-4, D126) |
| `docs/.../implementation/assets/78_*.png`, `78_browser_smoke.json` | smoke evidence |

Not touched: `release/android/`, the launcher, `THIRD_PARTY_NOTICES.md`, any `package.json`. Nothing installed, nothing committed.

## 4. Deviation for the controller: DR-95b-1

**The one-line Zod fix does not work, so `main.tsx` changed by more than one line.**

- Measured first, as instructed: `z.config({ jitless: true })` in the body of `main.tsx`. Result: still **28 reports**, 2 per page load.
- Cause: Zod probes `Function('')` when the first object schema is built. Static imports run before the module body, and the routes and `@dems/shared` build schemas at import time.
- Fix applied, inside `main.tsx` only: the call stays, and the three imports that build schemas are loaded after it, in their original order:
  `const { createSim } = await import('@dems/shared/sim')`, `await import('./i18n')`, `const { createAppRouter } = await import('./router')`. The `SimErrorReport` import became `import type`.
- Result: **0 reports** (page events and the CDP Audits domain), gate green, all flows work.
- To undo: restore the three static imports and delete the `z.config` line; the Zod reports return as a cosmetic known issue. The backup is `main.tsx.before-95b` in the session scratchpad (`s95b/`).

Other decisions:

| # | Decision | Reason |
|---|---|---|
| DR-95b-2 | F-62-06 left as a known issue | No built-in tool; an untested PE edit on the primary Windows package is a worse risk than the finding |
| DR-95b-3 | `BUILD-INPUTS.txt` and `--verify-inputs` added | Step 66 can prove "no source changed after the build" with one command |
| DR-95b-4 | Launcher tests not re-run | One test binds 4410/4411 (step 96 may hold 4410). The launcher is byte-identical to the build that passed 13/13 |
| DR-95b-5 | `02_plan.md`, `status_tasks.md`, `delegation_progress_report.md`, `99_implementation_report.md` not edited | Parallel-run instruction |

## 5. Gate and smoke (fresh, 2026-10-01 WIB)

| Check | Result |
|---|---|
| core-web `tsc -b` / `oxlint` (11:43) | exit 0 / exit 0 |
| core-web `vitest run --maxWorkers=2` (11:42:16–11:42:56) | 39 files, **438 passed**. An earlier run at 11:35, with the host at load average 108 from another lane, had 2 timeouts (`routes.test.tsx`, `security-audit.test.tsx`); neither failed at normal load |
| mock-core `tsc`; standalone `tsc`; packager `tsc` (strict) | exit 0 |
| macOS arm64 SEA `--self-test`, from a `ditto -x -k` copy in `$TMPDIR` | exit 0, `"mode":"sea"`, 511 assets, 0 hash mismatches |
| Any-OS zip `Start (macOS).command --self-test` (node v26.8.2) | exit 0, `"mode":"runtime"`, 0 mismatches |
| Real start `--no-open --port 4420` | health 200; `lsof` shows only `127.0.0.1:4420 (LISTEN)`; SIGINT exit 0; no listener left. Ports 4410, 4400, 5173–5175 were never used; the manual-test servers keep their PIDs |
| Headless Chromium 153 over CDP, 11:46–11:47 | **27/27**: tagline on Login and Dashboard; Core link Online; Login → Dashboard; 11 routes, each with 0 CSP reports; Try-it on health 200; Verify PASS 8/8 and FAIL on AUDIO-02 only; export of EV-20260930-0004 as `andi.pratama` downloads `EXP-000031.zip` (2,276,249 B, sha256 `d888f544…` = the export manifest) |
| Network | 1,923 requests; hosts = {`http://127.0.0.1:4420`, `ws://127.0.0.1:4420`}; **external 0** |
| CSP | **0** `securitypolicyviolation` events; **0** CDP Audits CSP issues |
| Package contents | No `.map`, `.env*`, `.docx`, keystore, `node_modules`, `.DS_Store` or `._*`. Exec bit on the 3 SEA binaries, `runtime/node`, 2 `.command`, `start-linux.sh` |

Evidence: `assets/78_login.png`, `78_dashboard.png`, `78_stack_check.png`, `78_api_reference_try_it.png`, `78_verify_ev0001_pass.png`, `78_verify_ev0005_fail.png`, `78_export_zip.png`, `78_browser_smoke.json`.

## 6. Not verified here

- The Windows, Linux and Intel-Mac binaries were not run (static proofs only: fuse, marker, `file` type), as in step 95.
- Step 96b should re-run its own Verify and export checks on these hashes.
- Three trial builds preceded the final one (11:27, 11:34, 11:44); their hashes are superseded.

---
*Generated: 2026-10-01 11:52 WIB*
