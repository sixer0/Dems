---
task_id: 2026-09-30_dems_demo_stack_setup
step: 74 (CP-M1)
agent: senior-code-reviewer
status: complete
verdict: PASS (0 open blockers)
date: 2026-10-01
---

# Step 74 progress: senior code review of the mobile foundation (steps 67-73)

## Timeline (WIB)

| Time | Activity |
|---|---|
| 04:58-05:07 | Read the row 74 contract, P1-P13, decisions D40-D69 and logs 41-46 (40 and 62 by section). Read every foundation source file listed in the report §9. Ran the AST hook-naming scan (172 files, 0 violations) and the worklet default-parameter scan |
| 05:07:49 | Lock probe with `lockf -k -t 0` (D47): phone and tablet free. Metro 8081-8086 free |
| 05:08:56-05:10:22 | Device session A: phone, Metro 8084. Three cold starts took 11.6-13.2 s |
| 05:12:42-05:13:41 | Session B: first launch 11.3 s, then 3.1 s and 2.5 s with the same code and Metro. Module-initialisation probe; bundle downloaded (22.08 MB) |
| 05:15:11 | Read-only session (`NO_METRO=1 KEEP_APP=1`): power state, guest `top`, memory |
| 05:16:09-05:18:38 | Session C: five cold starts (11.4, 11.7, 4.9, 9.8, 13.4 s) with host and guest load. App PSS 814 MB |
| 05:19-05:20 | Read-only session: guest CPU benchmark. Host check: both qemu processes at PRI 4, nice 5; every thread at `4T`. The host is an M5 with 4 Super and 6 Efficiency cores |
| 05:21:47-05:22:49 | Session D: benchmark stable (0.86-1.04 s). Launch still slow (`am start -W` timed out). State sizes: snapshot 104,981 B; `createSim` 275 ms |
| 05:24:13-05:26:22 | Session E: the emulator received 1.0-1.2 host cores during launches at host load average 2.5-3.3 |
| 05:26-05:35 | Anchored D42 greps. `npm ls` peer scan. Typecheck: fails only in in-progress screen tests of steps 75, 77 and 79 (P11). Lint on foundation paths: exit 0. Jest on foundation paths: 33 suites, 439 tests, exit 0. Static acceptance greps re-run. §5.6 selector map built. Resolved-in-flight items verified (`StubSignIn` removal and the F-70-3 jest config, both by step 75) |
| 05:36-05:45 | Wrote the evidence file and the report |

## Result

- **Verdict:** PASS. 0 blockers, 3 major, 12 minor, 6 nit. Steps 76, 78 and 80-89 may start.
- **Cold-start regression (D69):**
  - **Cause:** the environment. Both emulators run in the macOS background scheduling band (PRI 4 on all threads; App Nap is the likely mechanism). Emulator throughput then swings 3-5 times with the host load of the concurrent lanes.
  - **Code is not the cause.** The identical build starts in 2.5-3.1 s, below the step-68 baseline, and the native phases slow by the same factor in slow runs.
  - **Owner:** the controller (emulator priority, reversible `taskpolicy -B -p <pid>` or visible windows, with user OK). Step 61 owns the boot recipe and the baseline. Step 60 documents the measurement protocol.
- **Majors:**

  | # | File | Issue | Owner |
  |---|---|---|---|
  | F74-02 | `motion/builders.ts:169` | Worklet default parameter that names an imported binding. It is a latent UI-thread ReferenceError, the only one among 1,077 worklets | Step 91; relay to screens now |
  | F74-03 | `components/kit/subject-type-chip.tsx:10-18` | SubjectType key-space split between the kit, the simulator and shared i18n | Controller hand-over before step 78; interim `SubjectTypeLabel[...]` |

## Files written

- `verification/11_mobile_foundation_review.md` (Tier 2)
- `verification/assets/74_cold_start_evidence.txt` (raw timings, host scheduling state)
- This file

Not written: code, config, `02_plan.md`, `99_implementation_report.md`, `status_tasks.md` or `delegation_progress_report.md` (parallel run, P8).

## Processes (P7)

- **Metro (8084):** started by the helper and stopped by it in every session (PIDs 54023, 54889, 55971, 59291, 60621).
- **Device state:** the helper removed its reverse rules and force-stopped the app at each session end.
- **Not touched:** emulators, adb server, mock-core.
- **Tablet:** never locked.

## Blockers and decisions for the controller

1. Decide on the emulator priority fix (F74-01). It is a host-level action and should get the user's OK.
2. Assign the `SubjectTypeChip` hand-over before step 78 (F74-03).
3. Relay the report's §6 rules (8 items) to the running and next screen steps.
