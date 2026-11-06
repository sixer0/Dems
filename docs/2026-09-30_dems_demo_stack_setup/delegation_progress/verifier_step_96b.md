---
step: 96b
agent: verifier
status: complete
result: VERIFICATION_PASSED (7 of 7 required checks; F96-1 closed)
window: 11:52-12:04 WIB, 2026-10-01
output: verification/13_package_reverification.md
---

# Step 96b package re-verification: progress (parallel run)

| Time (WIB) | Event |
|---|---|
| 11:52 | Inputs read: `12_package_verification.md`, `78_web_packager_rebuild.md`, BUILD-INFO.txt, SHA256SUMS.txt, RUN-ON-ANOTHER-PC.md. |
| 11:52:47 | Check 1: `shasum -a 256 -c SHA256SUMS.txt` 6 x OK; each `.sha256` OK; all 6 hashes equal BUILD-INFO.txt. |
| 11:53:00 | Check 2: `node --import tsx scripts/release/build-web-packages.ts --verify-inputs` exit 0, "OK: no build input changed since the packages were built" (748 files, digest `0e324957…f1a3`). |
| 11:53:06-11:53:25 | Check 3: macOS arm64 zip extracted with `ditto -x -k` into `$TMPDIR/dems-reverify-96b`. `--self-test` exit 0, 511 assets, 0 hash mismatches (outside the sandbox; inside it stops at `listen EPERM`). Contents and hygiene clean. |
| 11:56:48-11:57:58 | Check 4, run 1: launcher on 127.0.0.1:4421 only; headless Chromium 153 over CDP, 23/23. Tagline correct, old tagline absent; `andi.pratama` → Dashboard; EV-20260929-0001 PASS 8/8 in 1,345 ms; EV-20260930-0005 FAIL on AUDIO-02 only in 1,337 ms; 11 routes; CSP events 0; external requests 0 of 1,914. SIGINT exit 0. |
| 11:59:22-12:00:37 | Check 4, run 2 (evidence opened through search → row → preview → tab, by pointer): 23/23; verdicts in 1,342 ms and 1,329 ms; CSP 0; external 0 of 1,704. SIGINT exit 0. |
| 12:01-12:02 | Check 6: the other four packages extracted and checked statically (not executed): archives clean, mode bits right, binary hashes = BUILD-INFO, `licenses/` present, `web-manifest.json` `823581db…d8a8` identical in all six (3 files + 3 byte-identical embedded copies). |
| 12:02:06 | Check 5: any-OS `Start (macOS).command --self-test` exit 0, runtime mode, 0 mismatches. |
| 12:02:18-12:02:29 | Check 7: temp folder removed; no listener on 4421/9396; no launcher or headless process; user servers keep their PIDs; `release/` unchanged. |
| 12:04 | Report written. |

## Decisions for the controller

| # | Decision | Reason |
|---|---|---|
| DR-96b-1 | A second browser run was added | Run 1 reached the evidence page by deep link and stored only the count of `data:`/`blob:` requests. Run 2 used the presenter's click path and listed them (4 images, no host) |
| DR-96b-2 | Five commands ran outside the sandbox (2 self-tests, 2 browser runs, 1 read-only `pgrep`) | Local port binding is off in the sandbox and `pgrep` cannot read the process list there. The brief foresaw one such command |
| DR-96b-3 | `--host-resolver-rules` blocks non-loopback names in the test browser | Guarantees no external call from this step; an attempted one would still be counted |
| DR-96b-4 | `02_plan.md`, `status_tasks.md`, `delegation_progress_report.md`, `99_implementation_report.md` not edited | Parallel-run instruction |

## Open items for the controller

- Windows, Linux and Intel-Mac packages are still unexecuted by any step (static proof only).
- Export flow was not re-run here; step 95b's run is the only evidence on this build.
- Notes N3 (footer triplet kept), N4 ("v2.4.1" on Login) and N5 (two `NODE-LICENSE.txt` hashes) in the report are informational.

## Files created

- `verification/13_package_reverification.md`
- `verification/assets/13_login.png`, `13_verify_ev0001_pass.png`, `13_verify_ev0005_fail.png`
- `verification/assets/13_browser_reverify.json`, `13_browser_reverify_run2.json`
- `verification/assets/13_cdp_driver.mjs`, `13_run.sh`
- `delegation_progress/verifier_step_96b.md` (this file)
