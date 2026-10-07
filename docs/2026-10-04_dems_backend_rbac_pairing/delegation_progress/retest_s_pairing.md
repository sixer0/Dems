# Progress: R-S re-test (pairing journey after E-fix), verifier

| Field | Value |
|---|---|
| Row | R-S: re-test of E2E-S-1 to E2E-S-4 on `dems2_phone2` (emulator-5558) and the web Paired Devices page, main instance 4420 / 5173 |
| Time | 2026-10-06 12:39-13:25 WIB |
| Status | **needs-review**: the four round-1 defects are fixed; two new defects (R-S-1 needs a ruling); two secret incidents contained; round-1 evidence needs redaction |
| Report | `test/08d_retest_pairing.md` |
| Evidence | `test/assets/retest/s_pairing/` |

## Milestones

| Time | Milestone |
|---|---|
| 12:45:57 | App force-stopped and relaunched COLD with `demsdemo:///login?core=LIVE&motion=off`; Login "paired as DEV-0002" |
| 12:47:53 | Web SUPERVISOR andi.pratama signed in (own headless shell, OS-assigned CDP port 53355); background page watcher from 12:49:01 |
| 12:49:21 | Step 1: DEV-0002 revoked (AUD-000176). No "unreachable" in 61 frames; revoke-to-Pair 1,897 ms (R-S-1) |
| 12:54-12:58 | Step 2: warm `/home`, `/login`, `/sessions` from Pair and from Stack Check all open Pair (E2E-S-4 fixed) |
| 13:01:16 | Step 3: PCD-000003 issued (AUD-000178), redeemed as **DEV-0003** (AUD-000179); hand-off lands on Login, no Stack Check frame (E2E-S-1 part 1 fixed); R-S-2 found |
| 13:06:29 | Step 4: Operator "AKP Budi Santoso" live in 1,221 ms (AUD-000181; E2E-S-2 fixed) |
| 13:08:23 | Step 5: sign-out lands on Login (E2E-S-1 part 2 fixed), cell cleared live in 1,705 ms (AUD-000182) |
| 13:13:02 | Web signed out; browser stopped and profile removed; stray step-1 logcat stream stopped |

## Defects and decisions for the controller

- **R-S-1** (Medium, ruling needed): revoke-to-Pair takes 1,897 ms from a signed-out Login (W94: < 1 s; round 1: 891 ms from a signed-in Session Summary).
- **R-S-2** (Low): false "Core server unreachable" with "Use Simulated mode" on Login for 0.10-0.47 s right after the pairing hand-off. It coincides with the app's `live.socket SYNC_TIMEOUT` and its own socket restart (closed 1000 by peer at 13:01:24.742, reopened at 25.607).
- **Decision:** step 6 (repeat) not run. Steps 3-5 met their criteria, and a repeat would need another revoke (DEV-0004).
- **Incident D-2:** the hand-off recording caught the redeemed code in 2 frames. Redacted, original deleted, only `03_phone_handoff_screenrecord_redacted.mp4` kept.
- **Incident D-3:** the prefill screencap caught the password's last character (Android echo). Redacted, original deleted.
- **Route:** round 1's `test/assets/e2e/s_pairing/04_phone_login_prefilled.png` and `06_phone_login_prefilled.png` show the password's last character. They need redaction; this row may not write there.

## Files

- `test/08d_retest_pairing.md`
- `delegation_progress/retest_s_pairing.md`
- `test/assets/retest/s_pairing/`: 46 PNG, 3 MP4, step logs and JSON, UI dumps, the watcher log, the server log excerpt, the device JS stream, the secret scan log and the drivers as `.txt` (full list in the report, section 8 and 9)

---
*Generated: 2026-10-06 13:25*
