---
step: 96
agent: verifier
status: complete
result: VERIFICATION_FAILED (1 High: F96-1, web packages); Android PASS; docs PASS with Low notes
window: 10:50-11:30 WIB, 2026-10-01
output: verification/12_package_verification.md
---

# Step 96 package verification: progress (parallel run)

| Time (WIB) | Event |
|---|---|
| 10:50 | Inputs read: row 96 (rev 6), 06_packaging_spec.md §5, logs 69/70/73, release/*. |
| 10:51 | Checksums: android 1/1 OK, web 6/6 OK (SHA256SUMS + each .sha256). Debug APK sha256 cb6b1f51…0be5 matches step 94's log. Emulators 5554/5556/5558 up, locks free. |
| 10:51:56–11:03:43 | Part A on dems_tablet (emulator-5556) under `device-session.sh tablet`, NO_METRO=1. Method A install Success (vc 100, not debuggable); offline; cold launch 2825 ms; picker sign-in; Home; Start Session 8/8; Recording SES-20261001-0024; End Session with reason; SEALED EV-20261001-0014; EV-20260929-0001 PASS; EV-20260930-0005 FAIL on AUDIO-02; playback with 2 AudioTracks; Heartbeat `enabled="false"`; dev-gallery → Home. Logcat: 0 FATAL, 0 RN errors, 0 Metro/8081, 0 cleartext. Restored: airplane off, release uninstalled, debug reinstalled (vc 1, DEBUGGABLE). Lock released. No emulator booted or killed. **Part A PASS.** |
| 11:04–11:06 | macOS arm64 SEA copied to $TMPDIR and extracted with ditto. spctl on a quarantined copy: rejected (expected). `--version`, `--self-test` ok (432 assets, 0 mismatches). Started on 127.0.0.1:4410; lsof loopback only. |
| 11:06–11:19 | Headless Chromium 153 over CDP: Login → Dashboard → Session Monitor → Start Session → RECORDING → End Session → SEALED; all pages; player; Try-it health 200. 1,797 requests, 0 external. **F96-1 found:** Evidence Verify stuck at "Audit chain extract — Checking" / "NOT VERIFIED" (fetch of an inlined data: URI blocked by CSP connect-src). |
| 11:19–11:21 | Hardening curls (421/403/404/405/206), single instance, SIGINT exit 0 with WS 1001, port fallback 4411, open-failure fallback line. Any-OS zip: self-test ok and real start on Node 26.8.2. |
| 11:21–11:25 | Static checks: Windows SEA, Linux SEA, Intel-Mac runtime (notarized), F1 node.exe = official hash; SHASUMS256.txt re-fetched from nodejs.org = cached copy; archive hygiene clean. |
| 11:25–11:27 | Docs followed literally for macOS arm64: all steps work; 4 Low notes (F96-2…F96-5). Clean-up done: temp folder removed, no processes or listeners left. |
| 11:30 | Report written. |

## Files created

- `verification/12_package_verification.md`
- `verification/assets/96_tablet_*.png` (31), `verification/assets/96_web_*.png` (24)
- `verification/assets/96_web_events.jsonl`, `96_tablet_logcat_app_warn_error.txt`, `96_web_cdp_driver.mjs`
- `delegation_progress/verifier_step_96.md` (this file)

## Blockers and decisions for the controller

1. **F96-1 (High) blocks the web packages.** Owner: step 100 (fix in `apps/core-web/vite.config.ts`, preferred `build.assetsInlineLimit: 0`; or add `data:` to `connect-src` in `packaged-csp.ts` and the launcher together), then step 95 rebuilds, then re-run the two Verify checks.
2. F96-2…F96-4 (Low, docs) → step 95. F96-5 (Low, docs) → step 94.
3. F96-9: emulator-5554 had reverse rules 8081/4400 with its lock free at 11:27; not from this step.
4. `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md` and `99_implementation_report.md` were not edited (parallel run).
5. Not run: phone re-walk, V-R1 (step 61), V-S7 Docker (needs user OK), Finder/Gatekeeper GUI, Safari/Firefox.
