# coder-execution, step 26 (plan row W04): early proof (d), headless simulator engine

| Field | Value |
|---|---|
| Step / row | 26 / W04 |
| Agent | coder-execution |
| Status | **complete** |
| Verdict | **ADQ-1 option B CONFIRMED**; `PROOF d1 PASS` to `PROOF d5 PASS`, exit code 0; fallback Fd not triggered; no `SIM-GAP` |
| Started / finished | 2026-10-04 06:25 WIB / 06:50 WIB (time box 60 min) |
| Write paths used | `.cache/proof-engine/**` (scratch, git-ignored by `.gitignore:47`); this file; `implementation/04_proof_headless_engine.md` |
| Tracked files changed | None |
| Shared trackers | Not written (parallel run, P8): `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`, `masterplan/02_plan.md` |
| Processes | None left running; no port, no database, no network |

## Files created

| Path | Note |
|---|---|
| `docs/2026-10-04_dems_backend_rbac_pairing/implementation/04_proof_headless_engine.md` | The Tier 3 output document (evidence, the five points, measurements, seams, findings, recommendation) |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_step_26.md` | This file |
| `.cache/proof-engine/headless.mts` | The proof script, 1,051 lines (scratch) |
| `.cache/proof-engine/run_01.log` to `run_05.log` and `.err` | Run logs (scratch) |
| `.cache/proof-engine/debug_d4.mts` | Aid that explains the d4 failure of run 01 (scratch) |

## Log

- 06:25 Inputs read: 02_structured (row 26, P1 to P25, early proofs), 02_plan (W04, section 6 (d), Fd), 03_analysis ADQ-1, 01_specs section 8 and SA-04, SA-05, SA-10, 01_explore (simulator inventory), `packages/shared/src/sim/**` (read-only).
- 06:31 `git check-ignore -v .cache/proof-engine/headless.mts` gives `.gitignore:47:.cache/`. Node v26.8.2, `node_modules/.bin/tsx` present.
- 06:38 Run 01: d1, d2, d3 PASS; d4, d5 FAIL. Both failures were defects of the proof script (an empty 10 s window after the tamper; a row lookup that matched a seeded history row), not simulator behaviour. Corrected without weakening a check (details in 04, section 2.3).
- 06:40 Run 02: d1 to d5 PASS, exit 0.
- 06:43 Runs 03 and 04: PASS; non-timing output byte-identical between the two runs.
- 06:45 Run 05 (final script): PASS, exit 0. `package-lock.json` last written 06:35:56, before every run; no import failed (P11).
- 06:50 Output document written; artifacts checked for credential values (none in 9 files).

## Milestones

1. The shared `Sim` runs headless under Node with a manual clock, an injected scheduler, injected timers and memory storage; 1,200 ticks, zero engine errors.
2. d1: audit-type sequence equal to the shared suite's harness (all rows and hashes) and to a pure replay without store or engine. Reference digest for W26 recorded.
3. d2: rehydration proven by both routes SA-04 names (`storage` option; `store.setState`).
4. d3: `inject('POWER_FAIL')` moves a rehydrated RECORDING session to FAULT; the recovery path gives the AC-B-05 rows; the four other faultable states also move to FAULT.
5. d4: `AUDIT_TAMPER` alters one ring row only; an append-only table stays intact and verifiable.
6. d5: `auth` is signed out after each of 8 commands, 4 of which throw; a negative control without `finally` leaks, so the check has teeth.

## Blockers

None.

## Findings for the controller (P22), detail in 04 section 7

| ID | Finding |
|---|---|
| F-1 | The restart fault through `sim.actions.inject` is stamped at the restart instant and counts the stop as recording (+205,000,000 bytes for a 90 s stop) |
| F-2 | The exported pure transition `injectFaultTransition(state, instant, kind)` can stamp it at a stored instant with the same shared code |
| F-3 | Two engine-timed rows name the session's creator by design (`PRECHECK_PASSED` when the engine arms, `PRECHECK_BLOCKED`): the literal wording of AC-B-53, ENG-2 and G-25 does not hold |
| F-4 | `inject` and `clearFault` write `actorId` null even inside the actor scope (operations 73 and 74) |
| F-5 | A rejected snapshot falls back to a fresh demo dataset with only a warning: W26 must make that a fatal start error |
| F-6 | Importing `@dems/shared/sim` loads React (the barrel re-exports `react.ts`) |
| F-7 | Default adapters under Node 26 would use Node's global `sessionStorage` and real timers: the host must inject all adapters |
| F-8 | With `storage: null` the persist layer serialises the whole snapshot once a second; a storage adapter with a no-op `setItem` avoids it |
| F-9 | Rollback by reference restores the store, not the subsystem closures: a rolled-back tick's row is not emitted again |
| F-10 | Store subscribers see the signed-in `auth` during a command: a publisher must ignore `auth` |
| F-11 | `AUDIT_CHAIN_DISCONTINUITY` stores a ring-relative `details.index` beside `details.seq` |
| F-12 | Six `failed to copy trust settings of system certificate` lines on standard error in every run (sandbox noise, not from the script) |

## Deviations from the plan

| ID | Deviation |
|---|---|
| DR-a | The plan's tracking table and `status_tasks.md` were not updated by this row (parallel run: controller only) |
| DR-b | The script holds information checks beyond d1 to d5 (recovery, other faultable states, ring with dropped rows, operators mirror, rollback, negative control); none is part of a PROOF verdict |
| DR-c | The d1 reference harness uses one default throttle timer, cleared by `stop()`; `CHECK timers: ok` confirms nothing is pending |

## Decisions needed before W26

| ID | Question | Recommendation of this row |
|---|---|---|
| D-1 | Which instant does the restart fault carry (F-1, F-2)? | The exported pure transition at the last committed instant; needs that instant stored (possible `SCHEMA-GAP` for W26 to raise) |
| D-2 | Reword AC-B-53, ENG-2, G-25 (F-3)? | Yes: "no row takes its actor from the engine's `auth` slice outside a command", with the two creator-named rows as the stated exception |
| D-3 | Should operations 73 and 74 leave the operator on record (F-4)? | One server log line, the pattern of `01_specs.md:1464` |
| D-4 | React as a run-time dependency of the server (F-6)? | Either declare `react` in the server manifest, or add a React-free subpath export to the shared manifest; no preference on evidence |
