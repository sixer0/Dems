---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: security-review
step: 67 (plan row W45, CHECKPOINT CP-S1)
status: complete
verdict: CAUTION
last_updated: 2026-10-04 18:18
---

# Progress: security review of the access-control code (step 67, W45)

## Status

complete. Read-only: no source file was edited, no port bound, no server started, no device touched.

## Files created

| File | What |
|---|---|
| `docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/05_cp_access_control_security.md` | The Tier 1 report (576 lines): frame, the five gate checks, SR-01 to SR-82 with code and test lines, the review by attacker position, 13 findings, 15 rulings, the database re-check list, GDPR and ISO, verification |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/security_review_step_67.md` | This file |

Not written, by the parallel-run rule: `delegation_progress_report.md`, `status_tasks.md`, `decisions/decisions.md`, `masterplan/02_plan.md` (its tracking cell for W45 is the controller's to set). Scratch output of the runs is in the sandbox's temporary directory only.

## Verdict and counts

CAUTION. 0 Critical, 0 High, 2 Medium, 7 Low, 4 Info. Open FAIL: 0.

**Must be fixed before step 80: 2**, both already ruled and scheduled, both still open in the tree at 18:17:40:

| ID | What | Owner |
|---|---|---|
| CPS1-1 (F74) | The server clock has no floor (`src/core/clock.ts:26`): after a start with the clock behind the stored state, sessions cannot be ended; the same holds for a pairing code and a biometric token (three CHECKs) | core, fix round B2 (D110). The report lists eight guarantees for the fix; G3 (time must advance from the floor at the real rate) is new |
| CPS1-2 (CPB1-5, carried) | Stage 6 can be replaced after the boot and the boot only warns (`src/app.ts:182-184`; `src/plugins/permission-guard/index.ts:331-334`) | W08 and W28, fix round B (D87) |

Fix later (Low): CPS1-3 rotation of the device credential through a session token (W32, W83); CPS1-4 socket without a time-out on an undecodable path (W08 or W42); CPS1-5 no socket cap per principal (W42); CPS1-6 a verified sign-in failure without its row (W24); CPS1-7 a live biometric token presented by another device stays live (W41); CPS1-8 a failure report can name a disabled operator (W41); CPS1-9 the PostgreSQL log holds failing rows with hash columns (W07).

Info: CPS1-10 the lock is per console and any success clears it; CPS1-11 what a page on another port of 127.0.0.1 can do; CPS1-12 two things an unauthenticated caller writes; CPS1-13 three sentences to correct at close-out.

## Decisions for the controller to record

1. CP-S1 verdict CAUTION; the count that blocks step 80 is 2 and holds no new item.
2. F53: the pinned search path is sufficient; revoking `TEMPORARY` is not needed.
3. F38 / F41: `log_error_verbosity = terse` is not a gate condition; set it at the next planned restart of the cluster, with a size bound for the log (one test and the wording of NL-1 and NL-5 change by design).
4. F62 (1): fix later, the `AUTH_FAILED` row takes precedence over the budget (as the biometric row's DN-3). F62 (2), (3): accepted. F62 (5): a check of the gate W58, with the evidence the report names.
5. F65, F67, F70, DN-10, pairing DV-1 and DN-8, administration self-change, the three demo-control points, realtime DN-1 and DN-4, the evidence row's note, GS-22: accepted as residual, with reasons in section 6 of the report.
6. Biometric DN-1, DN-3, F-2: accepted. F-3 and F-6: fix later (CPS1-7, CPS1-8).
7. Realtime DN-8 (stale permissions after a reset) is closed in the code of the demo module (`src/modules/demo/reset.ts:350-354`).
8. F29: `npm audit` was not run (network refused). From the recorded output and the installed tree: no advisory is on the server's runtime path. A live audit must be recorded at the gate (SR-80).
9. `DEVICE_CREDENTIAL_ROTATED`: no device exists in `dems_demo` or a lane, so none can have been written by the rotation; the count by type could not be queried with the permitted command.

## Evidence of the runs (2026-10-04, WIB)

| Command | Result |
|---|---|
| typecheck, lint | exit 0, exit 0 |
| unit project | 141 files, 3,609 tests passed, 18:03:17, exit 0 |
| `test:db` on `test/db/` | 9 files, 233 passed, 18:06:36 |
| `test:db` on permission-guard, realtime, identity, pairing, admin | 87, 90, 179, 79, 60 passed, 18:07:12 to 18:07:45; 0 databases left each |
| `db:status` on four databases | each OK; `audit_log` 82, `paired_devices` 0, `device_credentials` 0, three triggers `A` |
| `npm audit --omit=dev --json` | not run: network refused (502 from the sandbox proxy) |

## Blockers

None.

## Gaps stated in the report (section 1.9)

The other nine modules' handlers, the engine host beyond its command entry, `scripts/pg` as code, both clients, a listening server, a browser, and the seven implementation logs line by line (they were read through their decision records and by search for every item handed to this row).
