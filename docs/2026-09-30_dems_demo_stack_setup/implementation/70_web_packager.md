---
task_id: 2026-09-30_dems_demo_stack_setup
step: 95
plan_row: blueprint row 95 (rev 6); masterplan/06_packaging_spec.md §3–§4
date: 2026-10-01
agent: coder-execution
tier: 3
status: complete
decisions: D94, D104, D110, D112, D113
---

# Step 95: web packager

**Outcome: COMPLETE (fast-track, D112).** Six web packages are in `release/web/`, with a `.sha256` for each, plus `SHA256SUMS.txt` and `BUILD-INFO.txt`. `release/RUN-ON-ANOTHER-PC.md` is written. Both input steps were in before the build: step 100 (`73_web_core_origin.md`, 10:30) and step 54 (`33_sim_gap_closure_web.md`, 10:32). No wait was needed.

## 1. Files

| File | Change |
|---|---|
| `apps/mock-core/standalone/dems-web-launcher.cjs` | new: the launcher (§3.3). Node built-ins only; `// @ts-check` |
| `apps/mock-core/standalone/tsconfig.json` | new: `checkJs` for the launcher |
| `apps/mock-core/test/standalone-launcher.test.ts` | new: 13 tests (contract guard, CSP equality with `packagedCsp`) |
| `scripts/release/build-web-packages.ts` | new: the packager (§3.6). Tracked, because `.gitignore` anchors `/release/` |
| `release/web/*`, `release/RUN-ON-ANOTHER-PC.md` | output (git-ignored) |
| `docs/.../implementation/assets/70_*.png`, `70_browser_smoke.json` | smoke evidence |

No app source and no `package.json` were edited, and nothing was installed. The cache is `.cache/release/` (git-ignored).

## 2. Packages (`release/web/`, built 10:43 WIB)

| Package | Bytes | SHA-256 |
|---|---|---|
| `DEMS-Web-Demo-0.1.0-windows-x64.zip` (SEA) | 76,103,975 | `4a0d75ad919542979852b5b8b28a67ae20ff63bdca070e33c2ff8a8ebe9261e0` |
| `DEMS-Web-Demo-0.1.0-macos-arm64.zip` (SEA, ad-hoc signed) | 80,632,683 | `bf5de858ff1584b780fb49bd52baea1ac10e64117c2a6543f42baa4ff4462cef` |
| `DEMS-Web-Demo-0.1.0-linux-x64.tar.gz` (SEA) | 83,782,250 | `fce355e9e97b4242e27fc1757e431c7e19f439a0ab5eff7a4db14cff716d8c47` |
| `DEMS-Web-Demo-0.1.0-macos-x64.zip` (official node + `.command`) | 83,007,868 | `10c69dcfed6db77b75c8c635b956b598b95c6892413eba418f7f92fd7f57357a` |
| `DEMS-Web-Demo-0.1.0-windows-x64-signed-runtime.zip` (F1) | 76,124,129 | `1ac1d142cec0abd27bb6a8e5e83349fec06e3d8874b372299aa0c62cb9142925` |
| `DEMS-Web-Demo-0.1.0-any-os-node.zip` (F2, Node 22 or newer) | 37,066,690 | `e7d1c40ab297f443ffdc76af64173c07e7cfceddc1236fa0d203c606988b57bf` |

- Total 439 MB, below the spec estimate of 0.6–0.7 GB.
- Dist: 432 files, 43,416,532 B, inside the H-PK-13 range.
- Run command: `node --import tsx scripts/release/build-web-packages.ts [--skip-gate] [--skip-web-build] [--skip-smoke]`. The final run used `--skip-gate --skip-smoke`, because the gate and the smoke ran separately (§4).

## 3. Acceptance criteria (06 §3.8)

