# Delegation progress — E2E-S (SC5 pairing journey, main instance + dems2_phone2)

| Field | Value |
|---|---|
| Row | E2E-S (D194), the W94 journey plus W95's re-pair preface |
| Agent | verifier |
| Status | **needs-review**: journey run end to end; 2 step FAILs from one defect; 1 wording question for the controller |
| Window | 2026-10-06 09:37 – 10:25 WIB |
| Report | `test/07e_e2e_pairing.md` |
| Evidence | `test/assets/e2e/s_pairing/` |

## Milestones

| Time | Milestone |
|---|---|
| 09:40 | Phone2 ready. The app was already installed, with no credential (0 secure-store entries), so no APK copy and no `pm clear` were needed. Reverse rules 8081/4420 set on 5558 |
| 09:42 | Step 1 PASS: LIVE, no credential, only Pair and Stack Check |
| 09:47 | Registry on 4420 empty: 0 devices (DP-3 evidence) |
| 09:49 | Steps 2 and 3: AUD-000093 `PAIRING_CODE_ISSUED`, redeem 201, AUD-000094 `PAIRING_SUCCESS`, **DEV-0001**. The app then showed Stack Check, not Login (E2E-S-1) |
| 09:55 | Step 4: phone sign-in 200, AUD-000102 `AUTH_SUCCESS` device DEV-0001. The operator showed on the web only after a reload (E2E-S-2) |
| 10:08 | Step 5: revoke 200, AUD-000142 `DEVICE_REVOKED`, socket closed 4403. The phone was on Pair after **891 ms** |
| 10:12 | Step 6: AUD-000145/146, **DEV-0002**. Stack Check again (E2E-S-1) |
| 10:14 | Sign-in on DEV-0002: AUD-000159 `AUTH_SUCCESS` device DEV-0002 |
| 10:17 | End state: phone2 paired as DEV-0002, LIVE, signed out, on Login. Web session signed out; own browser stopped |

## Defects for the controller

| ID | Severity | One line |
|---|---|---|
| E2E-S-1 | Medium | After a redeem (2×) and after a sign-out (1×) the app lands on Stack Check or the Pair view instead of Login. Hypothesis: `leave()` → `router.back()` to a public screen underneath |
| E2E-S-2 | Medium | Paired Devices' Operator column does not update live after the device signs in. The API has `signedInOperatorId`; the page shows it only after a reload (RESIDUAL-W70-1 family) |
| E2E-S-3 | Low | About 1 s of a false "Core server unreachable" on Pair after a revoke |
| E2E-S-4 | Low | A guarded deep link while unpaired stays on the public screen instead of falling through to `/pair`. The gate holds |
| E2E-S-5 | Ruling | "Next call refused": only the server's 4403 socket close exists; the app deletes its credential, so it makes no HTTP call that could be refused |

## Decisions / deviations to record

- D-1: The load guard was exceeded once. Steps 2 and 3 ran at a load of 16.65 because the check and the run were in the same command. After that the row paused twice.
- O-3: The web session idle-expired at 10:04:02, so the first revoke attempt aborted with nothing revoked and the row signed in again.
- No biometric offer appeared, because phone2 has no fingerprint enrolled. "Not now" did not apply.
- Reverse rules on 5558 were left in place, as Live mode needs them.

## Files created

`test/07e_e2e_pairing.md`; `delegation_progress/e2e_s_pairing.md`; everything under `test/assets/e2e/s_pairing/` (listed in §7 of the report). No tracked file was modified; no shared progress file was written.
