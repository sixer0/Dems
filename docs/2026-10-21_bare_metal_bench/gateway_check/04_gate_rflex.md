# Gate G-RF (row 119) - WAITING FOR THE USER

Date: 2026-10-22 ~20:00 WIB. Prepared by the controller (D30). The gate closes only on the user's own words, quoted here (blueprint row 119 HIL; user rule: a CAUTION is never pre-approved).

## Rows 115-118
| Row | Report | Verdict | Blocking |
|---|---|---|---|
| 115 regression | `test/04_rflex_regression.md` | PASS: 0 failures only in the R-FLEX tree (s4 47/47, s5 171/171, s9 2/2 equal to the pre-R-FLEX baseline on this host) | none |
| 116 spec | `verification/05_rflex_verification.md` | CAUTION: 18 requirements, 14 PASS, 4 PARTIAL (host-only evidence still to come), 0 FAIL | 0 |
| 117 security | `verification/06_rflex_security.md` | CAUTION: RG-1..RG-14 all in place; 4 Medium already accepted (D11, D16 Q96-08); 2 Medium NEW (M-5, M-6) | 0, but M-5/M-6 need the user's ruling |
| 118 code review | `verification/07_rflex_code_review.md` | CHANGES REQUESTED -> 1 BLOCKING (F1) | F1 CLOSED by row 143 (`implementation/89_row143_factory_scan_fix.md`) |
Fix rows added: 142 (`implementation/88_row142_regression_fix.md`), 143.

## What the user is asked to confirm
1. The posture statement, `verification/06_rflex_security.md` section 1 (cameras reachable on any directly attached network; scan and set-IP stay on the camera port; USB card by USB id + serial, one card one microphone, `release: true` to move).
2. M-5 (NEW): a serial-less USB card that is unplugged and replaced by another unit of the same model on any socket is recorded from without notice. Accept, or ask for a console notice when a serial-less card's port changed.
3. M-6 (NEW): D31 ("every Wi-Fi and LAN camera in the list") conflicts with U-RF3/HOST-23 (search answers admitted on the camera port only once the firewall is applied). Options: (a) keep U-RF3, Wi-Fi cameras by typed address; (b) widen HOST-23 to Wi-Fi (new risk acceptance); (c) measure D31 before the firewall step and record it as pre-firewall.

## Open non-blocking items (listed, not fixed in this gate)
Row 116: F-2 (two ws-discovery flood tests: pre-existing on Linux per row 115), F-3 (end-to-end boot evidence waits for the worker build, rows 28-31), F-4, F-5 (`rflex-only.diff` also holds rows 139/141), F-6..F-9. Row 117: L-1..L-6, FU-1 (device-identity check before credentials, outside the blueprint). Row 118: F2..F12 (duplication RG-13 eligibility, stale comments/README/`capture-discovery.ts:861`, example text "uses" vs "holds", `'0000:0000'` literal).

## After the user's word
Row 120 (RB-1 diff + commit only on the user's word), row 121 (tree to staging), then install rows 20-79/122-128 per `masterplan/02_plan.md`.