| AC | Evidence | Result |
|---|---|---|
| W3 | 6 packages, each with a `.sha256`. `shasum -a 256 -c SHA256SUMS.txt` gives 6× `OK` | PASS |
| W4 | `.cache/release/node-v26.8.2/SHASUMS256.txt` (sha256 `c31cbd53…7dad3`) matches spec §10.2. `974b6d5f…c9e1` darwin-arm64, `adb8feb2…629c` darwin-x64, `badb3fe6…6f35` linux-x64, `cf02f5d0…9085` win-x64.zip: all `OK`. F1 `runtime/node.exe` = `23062343ad39…ddbca` = SHASUMS `win-x64/node.exe`. macOS x64 `runtime/node` = `724b8ccb…265f` = the binary from the verified tarball (TeamIdentifier `HX7739G8FX`, hardened runtime). **GPG was not checked:** gpg is absent | PASS (GPG gap noted) |
| W5 | Fuse `…:1` count 1 and marker `DEMS_WEB_LAUNCHER_BUILD=0.1.0` count 1 in all 3 SEA binaries. `codesign --verify --strict`: "valid on disk / satisfies its Designated Requirement". `file`: `Mach-O 64-bit executable arm64` (187,804,000 B), `PE32+ executable (console) x86-64` (147,458,888 B), `ELF 64-bit LSB executable, x86-64` (193,998,020 B) | PASS |
| W6 | macOS arm64 SEA run from a `ditto -x -k` copy in the session scratchpad (outside the workspace): `--self-test` exit 0, `"mode":"sea"`, 432 assets, `hashMismatches: 0`. Any-OS zip, via `Start (macOS).command --self-test` on node v26.8.2: exit 0, `"mode":"runtime"`, 0 mismatches | PASS |
| W7 | Real start on 127.0.0.1:4410. Health is `HealthResponseSchema` VALID. 3 heartbeats are `HeartbeatSchema` VALID (seq 11→13). `lsof -a -p <pid> -i` shows only `127.0.0.1:4410 (LISTEN)` plus loopback ESTABLISHED. With `/developer/api` open, health reports `clients: 2`, as step 100 expects | PASS |
| W8 | Covers Windows, macOS arm64, macOS x64, Linux and Android, with the ID summary. All 8 cited `web/…` and `android/…` files exist (step 94's APK and `INSTALL-ANDROID.md` are present) | PASS |

**Other checks:**
- **Launcher lifecycle:** a second launch prints "already running" and exits 0. SIGINT exits 0.
- **Package contents:** no `.map`, `.env*`, `.docx`, keystore, `node_modules`, `.DS_Store` or `._*` in any package. The exec bit survives `ditto -x -k` (H-PK-20).
- **`index.html`:** its CSP meta tag equals `packagedCsp({delivery:'meta'})`, and it has 0 inline `<script>`. The launcher header equals `packagedCsp({delivery:'header',port})`, asserted in the test and in the packager.

## 4. Gate and browser smoke (fresh, 2026-10-01 WIB)

| Check | Result |
|---|---|
| core-web `tsc -b` / `oxlint` | exit 0 / exit 0 |
| core-web `vitest run --maxWorkers=2` | 39 files, 438 tests passed |
| mock-core `vitest run` (outside the sandbox: local bind gives EPERM inside it) | 4 files, 19 tests passed (13 launcher) |
| mock-core `tsc --noEmit`; `tsc -p standalone/tsconfig.json`; packager `tsc` (ESM, strict) | exit 0 |
| Headless Chromium 153 (Playwright `chrome-headless-shell`, already cached) over CDP, against the SEA copy on :4410 | Login renders. Sign In is enabled (Core LIVE through the same-origin heartbeat). Login → `/dashboard`. 11 routes render (dashboard, session, session/new, evidence, devices, storage, network-time, security-audit, system, stack-check with the heartbeat chip "Live", developer/api). The API Reference banner shows "MOCK-CORE ONLINE". **Scalar Try-it on health: `200 OK`** (screenshot `assets/70_api_reference_try_it.png`) |
| Network log | 1,247 requests. Hosts = {`http://127.0.0.1:4410`, `ws://127.0.0.1:4410`}: no external request |
| CSP walk (R-PK-4) | **28 reports, all one kind:** `script-src` blocked `eval` at `/assets/clsx-*.js:1`, 2 per page load. Cause: Zod v4's JIT capability probe `try { Function(''); return true } catch { return false }`. Zod catches it and runs jitless, so there is no functional impact. Every page and flow above worked. **The CSP is not widened** (`'unsafe-eval'` would be a real loosening for a cosmetic report) |

## 5. Decisions and deviations

| # | Decision | Reason |
|---|---|---|
| DR-95-1 | The launcher and the packager are at the spec paths (`apps/mock-core/standalone/`, `scripts/release/`) | Row 95 and 06 §3.3/§3.6 name them |
| DR-95-2 | The single-instance probe checks **every** busy port in 4410–4419 for `X-DEMS-Launcher`, not only 4410 | Without this, a second copy started a new instance when the first sat on a fallback port. Strictly better |
| DR-95-3 | The CSP is kept as specified. The Zod eval-probe report is accepted as cosmetic (§4) | The spec allows widening one directive only, with a reason. No functional reason exists |
| DR-95-4 | The gate and the smoke ran outside the packager invocation, and are recorded in `BUILD-INFO.txt` as "post-build verification" | Local listen is EPERM inside the sandbox. Those commands needed per-command sandbox bypasses |
| DR-95-5 | The Start Session flow was loaded, not driven step by step | Fast-track D112. Step 96 owns the full walk |
| DR-95-6 | `02_plan.md`, `status_tasks.md` and `99_implementation_report.md` were not edited | Parallel-run instruction. The controller synthesizes from this log and `delegation_progress/coder_execution_step_95.md` |

## 6. Hand-overs and known issues

- **The Zod eval-probe CSP report (owner: core-web / step 100 or the end pass).** Optional fix: call `z.config({ jitless: true })` once at app start (`apps/core-web/src/main.tsx`). It removes the 2 reports per page without touching the CSP. Not done here, because P6 forbids app-source edits.
- **Not runnable here (F-12):** the Windows, Linux and macOS x64 binaries. Static proofs only. The guide tells presenters to run `--self-test` the day before.
- **The Windows SEA exe** still carries Node's Authenticode certificate table, which the injection invalidates. Windows treats it like an unsigned file (SmartScreen prompt). Smart App Control may block it, which is what F1 is for.
- **Step 96:** `spctl` on the quarantined case (V-W2), the full Start Session walk, and the Safari/Firefox gap.

---
*Generated: 2026-10-01 10:50 WIB*
