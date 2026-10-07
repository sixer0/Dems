# W94-W96 final short confirmations + FXR-M device checklist (verifier)

- **Status:** needs-review. W94, W95 and W96 PASS (1 run + 1 verification run each, D232/D233). The FXR-M device
  checklist is 7/9 PASS with 2 findings: FXR-DEV-1 Medium (tablet learned of a web stop 21.2 s late under load) and
  FXR-DEV-2 Low (Reanimated SurfaceMountingManager burst still at the Finalizing hand-over).
- **Window:** 2026-10-07 08:46-09:58 WIB, on the main instance (Core 4420 / `dems_demo`, web 5173 Live, Metro 8081),
  all started by the controller.

## Files created

- `verification/06_e2e_pairing.md` (W94)
- `verification/04_e2e_shared_state.md` (W95)
- `verification/05_e2e_rbac.md` (W96)
- `verification/07_fxr_m_device_checklist.md` (FXR-M checklist, 15c §4)
- `verification/assets/e2e_final/` — 296 files:
  - PNG captures and evidence sheets;
  - 22 short 540 px (tablet 864x540) MP4s;
  - step logs and JSON;
  - frame-signature tables;
  - 26 drivers saved as `drv_*.txt`;
  - `w96_final_roles.txt`.
  No frame dumps are kept.
- `delegation_progress/w94_w96_e2e_final.md` (this file)
- Appended one row to `delegation_progress_report.md`

## Results

| Row | Result | Key numbers |
|---|---|---|
| W94 | PASS | Step 1: Pair + Stack Check, and a guarded link falls to Pair. PCD-000001 → DEV-0001; the app **reaches Login**. Operator shown **live +1.11 s** (`AUTH_SUCCESS` AUD-000090 names DEV-0001). Revoke → Pair drawn **436 ms** after the server's answer (recorded only, D218), 4403 close, AUD-000091 `DEVICE_REVOKED` (D196 ruling). Verification: DEV-0002, sign-in (operator live +1.26 s), sign-out → **Login** |
| pairing | done | phone DEV-0003, tablet DEV-0004 |
| W95 | PASS | web→phone **0.93 s / 0.76 s**; phone stop→web **+9 ms / +2 ms**; phone start→web **+32 ms / +35 ms**; web stop→phone Finalizing **1.46 s / 1.06 s** with no empty frame. 16 audit rows AUD-000103..153. Context a network log: 3,387 requests and 17 sockets, all `127.0.0.1:5173` |
| W96 | PASS | phone lock/unlock **0.45-0.60 s**; web b lock **+38 ms**, unlock ≤48 / +38 ms. Run-1 web-b lock instant not measured (watcher expression, D-1). Two 403 `NOT_PERMITTED` + `ACCESS_DENIED` (AUD-000157/161). ROLE_CHANGED AUD-000156/159/160/162. **budi ends INVESTIGATOR** |
| FXR-M | 7/9 PASS | bar = monitor timer (both devices), rows stay drawn, no empty frame before Summary (phone; tablet stop 2), steppers, name wrap, Sealed chip, TECHNICIAN locked; "Checking your permissions…" not observable |

## Defects and findings (reported, not fixed)

- FXR-DEV-1 (Medium): tablet RECORDING→STOPPING 21.2 s after a web stop at load ~14. The monitor showed "Recording"
  up to 00:05:07. `deltasDropped 0`, `reconnects 0`, `lagMaxMs` 4,463. Passed to W98 (RF2-2 / W93-28 family).
- FXR-DEV-2 (Low): 104 W/Reanimated "Unable to find SurfaceMountingManager" lines per web stop (phone and tablet),
  one group per finalize step + the Summary. 15c §4 item 4 not confirmed (W93-7).
- Observations:
  - elapsed-timer lag under load (D236 residual);
  - empty frame Login→Home on the tablet;
  - tablet Home mic tiles "No signal";
  - a CDP click did not select the role radio (hypothesis: harness);
  - phone session-command audit rows carry `deviceId: null`;
  - Pair copy "Pair this tablet" on phones.
- Round-1 defects E2E-S-1..4 did not reproduce.

## Decisions / deviations

- D-1: one extra short tablet recording (SES-0029) completed checklist item 3.
- D-2: the 15c names were used as subjects (the rebuilt seed lacks them).
- D-3: load 15.32/17.23 at 09:27-09:28: paused about 2.5 min.
- D-4: the W95 continuous network log covers run 2 onward; run 1 is covered per script.
- D-5: W96 run-1 web-b lock instant was not captured.
- Sandbox: adb, loopback HTTP and CDP need the per-command sandbox bypass.

## Rules

- Devices: 5554, 5556, 5558 only. No PIN, lock, fingerprint, settings or reverse-rule change. No keyguard seen.
  Biometric offer → "Not now" (phone, tablet).
- No dump on Login, Summary or Home. No capture within 2 s of a password (2.6 s wait).
- No server start/stop, demo reset, scenario or fault. Nothing touched 5432.
- Secrets: pairing codes counted 0 times in 29/57/80/89 places. The demo password occurs 0 times in all evidence
  files, reports and this file (final scan). 0 token shapes.
- No tracked file modified except the allowed append to `delegation_progress_report.md`. `02_plan.md` is tracked and
  was not edited: plan-status updates are left to the controller.

## End state

- phone2 DEV-0002, phone DEV-0003 and tablet DEV-0004: paired to the main instance, LIVE, signed out, on Login.
- budi.santoso INVESTIGATOR.
- Nothing recording (current SES-0029 SEALED).
- Both browsers stopped and their profiles removed; no watcher process left.

*Generated: 2026-10-07 10:00*
